package xyz.xiewenwen.blog.media;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.concurrent.Executor;

@Service
public class VideoProcessService {

	private static final Logger log = LoggerFactory.getLogger(VideoProcessService.class);

	private final UploadedVideoRepository repository;
	private final VideoCompressService compressService;
	private final TransactionTemplate transactionTemplate;
	private final Executor videoCompressExecutor;
	private final Path videoDir;

	public VideoProcessService(
			UploadedVideoRepository repository,
			VideoCompressService compressService,
			TransactionTemplate transactionTemplate,
			@Qualifier("videoCompressExecutor") Executor videoCompressExecutor,
			@Value("${blog.upload.dir:./data/uploads}") String uploadDir) {
		this.repository = repository;
		this.compressService = compressService;
		this.transactionTemplate = transactionTemplate;
		this.videoCompressExecutor = videoCompressExecutor;
		Path base = Path.of(uploadDir).toAbsolutePath().normalize();
		this.videoDir = base.resolve("videos");
	}

	public void enqueueCompress(Long videoId, Path tempInput) {
		videoCompressExecutor.execute(() -> compress(videoId, tempInput));
	}

	private void compress(Long videoId, Path tempInput) {
		Path output = null;
		try {
			UploadedVideo video = repository.findById(videoId).orElse(null);
			if (video == null) {
				log.error("Video {} not found for compress", videoId);
				markFailed(videoId, "压缩任务异常，请重新上传");
				return;
			}

			output = videoDir.resolve(video.getStoredFilename()).normalize();
			if (!output.startsWith(videoDir)) {
				markFailed(videoId, "无效输出路径");
				return;
			}

			Files.createDirectories(videoDir);
			long inputSize = Files.size(tempInput);
			compressService.compressToTarget(tempInput, output, inputSize);
			long size = Files.size(output);
			markReady(videoId, size);
			log.info("Video {} compressed to {} bytes", videoId, size);
		}
		catch (Exception ex) {
			log.warn("Video {} compress failed: {}", videoId, ex.getMessage());
			markFailed(videoId, ex.getMessage() != null ? ex.getMessage() : "压缩失败");
			if (output != null) {
				try {
					Files.deleteIfExists(output);
				}
				catch (IOException ignored) {
					/* ignore */
				}
			}
		}
		finally {
			try {
				Files.deleteIfExists(tempInput);
			}
			catch (IOException ignored) {
				/* ignore */
			}
			clearTempFilename(videoId);
		}
	}

	private void markReady(Long videoId, long sizeBytes) {
		transactionTemplate.executeWithoutResult(status -> repository.findById(videoId).ifPresent(video -> {
			video.markReady(sizeBytes);
			video.setTempFilename(null);
			repository.save(video);
		}));
	}

	private void markFailed(Long videoId, String message) {
		transactionTemplate.executeWithoutResult(status -> repository.findById(videoId).ifPresent(video -> {
			video.markFailed(message);
			video.setTempFilename(null);
			repository.save(video);
		}));
	}

	private void clearTempFilename(Long videoId) {
		transactionTemplate.executeWithoutResult(status -> repository.findById(videoId).ifPresent(video -> {
			if (video.getTempFilename() != null) {
				video.setTempFilename(null);
				repository.save(video);
			}
		}));
	}
}
