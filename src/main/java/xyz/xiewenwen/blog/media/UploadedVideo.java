package xyz.xiewenwen.blog.media;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "uploaded_videos")
public class UploadedVideo {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, length = 255)
	private String originalFilename;

	@Column(nullable = false, unique = true, length = 64)
	private String storedFilename;

	@Column(nullable = false, length = 100)
	private String contentType;

	@Column(nullable = false)
	private long sizeBytes;

	@Column(nullable = false, length = 12)
	private String uploaderNickname;

	@Column(nullable = false)
	private LocalDateTime uploadedAt;

	@Column(nullable = false, length = 16)
	private String status;

	@Column(length = 300)
	private String statusMessage;

	@Column(length = 128)
	private String tempFilename;

	protected UploadedVideo() {
	}

	public UploadedVideo(
			String originalFilename,
			String storedFilename,
			String contentType,
			long sizeBytes,
			String uploaderNickname,
			String status) {
		this.originalFilename = originalFilename;
		this.storedFilename = storedFilename;
		this.contentType = contentType;
		this.sizeBytes = sizeBytes;
		this.uploaderNickname = uploaderNickname;
		this.status = status;
		this.uploadedAt = LocalDateTime.now();
	}

	public void markReady(long compressedSizeBytes) {
		this.sizeBytes = compressedSizeBytes;
		this.status = VideoStatus.READY;
		this.statusMessage = null;
		this.contentType = "video/mp4";
		this.tempFilename = null;
	}

	public void markFailed(String message) {
		this.status = VideoStatus.FAILED;
		this.statusMessage = truncate(message, 300);
		this.tempFilename = null;
	}

	private static String truncate(String message, int max) {
		if (message == null) {
			return "压缩失败";
		}
		return message.length() <= max ? message : message.substring(0, max);
	}

	public Long getId() {
		return id;
	}

	public String getOriginalFilename() {
		return originalFilename;
	}

	public String getStoredFilename() {
		return storedFilename;
	}

	public String getContentType() {
		return contentType;
	}

	public long getSizeBytes() {
		return sizeBytes;
	}

	public String getUploaderNickname() {
		return uploaderNickname;
	}

	public LocalDateTime getUploadedAt() {
		return uploadedAt;
	}

	public String getStatus() {
		return status;
	}

	public String getStatusMessage() {
		return statusMessage;
	}

	public String getTempFilename() {
		return tempFilename;
	}

	public void setTempFilename(String tempFilename) {
		this.tempFilename = tempFilename;
	}
}
