package xyz.xiewenwen.blog.media;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

@Service
public class VideoUploadService {

	private static final long MAX_UPLOAD_BYTES = 500L * 1024 * 1024;

	private final UploadedVideoRepository repository;
	private final VideoProcessService processService;
	private final VideoCompressService compressService;
	private final Path videoDir;
	private final Path incomingDir;
	private final long compressMinBytes;

	public VideoUploadService(
			UploadedVideoRepository repository,
			VideoProcessService processService,
			VideoCompressService compressService,
			@Value("${blog.upload.dir:./data/uploads}") String uploadDir,
			@Value("${blog.video.compress-min-bytes:52428800}") long compressMinBytes) {
		this.repository = repository;
		this.processService = processService;
		this.compressService = compressService;
		this.compressMinBytes = compressMinBytes;
		Path base = Paths.get(uploadDir).toAbsolutePath().normalize();
		this.videoDir = base.resolve("videos");
		this.incomingDir = base.resolve("incoming");
	}

	@Transactional(readOnly = true)
	public List<VideoDto> recentVideos() {
		return repository.findTop50ByOrderByUploadedAtDesc().stream()
				.map(VideoDto::from)
				.toList();
	}

	@Transactional
	public VideoDto upload(String nickname, MultipartFile file) throws IOException {
		String safeNick = requireNickname(nickname);
		validateFile(file);
		ensureStorageDirs();

		String originalName = sanitizeFilename(file.getOriginalFilename());
		String contentType = file.getContentType() != null ? file.getContentType() : "video/mp4";
		long uploadSize = file.getSize();

		if (uploadSize < compressMinBytes) {
			String storedName = buildStoredFilename(originalName);
			Path output = videoDir.resolve(storedName).normalize();
			if (!output.startsWith(videoDir)) {
				throw new IllegalArgumentException("无效的文件名");
			}
			try (var in = file.getInputStream()) {
				Files.copy(in, output, StandardCopyOption.REPLACE_EXISTING);
			}
			UploadedVideo entity = repository.save(new UploadedVideo(
					originalName, storedName, contentType, Files.size(output), safeNick, VideoStatus.READY));
			return VideoDto.from(entity);
		}

		String storedName = UUID.randomUUID().toString().replace("-", "") + ".mp4";
		Path incoming = incomingDir.resolve(UUID.randomUUID() + ".upload").normalize();
		if (!incoming.startsWith(incomingDir)) {
			throw new IllegalArgumentException("无效的文件名");
		}

		try (var in = file.getInputStream()) {
			Files.copy(in, incoming, StandardCopyOption.REPLACE_EXISTING);
		}

		try {
			compressService.ensureFfmpegAvailable();
		}
		catch (IOException ex) {
			Files.deleteIfExists(incoming);
			throw ex;
		}
		UploadedVideo entity = new UploadedVideo(
				originalName, storedName, contentType, uploadSize, safeNick, VideoStatus.PROCESSING);
		entity.setTempFilename(incoming.getFileName().toString());
		entity = repository.save(entity);

		Long videoId = entity.getId();
		TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
			@Override
			public void afterCommit() {
				processService.enqueueCompress(videoId, incoming);
			}
		});
		return VideoDto.from(entity);
	}

	private String buildStoredFilename(String originalName) {
		String ext = "mp4";
		int dot = originalName.lastIndexOf('.');
		if (dot > 0 && dot < originalName.length() - 1) {
			String candidate = originalName.substring(dot + 1).toLowerCase(Locale.ROOT);
			if (candidate.matches("[a-z0-9]{2,5}")) {
				ext = candidate;
			}
		}
		return UUID.randomUUID().toString().replace("-", "") + "." + ext;
	}

	private void ensureStorageDirs() throws IOException {
		Files.createDirectories(videoDir);
		Files.createDirectories(incomingDir);
	}

	private void validateFile(MultipartFile file) {
		if (file == null || file.isEmpty()) {
			throw new IllegalArgumentException("请选择视频文件");
		}
		if (file.getSize() > MAX_UPLOAD_BYTES) {
			throw new IllegalArgumentException("视频不能超过 500MB");
		}
		String contentType = file.getContentType();
		if (contentType == null || !contentType.startsWith("video/")) {
			throw new IllegalArgumentException("仅支持视频文件");
		}
	}

	private String requireNickname(String nickname) {
		if (nickname == null) {
			throw new IllegalArgumentException("请填写昵称");
		}
		String trimmed = nickname.trim();
		if (trimmed.isEmpty() || trimmed.length() > 12) {
			throw new IllegalArgumentException("昵称需 1–12 个字符");
		}
		return trimmed.replaceAll("[\\x00-\\x1f<>\"'&]", "");
	}

	private String sanitizeFilename(String name) {
		if (name == null || name.isBlank()) {
			return "video.mp4";
		}
		String base = Paths.get(name).getFileName().toString();
		if (base.length() > 200) {
			base = base.substring(0, 200);
		}
		return base.replaceAll("[\\x00-\\x1f<>\"'&]", "");
	}

	public record VideoDto(
			Long id,
			String originalFilename,
			String url,
			String contentType,
			long sizeBytes,
			String uploaderNickname,
			String uploadedAt,
			String status,
			String statusMessage) {

		static VideoDto from(UploadedVideo v) {
			String rawStatus = v.getStatus();
			String status = (rawStatus == null || rawStatus.isBlank()) ? VideoStatus.READY : rawStatus;
			String url = VideoStatus.READY.equals(status)
					? "/uploads/videos/" + v.getStoredFilename()
					: null;
			return new VideoDto(
					v.getId(),
					v.getOriginalFilename(),
					url,
					v.getContentType(),
					v.getSizeBytes(),
					v.getUploaderNickname(),
					v.getUploadedAt().toString(),
					status,
					v.getStatusMessage());
		}
	}
}
