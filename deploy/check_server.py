#!/usr/bin/env python3
import os
import paramiko

HOST = os.environ.get("DEPLOY_HOST", "101.33.218.140")
USER = os.environ.get("DEPLOY_USER", "ubuntu")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")

cmds = [
    "systemctl is-active blog",
    "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/",
    "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/blog",
    "curl -s http://127.0.0.1:8080/api/articles | head -c 500",
    "journalctl -u blog -n 20 --no-pager",
]

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)
try:
    for cmd in cmds:
        print(f"=== {cmd} ===")
        _, out, err = ssh.exec_command(cmd)
        out.channel.recv_exit_status()
        text = (out.read() + err.read()).decode("utf-8", errors="replace")
        print(text.strip() or "(empty)")
        print()
finally:
    ssh.close()
