package xyz.xiewenwen.blog.social;

import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "daily_stats", uniqueConstraints = @UniqueConstraint(columnNames = "statDate"))
public class DailyStats {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false)
	private LocalDate statDate;

	@Column(nullable = false)
	private int highFiveCount;

	@Column(nullable = false)
	private int moodCoding;

	@Column(nullable = false)
	private int moodSlacking;

	@Column(nullable = false)
	private int moodTea;

	@Column(nullable = false)
	private int moodDancing;

	protected DailyStats() {
	}

	public DailyStats(LocalDate statDate) {
		this.statDate = statDate;
	}

	public Long getId() {
		return id;
	}

	public LocalDate getStatDate() {
		return statDate;
	}

	public int getHighFiveCount() {
		return highFiveCount;
	}

	public void incrementHighFive() {
		this.highFiveCount++;
	}

	public int getMoodCoding() {
		return moodCoding;
	}

	public int getMoodSlacking() {
		return moodSlacking;
	}

	public int getMoodTea() {
		return moodTea;
	}

	public int getMoodDancing() {
		return moodDancing;
	}

	public void incrementMood(MoodType mood) {
		switch (mood) {
			case CODING -> moodCoding++;
			case SLACKING -> moodSlacking++;
			case TEA -> moodTea++;
			case DANCING -> moodDancing++;
		}
	}
}
