#!/usr/bin/env python3
import os
import paramiko

HOST = os.environ.get("DEPLOY_HOST", "101.33.218.140")
USER = os.environ.get("DEPLOY_USER", "ubuntu")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")


def run(ssh, cmd):
    _, stdout, _ = ssh.exec_command(cmd, get_pty=True)
    stdout.channel.recv_exit_status()
    return stdout.read().decode("utf-8", errors="replace")


def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    db_pass = os.environ.get("DB_PASSWORD", "")
    queries = [
        f"mysql -u blog -p'{db_pass}' blog -e \"SELECT id, LEFT(original_filename,40), status, LEFT(COALESCE(status_message,''),50), size_bytes FROM uploaded_videos ORDER BY id DESC LIMIT 10;\"",
        "ps aux | grep ffmpeg | grep -v grep || echo 'no ffmpeg'",
        "journalctl -u blog -n 50 --no-pager | tail -50",
        "ls -lah /home/ubuntu/blog/data/uploads/incoming/ || true",
        "ls -lah /home/ubuntu/blog/data/uploads/videos/ | tail -15 || true",
    ]
    for q in queries:
        print("===", q[:70], "===")
        print(run(ssh, q))
    ssh.close()


if __name__ == "__main__":
    main()
