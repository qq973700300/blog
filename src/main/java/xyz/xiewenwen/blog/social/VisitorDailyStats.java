package xyz.xiewenwen.blog.social;

import java.time.LocalDate;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "visitor_daily_stats", uniqueConstraints = @UniqueConstraint(columnNames = { "statDate", "nickname" }))
public class VisitorDailyStats {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false)
	private LocalDate statDate;

	@Column(nullable = false, length = 12)
	private String nickname;

	@Column(nullable = false)
	private int highFiveCount;

	@Column(nullable = false)
	private int messageCount;

	protected VisitorDailyStats() {
	}

	public VisitorDailyStats(LocalDate statDate, String nickname) {
		this.statDate = statDate;
		this.nickname = nickname;
	}

	public String getNickname() {
		return nickname;
	}

	public int getHighFiveCount() {
		return highFiveCount;
	}

	public int getMessageCount() {
		return messageCount;
	}

	public void incrementHighFive() {
		this.highFiveCount++;
	}

	public void incrementMessage() {
		this.messageCount++;
	}

	public int score() {
		return messageCount * 2 + highFiveCount;
	}
}
