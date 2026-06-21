package xyz.xiewenwen.blog.media;

import java.io.IOException;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/videos")
public class VideoUploadController {

	private final VideoUploadService videoUploadService;

	public VideoUploadController(VideoUploadService videoUploadService) {
		this.videoUploadService = videoUploadService;
	}

	@GetMapping
	public List<VideoUploadService.VideoDto> list() {
		return videoUploadService.recentVideos();
	}

	@PostMapping("/upload")
	public VideoUploadService.VideoDto upload(
			@RequestParam("nickname") String nickname,
			@RequestParam("file") MultipartFile file) {
		try {
			return videoUploadService.upload(nickname, file);
		}
		catch (IllegalArgumentException ex) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage());
		}
		catch (IOException ex) {
			String msg = ex.getMessage() != null && ex.getMessage().contains("ffmpeg")
					? "服务器未安装 FFmpeg，无法压缩视频"
					: "视频保存失败";
			throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, msg);
		}
	}
}
