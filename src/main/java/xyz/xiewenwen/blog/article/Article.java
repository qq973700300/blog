package xyz.xiewenwen.blog.article;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

@Entity
@Table(name = "articles")
public class Article {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, length = 120)
	private String title;

	@Column(nullable = false, unique = true, length = 80)
	private String slug;

	@Column(nullable = false, length = 200)
	private String summary;

	@Lob
	@Column(nullable = false, columnDefinition = "TEXT")
	private String content;

	@Column(nullable = false, length = 16)
	private String accentColor;

	@Column(nullable = false)
	private boolean published;

	@Column(nullable = false)
	private LocalDateTime publishedAt;

	@Column(nullable = false)
	private LocalDateTime createdAt;

	protected Article() {
	}

	public Article(String title, String slug, String summary, String content, String accentColor) {
		this.title = title;
		this.slug = slug;
		this.summary = summary;
		this.content = content;
		this.accentColor = accentColor;
		this.published = true;
		this.publishedAt = LocalDateTime.now();
		this.createdAt = LocalDateTime.now();
	}

	public Long getId() {
		return id;
	}

	public String getTitle() {
		return title;
	}

	public void setTitle(String title) {
		this.title = title;
	}

	public String getSlug() {
		return slug;
	}

	public String getSummary() {
		return summary;
	}

	public String getContent() {
		return content;
	}

	public void setContent(String content) {
		this.content = content;
	}

	public String getAccentColor() {
		return accentColor;
	}

	public boolean isPublished() {
		return published;
	}

	public LocalDateTime getPublishedAt() {
		return publishedAt;
	}

	public LocalDateTime getCreatedAt() {
		return createdAt;
	}
}
