package xyz.xiewenwen.blog.admin;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class AdminAuthService {

	private final String adminPassword;

	public AdminAuthService(@Value("${blog.admin.password:}") String adminPassword) {
		this.adminPassword = adminPassword != null ? adminPassword : "";
	}

	public boolean isConfigured() {
		return !adminPassword.isBlank();
	}

	public boolean verify(String password) {
		if (!isConfigured() || password == null) {
			return false;
		}
		return adminPassword.equals(password);
	}
}
