#!/usr/bin/env python3
"""One-shot deploy script for Tencent Cloud Ubuntu server."""

import os
import sys
import time
import zipfile
from pathlib import Path

import paramiko

HOST = os.environ.get("DEPLOY_HOST", "101.33.218.140")
USER = os.environ.get("DEPLOY_USER", "ubuntu")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")
PORT = int(os.environ.get("DEPLOY_PORT", "22"))
APP_DIR = "/home/ubuntu/blog"
SERVICE_NAME = "blog"

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ZIP_PATH = PROJECT_ROOT / "deploy" / "blog-src.zip"

UPLOAD_NAMES = [
    "pom.xml",
    "mvnw",
    "mvnw.cmd",
    ".mvn",
    "src",
    ".gitattributes",
]


def log(msg: str) -> None:
    print(msg, flush=True)


def run(ssh: paramiko.SSHClient, cmd: str, sudo: bool = False) -> tuple[int, str, str]:
    if sudo:
        cmd = f"echo '{PASSWORD}' | sudo -S bash -lc {repr(cmd)}"
    stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    return exit_code, out, err


def make_zip() -> None:
    ZIP_PATH.parent.mkdir(parents=True, exist_ok=True)
    if ZIP_PATH.exists():
        ZIP_PATH.unlink()

    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as zf:
        for name in UPLOAD_NAMES:
            path = PROJECT_ROOT / name
            if not path.exists():
                continue
            if path.is_dir():
                for file in path.rglob("*"):
                    if file.is_file() and "target" not in file.parts:
                        arc = file.relative_to(PROJECT_ROOT).as_posix()
                        zf.write(file, arc)
            else:
                zf.write(path, name)


def upload(ssh: paramiko.SSHClient) -> None:
    sftp = ssh.open_sftp()
    try:
        run(ssh, f"mkdir -p {APP_DIR}")
        remote_zip = f"{APP_DIR}/blog-src.zip"
        log(f"Uploading {ZIP_PATH.name} ...")
        sftp.put(str(ZIP_PATH), remote_zip)
        run(ssh, f"cd {APP_DIR} && rm -rf src/main/java/com src/test/java/com target")
        run(ssh, f"cd {APP_DIR} && unzip -o blog-src.zip && rm -f blog-src.zip")
    finally:
        sftp.close()


def wait_for_health(ssh: paramiko.SSHClient, timeout: int = 90) -> None:
    log("Waiting for app to become ready ...")
    deadline = time.time() + timeout
    while time.time() < deadline:
        code, out, err = run(
            ssh,
            "curl -s -o /dev/null -w '%{http_code}' "
            "http://127.0.0.1:8080/actuator/health/readiness || "
            "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/ || true",
        )
        status = out.strip()
        if status == "200":
            log("App is ready (HTTP 200).")
            return
        time.sleep(2)
    raise RuntimeError("App did not become ready within timeout.")


def deploy(ssh: paramiko.SSHClient) -> None:
    log("Checking server environment ...")
    code, out, err = run(ssh, "uname -a && free -h | head -2")
    log(out.strip())

    code, out, err = run(ssh, "java -version 2>&1 || true")
    if "version" not in out.lower() and "version" not in err.lower():
        log("Installing OpenJDK 17 ...")
        code, out, err = run(
            ssh,
            "apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y openjdk-17-jdk unzip",
            sudo=True,
        )
        if code != 0:
            raise RuntimeError(f"JDK install failed:\n{out}\n{err}")
    else:
        log("Java already installed.")
        run(ssh, "DEBIAN_FRONTEND=noninteractive apt-get install -y unzip", sudo=True)

    code, out, err = run(ssh, "ffmpeg -version 2>&1 | head -1 || true")
    if "ffmpeg version" not in out.lower():
        log("Installing FFmpeg ...")
        code, out, err = run(
            ssh,
            "DEBIAN_FRONTEND=noninteractive apt-get install -y ffmpeg",
            sudo=True,
        )
        if code != 0:
            raise RuntimeError(f"FFmpeg install failed:\n{out}\n{err}")
    else:
        log("FFmpeg already installed.")

    log("Building project on server ...")
    build_cmd = (
        f"cd {APP_DIR} && chmod +x mvnw && ./mvnw -q package -DskipTests"
    )
    code, out, err = run(ssh, build_cmd, sudo=False)
    if code != 0:
        raise RuntimeError(f"Build failed:\n{out}\n{err}")
    log("Build succeeded.")

    code, out, err = run(ssh, f"ls -1 {APP_DIR}/target/*.jar")
    jar_name = [line.strip() for line in out.splitlines() if line.strip().endswith(".jar") and "original" not in line][-1]
    jar_path = jar_name if jar_name.startswith("/") else f"{APP_DIR}/target/{jar_name.split('/')[-1]}"
    log(f"JAR: {jar_path}")

    db_pass = os.environ.get("DB_PASSWORD", "")
    admin_pass = os.environ.get("BLOG_ADMIN_PASSWORD", PASSWORD)
    db_url = "jdbc:mysql://localhost:3306/blog?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai&characterEncoding=utf8"
    service = f"""[Unit]
Description=Blog Spring Boot App
After=network-online.target mysql.service
Requires=mysql.service
Wants=network-online.target

[Service]
Type=notify
NotifyAccess=main
User=ubuntu
WorkingDirectory={APP_DIR}
Environment="DB_URL={db_url}"
Environment="DB_USER=blog"
Environment="DB_PASSWORD={db_pass}"
Environment="BLOG_ADMIN_PASSWORD={admin_pass}"
ExecStartPre=/bin/bash -c 'for i in $(seq 1 60); do mysqladmin ping --protocol=TCP -h127.0.0.1 --silent 2>/dev/null && exit 0; sleep 1; done; exit 1'
ExecStart=/usr/bin/java -jar {jar_path}
Restart=on-failure
RestartSec=5
TimeoutStartSec=120
TimeoutStopSec=300
SuccessExitStatus=143

[Install]
WantedBy=multi-user.target
"""

    sftp = ssh.open_sftp()
    local_service = PROJECT_ROOT / "deploy" / "blog.service"
    local_service.write_text(service, encoding="utf-8")
    sftp.put(str(local_service), "/tmp/blog.service")
    sftp.close()

    log("Installing systemd service ...")
    run(ssh, "cp /tmp/blog.service /etc/systemd/system/blog.service", sudo=True)
    run(ssh, "systemctl daemon-reload && systemctl enable blog && systemctl restart blog", sudo=True)
    wait_for_health(ssh)

    code, out, err = run(ssh, "systemctl is-active blog && ss -tlnp | grep 8080 || true")
    log(out.strip() or err.strip())

    code, out, err = run(ssh, "curl -s -o /dev/null -w '%{http_code}' https://xiewenwen.xyz/ || true")
    log(f"HTTPS health check: {out.strip()}")


def main() -> int:
    if not PASSWORD:
        log("Set DEPLOY_PASSWORD environment variable.")
        return 1

    make_zip()
    log(f"Created package: {ZIP_PATH}")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    log(f"Connecting to {USER}@{HOST} ...")
    ssh.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)

    try:
        upload(ssh)
        deploy(ssh)
        log(f"Deploy complete: http://{HOST}:8080/")
        return 0
    finally:
        ssh.close()


if __name__ == "__main__":
    sys.exit(main())
