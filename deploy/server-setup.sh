#!/bin/bash
set -euo pipefail

APP_DIR="/opt/blog"
SERVICE_NAME="blog"
JAR_NAME="blog.jar"
PORT=8080

echo "==> 安装 Java 17..."
sudo apt-get update -qq
sudo apt-get install -y -qq openjdk-17-jdk-headless unzip

if [ -f "/tmp/blog-project.zip" ]; then
  echo "==> 在服务器上打包项目..."
  BUILD_DIR="/tmp/blog-build"
  rm -rf "${BUILD_DIR}"
  mkdir -p "${BUILD_DIR}"
  unzip -qo /tmp/blog-project.zip -d "${BUILD_DIR}"
  cd "${BUILD_DIR}"
  chmod +x mvnw
  ./mvnw package -DskipTests -q
  cp target/blog-0.0.1-SNAPSHOT.jar "/tmp/${JAR_NAME}"
fi

echo "==> 部署目录: ${APP_DIR}"
sudo mkdir -p "${APP_DIR}"
sudo chown ubuntu:ubuntu "${APP_DIR}"

if [ -f "/tmp/${JAR_NAME}" ]; then
  mv "/tmp/${JAR_NAME}" "${APP_DIR}/${JAR_NAME}"
  chmod 644 "${APP_DIR}/${JAR_NAME}"
else
  echo "错误: 未找到 JAR 文件"
  exit 1
fi

echo "==> 配置 systemd 服务..."
sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null <<EOF
[Unit]
Description=Blog Spring Boot Application
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/java -jar ${APP_DIR}/${JAR_NAME}
Restart=on-failure
RestartSec=10
SuccessExitStatus=143

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable ${SERVICE_NAME}
sudo systemctl restart ${SERVICE_NAME}

echo "==> 检查防火墙端口 ${PORT}..."
if command -v ufw >/dev/null 2>&1 && sudo ufw status | grep -q "Status: active"; then
  sudo ufw allow ${PORT}/tcp || true
fi

echo "==> 服务状态:"
sudo systemctl status ${SERVICE_NAME} --no-pager || true

echo ""
echo "部署完成! 访问: http://$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'):${PORT}/"
