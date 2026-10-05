package xyz.xiewenwen.blog.social;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "guest_messages")
public class GuestMessage {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, length = 12)
	private String nickname;

	@Column(nullable = false, length = 40)
	private String content;

	@Column(nullable = false, length = 16)
	private String color;

	@Column(nullable = true, length = 255)
	private String imageUrl;

	@Column(nullable = true, length = 255)
	private String voiceUrl;

	@Column(nullable = false)
	private LocalDateTime createdAt;

	protected GuestMessage() {
	}

	public GuestMessage(String nickname, String content, String color) {
		this(nickname, content, color, null, null);
	}

	public GuestMessage(String nickname, String content, String color, String imageUrl, String voiceUrl) {
		this.nickname = nickname;
		this.content = content;
		this.color = color;
		this.imageUrl = imageUrl;
		this.voiceUrl = voiceUrl;
		this.createdAt = LocalDateTime.now();
	}

	public Long getId() {
		return id;
	}

	public String getNickname() {
		return nickname;
	}

	public String getContent() {
		return content;
	}

	public String getColor() {
		return color;
	}

	public String getImageUrl() {
		return imageUrl;
	}

	public String getVoiceUrl() {
		return voiceUrl;
	}

	public LocalDateTime getCreatedAt() {
		return createdAt;
	}
}
