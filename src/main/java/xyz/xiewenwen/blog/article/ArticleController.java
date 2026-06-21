package xyz.xiewenwen.blog.article;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/articles")
public class ArticleController {

	private final ArticleService articleService;

	public ArticleController(ArticleService articleService) {
		this.articleService = articleService;
	}

	@GetMapping
	public List<ArticleService.ArticleSummaryDto> list() {
		return articleService.listPublished();
	}

	@GetMapping("/{slug}")
	public ArticleService.ArticleDetailDto detail(@PathVariable String slug) {
		return articleService.getBySlug(slug);
	}
}
