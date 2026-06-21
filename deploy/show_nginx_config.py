#!/usr/bin/env python3
import os
import paramiko

HOST = os.environ.get("DEPLOY_HOST", "101.33.218.140")
USER = os.environ.get("DEPLOY_USER", "ubuntu")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)

cmds = [
    "nginx -V 2>&1 | head -1",
    "nginx -t 2>&1",
    "ls -la /etc/nginx/",
    "ls -la /etc/nginx/sites-enabled/",
    "ls -la /etc/nginx/sites-available/",
    "readlink -f /etc/nginx/sites-enabled/blog",
    "wc -l /etc/nginx/sites-available/blog",
    "grep -n 'server_name\\|listen\\|proxy_pass\\|@starting' /etc/nginx/sites-available/blog",
]

for cmd in cmds:
    print("===", cmd, "===")
    _, out, err = ssh.exec_command(cmd)
    out.channel.recv_exit_status()
    print((out.read() + err.read()).decode().strip() or "(empty)")
    print()

_, out, _ = ssh.exec_command("cat /etc/nginx/sites-available/blog")
out.channel.recv_exit_status()
print("=== FULL /etc/nginx/sites-available/blog ===")
print(out.read().decode())

ssh.close()
