#!/usr/bin/env python3
"""Install MySQL and create blog database on Ubuntu server."""

import os
import paramiko

HOST = "101.33.218.140"
USER = "ubuntu"
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")
DB_NAME = "blog"
DB_USER = "blog"
DB_PASS = os.environ.get("DB_PASSWORD", "")


def run(ssh, cmd):
    full = f"echo '{PASSWORD}' | sudo -S bash -lc {repr(cmd)}"
    _, stdout, stderr = ssh.exec_command(full, get_pty=True)
    code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    print(f"=== {cmd} (exit {code}) ===")
    print(out[-2500:] if len(out) > 2500 else out)
    if err.strip():
        print("ERR:", err[-500:])
    return code


def main():
    if not PASSWORD:
        print("Set DEPLOY_PASSWORD")
        return 1

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    run(
        ssh,
        "DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server",
    )
    sql = f"""
CREATE DATABASE IF NOT EXISTS {DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '{DB_USER}'@'localhost' IDENTIFIED BY '{DB_PASS}';
GRANT ALL PRIVILEGES ON {DB_NAME}.* TO '{DB_USER}'@'localhost';
FLUSH PRIVILEGES;
"""
    sftp = ssh.open_sftp()
    with sftp.file("/tmp/blog_init.sql", "w") as f:
        f.write(sql)
    sftp.close()

    run(ssh, "mysql < /tmp/blog_init.sql")
    run(ssh, "systemctl enable mysql && systemctl start mysql")
    print(f"MySQL ready: db={DB_NAME} user={DB_USER}")
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
