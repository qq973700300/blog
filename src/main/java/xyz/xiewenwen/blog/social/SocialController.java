package xyz.xiewenwen.blog.social;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/social")
public class SocialController {

	private final SocialService socialService;

	public SocialController(SocialService socialService) {
		this.socialService = socialService;
	}

	@GetMapping("/messages")
	public List<SocialService.MessageDto> messages() {
		return socialService.recentMessages();
	}

	@GetMapping("/dancers")
	public List<SocialService.DancerDto> dancers() {
		return socialService.stageDancers();
	}

	@PostMapping("/messages")
	public SocialService.MessageResult postMessage(@RequestBody Map<String, String> body) {
		try {
			return socialService.postMessage(body.get("nickname"), body.get("content"));
		}
		catch (IllegalArgumentException ex) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage());
		}
	}

	@GetMapping("/stats")
	public SocialService.StatsDto stats() {
		return socialService.todayStats();
	}

	@GetMapping("/leaderboard")
	public SocialService.LeaderboardDto leaderboard() {
		return socialService.leaderboard();
	}

	@GetMapping("/achievements")
	public List<SocialService.AchievementDto> achievements(@RequestParam String nickname) {
		return socialService.achievements(nickname);
	}

	@PostMapping("/high-five")
	public SocialService.ActionResult highFive(@RequestBody Map<String, String> body) {
		try {
			return socialService.highFive(body.get("nickname"));
		}
		catch (IllegalArgumentException ex) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage());
		}
	}

	@PostMapping("/mood")
	public SocialService.ActionResult mood(@RequestBody Map<String, String> body) {
		try {
			MoodType mood = MoodType.valueOf(body.get("mood").toUpperCase());
			return socialService.voteMood(body.get("nickname"), mood);
		}
		catch (IllegalArgumentException ex) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage());
		}
		catch (Exception ex) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "无效的心情选项");
		}
	}
}
