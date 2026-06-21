package xyz.xiewenwen.blog.social;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SocialService {

	private static final List<String> COLORS = List.of(
			"#00f5ff", "#ff2d95", "#b44dff", "#39ff14", "#ffe600");

	private final GuestMessageRepository messageRepository;
	private final DailyStatsRepository statsRepository;
	private final VisitorDailyStatsRepository visitorStatsRepository;
	private final UserAchievementRepository achievementRepository;

	public SocialService(
			GuestMessageRepository messageRepository,
			DailyStatsRepository statsRepository,
			VisitorDailyStatsRepository visitorStatsRepository,
			UserAchievementRepository achievementRepository) {
		this.messageRepository = messageRepository;
		this.statsRepository = statsRepository;
		this.visitorStatsRepository = visitorStatsRepository;
		this.achievementRepository = achievementRepository;
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
	public MessageResult postMessage(String nickname, String content) {
		String safeNick = requireNickname(nickname);
		String safeContent = sanitize(content, 40);
		if (safeContent.isBlank()) {
			throw new IllegalArgumentException("内容不能为空");
		}

		String color = COLORS.get(ThreadLocalRandom.current().nextInt(COLORS.size()));
		GuestMessage message = messageRepository.save(new GuestMessage(safeNick, safeContent, color));

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

	public record MessageDto(Long id, String nickname, String content, String color, String createdAt) {
		public static MessageDto from(GuestMessage m) {
			return new MessageDto(
					m.getId(),
					m.getNickname(),
					m.getContent(),
					m.getColor(),
					m.getCreatedAt().toString());
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
