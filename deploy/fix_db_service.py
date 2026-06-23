#!/usr/bin/env python3
import os
import paramiko
import time

HOST = os.environ.get("DEPLOY_HOST", "101.33.218.140")
USER = os.environ.get("DEPLOY_USER", "ubuntu")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")
DB_PASS = os.environ.get("DB_PASSWORD", "Blog@2026Xie")


def main() -> int:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    path = "/etc/systemd/system/blog.service"
    _, stdout, _ = ssh.exec_command(f"cat {path}", get_pty=True)
    text = stdout.read().decode("utf-8", errors="replace")
    lines = []
    for line in text.splitlines():
        if line.startswith('Environment="DB_PASSWORD='):
            lines.append(f'Environment="DB_PASSWORD={DB_PASS}"')
        else:
            lines.append(line)
    patched = "\n".join(lines) + "\n"

    sftp = ssh.open_sftp()
    with sftp.file("/tmp/blog.service", "w") as f:
        f.write(patched)
    sftp.close()

    for cmd in (
        "sudo cp /tmp/blog.service /etc/systemd/system/blog.service",
        "sudo systemctl daemon-reload",
        "sudo systemctl restart blog",
    ):
        ssh.exec_command(cmd, get_pty=True)[1].read()

    time.sleep(15)
    _, out, _ = ssh.exec_command(
        "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/blog && "
        "curl -s -o /dev/null -w ' %{http_code}' http://127.0.0.1:8080/images/blog-bg.png"
    )
    print("HTTP:", out.read().decode().strip())
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
