package xyz.xiewenwen.blog.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class PageController {

	@GetMapping("/blog")
	public String blog() {
		return "forward:/blog.html";
	}

	@GetMapping("/blog/articles/{slug}")
	public String article() {
		return "forward:/article.html";
	}

	@GetMapping("/admin")
	public String admin() {
		return "forward:/admin.html";
	}
}
