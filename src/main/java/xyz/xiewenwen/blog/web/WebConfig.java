package xyz.xiewenwen.blog.web;

import java.nio.file.Path;
import java.nio.file.Paths;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

	@Value("${blog.upload.dir:./data/uploads}")
	private String uploadDir;

	@Override
	public void addResourceHandlers(ResourceHandlerRegistry registry) {
		Path base = Paths.get(uploadDir).toAbsolutePath().normalize();
		String location = "file:" + base + "/";
		registry.addResourceHandler("/uploads/**")
				.addResourceLocations(location);
	}
}
