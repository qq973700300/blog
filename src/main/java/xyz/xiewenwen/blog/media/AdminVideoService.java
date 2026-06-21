package xyz.xiewenwen.blog.media;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminVideoService {

	private final UploadedVideoRepository repository;
	private final Path videoDir;

	public AdminVideoService(
			UploadedVideoRepository repository,
			@Value("${blog.upload.dir:./data/uploads}") String uploadDir) {
		this.repository = repository;
		Path base = Paths.get(uploadDir).toAbsolutePath().normalize();
		this.videoDir = base.resolve("videos");
	}

	@Transactional(readOnly = true)
	public List<VideoUploadService.VideoDto> listAll() {
		return repository.findTop100ByOrderByUploadedAtDesc().stream()
				.map(VideoUploadService.VideoDto::from)
				.toList();
	}

	@Transactional
	public void delete(Long id) {
		UploadedVideo video = repository.findById(id)
				.orElseThrow(() -> new IllegalArgumentException("视频不存在"));
		Path file = videoDir.resolve(video.getStoredFilename()).normalize();
		if (file.startsWith(videoDir)) {
			try {
				Files.deleteIfExists(file);
			}
			catch (IOException ex) {
				throw new IllegalStateException("删除视频文件失败");
			}
		}
		repository.delete(video);
	}
}
