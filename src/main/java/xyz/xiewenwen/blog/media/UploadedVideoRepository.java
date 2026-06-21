package xyz.xiewenwen.blog.media;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UploadedVideoRepository extends JpaRepository<UploadedVideo, Long> {

	List<UploadedVideo> findTop50ByOrderByUploadedAtDesc();

	List<UploadedVideo> findTop100ByOrderByUploadedAtDesc();

	List<UploadedVideo> findByStatus(String status);
}
