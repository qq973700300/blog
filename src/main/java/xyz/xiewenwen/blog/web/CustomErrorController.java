package xyz.xiewenwen.blog.web;

import org.springframework.boot.webmvc.error.ErrorController;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.servlet.ModelAndView;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;

@Controller
public class CustomErrorController implements ErrorController {

	@RequestMapping("/error")
	public ModelAndView handleError(HttpServletRequest request) {
		HttpStatus status = HttpStatus.NOT_FOUND;
		Object code = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
		if (code != null) {
			try {
				status = HttpStatus.valueOf(Integer.parseInt(code.toString()));
			}
			catch (RuntimeException ignored) {
				// keep NOT_FOUND
			}
		}
		if (!status.is4xxClientError() && !status.is5xxServerError()) {
			status = HttpStatus.NOT_FOUND;
		}
		return new ModelAndView("forward:/404.html", status);
	}
}
