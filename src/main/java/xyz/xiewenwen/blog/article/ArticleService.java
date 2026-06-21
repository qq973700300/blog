package xyz.xiewenwen.blog.article;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ArticleService {

	private final ArticleRepository articleRepository;

	public ArticleService(ArticleRepository articleRepository) {
		this.articleRepository = articleRepository;
	}

	@Transactional(readOnly = true)
	public List<ArticleSummaryDto> listPublished() {
		return articleRepository.findByPublishedTrueOrderByPublishedAtDesc().stream()
				.map(ArticleSummaryDto::from)
				.toList();
	}

	@Transactional(readOnly = true)
	public ArticleDetailDto getBySlug(String slug) {
		Article article = articleRepository.findBySlugAndPublishedTrue(slug)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "文章不存在"));
		return ArticleDetailDto.from(article);
	}

	public record ArticleSummaryDto(
			Long id,
			String title,
			String slug,
			String summary,
			String accentColor,
			String publishedAt) {

		static ArticleSummaryDto from(Article article) {
			return new ArticleSummaryDto(
					article.getId(),
					article.getTitle(),
					article.getSlug(),
					article.getSummary(),
					article.getAccentColor(),
					article.getPublishedAt().toLocalDate().toString());
		}
	}

	public record ArticleDetailDto(
			Long id,
			String title,
			String slug,
			String summary,
			String content,
			String accentColor,
			String publishedAt) {

		static ArticleDetailDto from(Article article) {
			return new ArticleDetailDto(
					article.getId(),
					article.getTitle(),
					article.getSlug(),
					article.getSummary(),
					article.getContent(),
					article.getAccentColor(),
					article.getPublishedAt().toLocalDate().toString());
		}
	}
}
