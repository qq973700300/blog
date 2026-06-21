package xyz.xiewenwen.blog.social;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UserAchievementRepository extends JpaRepository<UserAchievement, Long> {

	boolean existsByNicknameAndAchievementKey(String nickname, AchievementKey achievementKey);

	List<UserAchievement> findByNicknameOrderByUnlockedAtDesc(String nickname);

	Optional<UserAchievement> findByNicknameAndAchievementKey(String nickname, AchievementKey achievementKey);
}
