package xyz.xiewenwen.blog.social;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class SocialService {

	private static final List<String> COLORS = List.of(
			"#00f5ff", "#ff2d95", "#b44dff", "#39ff14", "#ffe600");

	private static final Set<String> IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/gif", "image/webp");
	private static final Set<String> VOICE_TYPES = Set.of(
			"audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-m4a");
	private static final long MAX_IMAGE_BYTES = 5L * 1024 * 1024;
	private static final long MAX_VOICE_BYTES = 2L * 1024 * 1024;

	private final GuestMessageRepository messageRepository;
	private final DailyStatsRepository statsRepository;
	private final VisitorDailyStatsRepository visitorStatsRepository;
	private final UserAchievementRepository achievementRepository;
	private final Path mediaDir;
	private final String ffmpegBin;

	public SocialService(
			GuestMessageRepository messageRepository,
			DailyStatsRepository statsRepository,
			VisitorDailyStatsRepository visitorStatsRepository,
			UserAchievementRepository achievementRepository,
			@Value("${blog.upload.dir:./data/uploads}") String uploadDir,
			@Value("${blog.ffmpeg.bin:ffmpeg}") String ffmpegBin) {
		this.messageRepository = messageRepository;
		this.statsRepository = statsRepository;
		this.visitorStatsRepository = visitorStatsRepository;
		this.achievementRepository = achievementRepository;
		this.mediaDir = Paths.get(uploadDir).toAbsolutePath().normalize().resolve("social");
		this.ffmpegBin = ffmpegBin;
	}

	@Transactional(readOnly = true)
	public List<MessageDto> recentMessages() {
		return messageRepository.findTop30ByOrderByCreatedAtDesc().stream()
				.map(MessageDto::from)
				.toList();
	}

	@Transactional(readOnly = true)
	public List<DancerDto> stageDancers() {
		return messageRepository.findTop3ByOrderByCreatedAtDesc().stream()
				.map(DancerDto::from)
				.toList();
	}

	@Transactional
	public MessageResult postMessage(String nickname, String content, String imageUrl, String voiceUrl) {
		String safeNick = requireNickname(nickname);
		String safeContent = sanitize(content, 40);
		boolean hasMedia = (imageUrl != null && !imageUrl.isBlank()) || (voiceUrl != null && !voiceUrl.isBlank());
		if (safeContent.isBlank() && !hasMedia) {
			throw new IllegalArgumentException("内容不能为空");
		}

		String color = COLORS.get(ThreadLocalRandom.current().nextInt(COLORS.size()));
		GuestMessage message = messageRepository.save(new GuestMessage(
				safeNick, safeContent, color, sanitizeUrl(imageUrl), sanitizeUrl(voiceUrl)));

		VisitorDailyStats visitor = getVisitorStats(safeNick);
		visitor.incrementMessage();
		visitorStatsRepository.save(visitor);

		List<AchievementDto> unlocked = checkMessageAchievements(safeNick, visitor);
		return new MessageResult(MessageDto.from(message), todayStats(), leaderboard(), unlocked);
	}

	@Transactional
	public ActionResult highFive(String nickname) {
		String safeNick = requireNickname(nickname);

		DailyStats stats = getTodayStats();
		stats.incrementHighFive();
		statsRepository.save(stats);

		VisitorDailyStats visitor = getVisitorStats(safeNick);
		visitor.incrementHighFive();
		visitorStatsRepository.save(visitor);

		List<AchievementDto> unlocked = checkHighFiveAchievements(safeNick, visitor);
		return new ActionResult(todayStats(), leaderboard(), unlocked);
	}

	@Transactional
	public ActionResult voteMood(String nickname, MoodType mood) {
		String safeNick = requireNickname(nickname);

		DailyStats stats = getTodayStats();
		stats.incrementMood(mood);
		statsRepository.save(stats);

		List<AchievementDto> unlocked = checkMoodAchievements(safeNick, mood);
		return new ActionResult(todayStats(), leaderboard(), unlocked);
	}

	@Transactional
	public StatsDto todayStats() {
		DailyStats stats = getTodayStats();
		long messageCount = messageRepository.count();
		return StatsDto.from(stats, messageCount);
	}

	@Transactional(readOnly = true)
	public LeaderboardDto leaderboard() {
		LocalDate today = LocalDate.now();
		List<LeaderEntry> messageKings = visitorStatsRepository
				.findTop5ByStatDateOrderByMessageCountDescHighFiveCountDesc(today).stream()
				.filter(v -> v.getMessageCount() > 0)
				.map(v -> new LeaderEntry(v.getNickname(), v.getMessageCount(), v.getHighFiveCount(), v.score()))
				.toList();

		List<LeaderEntry> clapKings = visitorStatsRepository
				.findTop5ByStatDateOrderByHighFiveCountDescMessageCountDesc(today).stream()
				.filter(v -> v.getHighFiveCount() > 0)
				.map(v -> new LeaderEntry(v.getNickname(), v.getMessageCount(), v.getHighFiveCount(), v.score()))
				.toList();

		return new LeaderboardDto(messageKings, clapKings);
	}

	@Transactional(readOnly = true)
	public List<AchievementDto> achievements(String nickname) {
		String safeNick = sanitize(nickname, 12);
		if (safeNick.isBlank()) {
			return List.of();
		}
		return achievementRepository.findByNicknameOrderByUnlockedAtDesc(safeNick).stream()
				.map(AchievementDto::from)
				.toList();
	}

	private List<AchievementDto> checkMessageAchievements(String nickname, VisitorDailyStats visitor) {
		List<AchievementDto> unlocked = new ArrayList<>();
		tryUnlock(nickname, AchievementKey.DEBUT, unlocked);
		if (visitor.getMessageCount() >= 3) {
			tryUnlock(nickname, AchievementKey.CHATTERBOX, unlocked);
		}
		if (messageRepository.findTop3ByOrderByCreatedAtDesc().stream()
				.anyMatch(m -> m.getNickname().equals(nickname))) {
			tryUnlock(nickname, AchievementKey.ON_STAGE, unlocked);
		}
		return unlocked;
	}

	private List<AchievementDto> checkHighFiveAchievements(String nickname, VisitorDailyStats visitor) {
		List<AchievementDto> unlocked = new ArrayList<>();
		if (visitor.getHighFiveCount() >= 5) {
			tryUnlock(nickname, AchievementKey.CLAP_MASTER, unlocked);
		}
		return unlocked;
	}

	private List<AchievementDto> checkMoodAchievements(String nickname, MoodType mood) {
		List<AchievementDto> unlocked = new ArrayList<>();
		if (mood == MoodType.TEA) {
			tryUnlock(nickname, AchievementKey.TEA_SOUL, unlocked);
		}
		if (mood == MoodType.DANCING) {
			tryUnlock(nickname, AchievementKey.DANCE_KING, unlocked);
		}
		return unlocked;
	}

	private void tryUnlock(String nickname, AchievementKey key, List<AchievementDto> unlocked) {
		if (achievementRepository.existsByNicknameAndAchievementKey(nickname, key)) {
			return;
		}
		UserAchievement achievement = achievementRepository.save(new UserAchievement(nickname, key));
		unlocked.add(AchievementDto.from(achievement));
	}

	private VisitorDailyStats getVisitorStats(String nickname) {
		LocalDate today = LocalDate.now();
		return visitorStatsRepository.findByStatDateAndNickname(today, nickname)
				.orElseGet(() -> visitorStatsRepository.save(new VisitorDailyStats(today, nickname)));
	}

	private DailyStats getTodayStats() {
		LocalDate today = LocalDate.now();
		return statsRepository.findByStatDate(today)
				.orElseGet(() -> statsRepository.save(new DailyStats(today)));
	}

	private String requireNickname(String nickname) {
		String safeNick = sanitize(nickname, 12);
		if (safeNick.isBlank()) {
			throw new IllegalArgumentException("请先填写昵称");
		}
		return safeNick;
	}

	private String sanitize(String input, int maxLen) {
		if (input == null) {
			return "";
		}
		String cleaned = input.replaceAll("<[^>]*>", "").trim();
		return cleaned.length() > maxLen ? cleaned.substring(0, maxLen) : cleaned;
	}

	private String sanitizeUrl(String url) {
		String cleaned = sanitize(url, 255);
		if (cleaned.isBlank()) {
			return null;
		}
		if (!cleaned.startsWith("/uploads/social/")) {
			throw new IllegalArgumentException("非法的媒体地址");
		}
		return cleaned;
	}

	@Transactional
	public String storeMedia(MultipartFile file, String kind) {
		if (file == null || file.isEmpty()) {
			throw new IllegalArgumentException("文件不能为空");
		}
		boolean voice = "voice".equalsIgnoreCase(kind);
		String contentType = file.getContentType() != null ? file.getContentType().toLowerCase(Locale.ROOT) : "";
		// MediaRecorder 等来源会带 ";codecs=xxx" 后缀（如 audio/webm;codecs=opus），归一化后再校验
		int semi = contentType.indexOf(';');
		if (semi >= 0) {
			contentType = contentType.substring(0, semi).trim();
		}
		long maxBytes = voice ? MAX_VOICE_BYTES : MAX_IMAGE_BYTES;
		Set<String> allowed = voice ? VOICE_TYPES : IMAGE_TYPES;

		if (!allowed.contains(contentType)) {
			throw new IllegalArgumentException(voice ? "不支持的语音格式" : "不支持的图片格式");
		}
		if (file.getSize() > maxBytes) {
			throw new IllegalArgumentException(voice ? "语音不能超过 2MB" : "图片不能超过 5MB");
		}

		// webm/ogg 录音在 iOS Safari 等环境无法播放，统一转码为 mp3
		boolean transcodeToMp3 = voice && (contentType.equals("audio/webm") || contentType.equals("audio/ogg"));
		if (transcodeToMp3) {
			return storeTranscodedVoice(file);
		}

		String ext = switch (contentType) {
			case "image/jpeg" -> ".jpg";
			case "image/png" -> ".png";
			case "image/gif" -> ".gif";
			case "image/webp" -> ".webp";
			case "audio/mpeg" -> ".mp3";
			case "audio/mp4", "audio/x-m4a" -> ".m4a";
			case "audio/wav" -> ".wav";
			default -> "";
		};

		try {
			Files.createDirectories(mediaDir);
			String storedName = UUID.randomUUID().toString().replace("-", "") + ext;
			Path target = mediaDir.resolve(storedName).normalize();
			if (!target.startsWith(mediaDir)) {
				throw new IllegalArgumentException("无效的文件名");
			}
			try (var in = file.getInputStream()) {
				Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
			}
			return "/uploads/social/" + storedName;
		}
		catch (java.io.IOException ex) {
			throw new IllegalStateException("媒体文件保存失败", ex);
		}
	}

	/** 将 webm/ogg 录音用 ffmpeg 转成 mp3（全端可播）；失败时退回保存原始文件。 */
	private String storeTranscodedVoice(MultipartFile file) {
		Path temp = null;
		try {
			Files.createDirectories(mediaDir);
			temp = Files.createTempFile("voice-", "-in");
			try (var in = file.getInputStream()) {
				Files.copy(in, temp, StandardCopyOption.REPLACE_EXISTING);
			}
			String storedName = UUID.randomUUID().toString().replace("-", "") + ".mp3";
			Path target = mediaDir.resolve(storedName).normalize();
			if (!target.startsWith(mediaDir)) {
				throw new IllegalArgumentException("无效的文件名");
			}
			Process proc = new ProcessBuilder(
					ffmpegBin, "-y", "-i", temp.toString(),
					"-codec:a", "libmp3lame", "-b:a", "64k", "-ac", "1",
					target.toString())
					.redirectError(ProcessBuilder.Redirect.DISCARD)
					.redirectOutput(ProcessBuilder.Redirect.DISCARD)
					.start();
			boolean done = proc.waitFor(20, java.util.concurrent.TimeUnit.SECONDS);
			if (!done) {
				proc.destroyForcibly();
			}
			if (done && proc.exitValue() == 0 && Files.exists(target) && Files.size(target) > 0) {
				return "/uploads/social/" + storedName;
			}
			// 转码失败：退回保存原始 webm
			return saveToMedia(temp, ".webm");
		}
		catch (InterruptedException ex) {
			Thread.currentThread().interrupt();
			throw new IllegalStateException("语音转码被中断", ex);
		}
		catch (java.io.IOException ex) {
			throw new IllegalStateException("语音处理失败", ex);
		}
		finally {
			if (temp != null) {
				try {
					Files.deleteIfExists(temp);
				}
				catch (java.io.IOException ignored) {
					// 清理临时文件失败可忽略
				}
			}
		}
	}

	private String saveToMedia(Path source, String ext) throws java.io.IOException {
		String storedName = UUID.randomUUID().toString().replace("-", "") + ext;
		Path target = mediaDir.resolve(storedName).normalize();
		if (!target.startsWith(mediaDir)) {
			throw new IllegalArgumentException("无效的文件名");
		}
		Files.copy(source, target, StandardCopyOption.REPLACE_EXISTING);
		return "/uploads/social/" + storedName;
	}

	public record MessageDto(Long id, String nickname, String content, String color, String createdAt,
			String imageUrl, String voiceUrl) {
		public static MessageDto from(GuestMessage m) {
			return new MessageDto(
					m.getId(),
					m.getNickname(),
					m.getContent(),
					m.getColor(),
					m.getCreatedAt().toString(),
					m.getImageUrl(),
					m.getVoiceUrl());
		}
	}

	public record DancerDto(Long id, String nickname, String content, String color) {
		static DancerDto from(GuestMessage m) {
			return new DancerDto(m.getId(), m.getNickname(), m.getContent(), m.getColor());
		}
	}

	public record StatsDto(int highFiveCount, Map<String, Integer> moods, long totalMessages) {
		static StatsDto from(DailyStats stats, long totalMessages) {
			return new StatsDto(
					stats.getHighFiveCount(),
					Map.of(
							"CODING", stats.getMoodCoding(),
							"SLACKING", stats.getMoodSlacking(),
							"TEA", stats.getMoodTea(),
							"DANCING", stats.getMoodDancing()),
					totalMessages);
		}
	}

	public record LeaderEntry(String nickname, int messages, int highFives, int score) {
	}

	public record LeaderboardDto(List<LeaderEntry> messageKings, List<LeaderEntry> clapKings) {
	}

	public record AchievementDto(String key, String title, String description, String unlockedAt) {
		static AchievementDto from(UserAchievement a) {
			return new AchievementDto(
					a.getAchievementKey().name(),
					a.getAchievementKey().getTitle(),
					a.getAchievementKey().getDescription(),
					a.getUnlockedAt().toString());
		}
	}

	public record ActionResult(StatsDto stats, LeaderboardDto leaderboard, List<AchievementDto> newAchievements) {
	}

	public record MessageResult(
			MessageDto message,
			StatsDto stats,
			LeaderboardDto leaderboard,
			List<AchievementDto> newAchievements) {
	}
}
