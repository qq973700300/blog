package xyz.xiewenwen.blog.media;

import java.util.concurrent.Executor;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
@EnableAsync
public class VideoAsyncConfig {

	@Bean(name = "videoCompressExecutor")
	Executor videoCompressExecutor() {
		ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
		executor.setCorePoolSize(1);
		executor.setMaxPoolSize(1);
		executor.setQueueCapacity(100);
		executor.setThreadNamePrefix("video-compress-");
		executor.initialize();
		return executor;
	}
}
