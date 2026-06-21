package xyz.xiewenwen.blog.admin;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import xyz.xiewenwen.blog.media.AdminVideoService;
import xyz.xiewenwen.blog.media.VideoUploadService;
import xyz.xiewenwen.blog.social.GuestMessage;
import xyz.xiewenwen.blog.social.GuestMessageRepository;
import xyz.xiewenwen.blog.social.SocialService;

@Service
public class AdminService {

	private final AdminVideoService videoService;
	private final GuestMessageRepository messageRepository;

	public AdminService(AdminVideoService videoService, GuestMessageRepository messageRepository) {
		this.videoService = videoService;
		this.messageRepository = messageRepository;
	}

	@Transactional(readOnly = true)
	public List<VideoUploadService.VideoDto> listVideos() {
		return videoService.listAll();
	}

	@Transactional
	public void deleteVideo(Long id) {
		videoService.delete(id);
	}

	@Transactional(readOnly = true)
	public List<SocialService.MessageDto> listMessages() {
		return messageRepository.findTop200ByOrderByCreatedAtDesc().stream()
				.map(SocialService.MessageDto::from)
				.toList();
	}

	@Transactional
	public void deleteMessage(Long id) {
		GuestMessage message = messageRepository.findById(id)
				.orElseThrow(() -> new IllegalArgumentException("留言不存在"));
		messageRepository.delete(message);
	}
}
