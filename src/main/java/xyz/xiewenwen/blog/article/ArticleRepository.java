package xyz.xiewenwen.blog.article;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ArticleRepository extends JpaRepository<Article, Long> {

	List<Article> findByPublishedTrueOrderByPublishedAtDesc();

	Optional<Article> findBySlugAndPublishedTrue(String slug);

	boolean existsBySlug(String slug);

	long countByPublishedTrue();
}
