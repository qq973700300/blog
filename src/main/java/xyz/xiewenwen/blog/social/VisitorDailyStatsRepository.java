package xyz.xiewenwen.blog.social;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface VisitorDailyStatsRepository extends JpaRepository<VisitorDailyStats, Long> {

	Optional<VisitorDailyStats> findByStatDateAndNickname(LocalDate statDate, String nickname);

	List<VisitorDailyStats> findTop5ByStatDateOrderByMessageCountDescHighFiveCountDesc(LocalDate statDate);

	List<VisitorDailyStats> findTop5ByStatDateOrderByHighFiveCountDescMessageCountDesc(LocalDate statDate);
}
