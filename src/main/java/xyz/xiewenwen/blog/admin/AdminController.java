package xyz.xiewenwen.blog.admin;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import jakarta.servlet.http.HttpSession;
import xyz.xiewenwen.blog.media.VideoUploadService;
import xyz.xiewenwen.blog.social.SocialService;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

	public static final String SESSION_KEY = "blog.admin.authenticated";

	private final AdminAuthService authService;
	private final AdminService adminService;

	public AdminController(AdminAuthService authService, AdminService adminService) {
		this.authService = authService;
		this.adminService = adminService;
	}

	@GetMapping("/session")
	public Map<String, Object> session(HttpSession session) {
		return Map.of(
				"authenticated", Boolean.TRUE.equals(session.getAttribute(SESSION_KEY)),
				"configured", authService.isConfigured());
	}

	@PostMapping("/login")
	public Map<String, Object> login(@RequestBody Map<String, String> body, HttpSession session) {
		if (!authService.isConfigured()) {
			throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "服务器未配置管理密码");
		}
		String password = body.get("password");
		if (!authService.verify(password)) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "密码错误");
		}
		session.setAttribute(SESSION_KEY, Boolean.TRUE);
		return Map.of("ok", true);
	}

	@PostMapping("/logout")
	public Map<String, Object> logout(HttpSession session) {
		session.invalidate();
		return Map.of("ok", true);
	}

	@GetMapping("/videos")
	public List<VideoUploadService.VideoDto> videos(HttpSession session) {
		requireAuth(session);
		return adminService.listVideos();
	}

	@DeleteMapping("/videos/{id}")
	public Map<String, Object> deleteVideo(@PathVariable Long id, HttpSession session) {
		requireAuth(session);
		try {
			adminService.deleteVideo(id);
			return Map.of("ok", true);
		}
		catch (IllegalArgumentException ex) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, ex.getMessage());
		}
		catch (IllegalStateException ex) {
			throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, ex.getMessage());
		}
	}

	@GetMapping("/messages")
	public List<SocialService.MessageDto> messages(HttpSession session) {
		requireAuth(session);
		return adminService.listMessages();
	}

	@DeleteMapping("/messages/{id}")
	public Map<String, Object> deleteMessage(@PathVariable Long id, HttpSession session) {
		requireAuth(session);
		try {
			adminService.deleteMessage(id);
			return Map.of("ok", true);
		}
		catch (IllegalArgumentException ex) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, ex.getMessage());
		}
	}

	private void requireAuth(HttpSession session) {
		if (!Boolean.TRUE.equals(session.getAttribute(SESSION_KEY))) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录");
		}
	}
}
