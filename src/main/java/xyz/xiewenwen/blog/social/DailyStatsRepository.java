package xyz.xiewenwen.blog.social;

import java.time.LocalDate;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DailyStatsRepository extends JpaRepository<DailyStats, Long> {

	Optional<DailyStats> findByStatDate(LocalDate statDate);
}
