package xyz.xiewenwen.blog.social;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface GuestMessageRepository extends JpaRepository<GuestMessage, Long> {

	List<GuestMessage> findTop30ByOrderByCreatedAtDesc();

	List<GuestMessage> findTop6ByOrderByCreatedAtDesc();

	List<GuestMessage> findTop3ByOrderByCreatedAtDesc();

	List<GuestMessage> findTop200ByOrderByCreatedAtDesc();

	long countByNickname(String nickname);
}
