package xyz.xiewenwen.blog.social;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "user_achievements", uniqueConstraints = @UniqueConstraint(columnNames = { "nickname", "achievementKey" }))
public class UserAchievement {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, length = 12)
	private String nickname;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 24)
	private AchievementKey achievementKey;

	@Column(nullable = false)
	private LocalDateTime unlockedAt;

	protected UserAchievement() {
	}

	public UserAchievement(String nickname, AchievementKey achievementKey) {
		this.nickname = nickname;
		this.achievementKey = achievementKey;
		this.unlockedAt = LocalDateTime.now();
	}

	public String getNickname() {
		return nickname;
	}

	public AchievementKey getAchievementKey() {
		return achievementKey;
	}

	public LocalDateTime getUnlockedAt() {
		return unlockedAt;
	}
}
