package xyz.xiewenwen.blog.media;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

@Component
public class VideoProcessRecovery {

	private static final Logger log = LoggerFactory.getLogger(VideoProcessRecovery.class);

	private final UploadedVideoRepository repository;
	private final VideoProcessService processService;
	private final TransactionTemplate transactionTemplate;
	private final Path incomingDir;

	public VideoProcessRecovery(
			UploadedVideoRepository repository,
			VideoProcessService processService,
			TransactionTemplate transactionTemplate,
			@Value("${blog.upload.dir:./data/uploads}") String uploadDir) {
		this.repository = repository;
		this.processService = processService;
		this.transactionTemplate = transactionTemplate;
		this.incomingDir = Path.of(uploadDir).toAbsolutePath().normalize().resolve("incoming");
	}

	@EventListener(ApplicationReadyEvent.class)
	public void recoverInterruptedJobs() {
		for (UploadedVideo video : repository.findByStatus(VideoStatus.PROCESSING)) {
			Path temp = resolveTemp(video);
			if (temp != null && Files.exists(temp)) {
				log.info("Resuming compress for video {}", video.getId());
				processService.enqueueCompress(video.getId(), temp);
				continue;
			}
			log.warn("Marking stuck video {} as failed", video.getId());
			markFailed(video.getId(), "压缩中断（服务重启或源文件丢失），请重新上传");
		}
	}

	private Path resolveTemp(UploadedVideo video) {
		String tempName = video.getTempFilename();
		if (tempName == null || tempName.isBlank()) {
			return null;
		}
		Path temp = incomingDir.resolve(tempName).normalize();
		return temp.startsWith(incomingDir) ? temp : null;
	}

	private void markFailed(Long videoId, String message) {
		transactionTemplate.executeWithoutResult(status -> repository.findById(videoId).ifPresent(video -> {
			video.markFailed(message);
			video.setTempFilename(null);
			repository.save(video);
		}));
	}
}
