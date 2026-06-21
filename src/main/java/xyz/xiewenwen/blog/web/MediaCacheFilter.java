package xyz.xiewenwen.blog.web;

import java.io.IOException;

import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
@Order(1)
public class MediaCacheFilter implements Filter {

	@Override
	public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
			throws IOException, ServletException {
		if (request instanceof HttpServletRequest req && response instanceof HttpServletResponse res) {
			String path = req.getRequestURI();
			if (path.startsWith("/video/")) {
				// 带 ?v= 版本号，可长期缓存；换视频时改版本号即可
				res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
			}
			else if (path.startsWith("/uploads/")) {
				res.setHeader("Cache-Control", "public, max-age=86400");
			}
			else if (path.startsWith("/audio/")) {
				res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
				res.setHeader("Pragma", "no-cache");
				res.setHeader("Expires", "0");
			}
		}
		chain.doFilter(request, response);
	}
}
