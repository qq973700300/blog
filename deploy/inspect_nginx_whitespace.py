#!/usr/bin/env python3
"""Inspect line endings and blank-line pattern in nginx blog config."""
import os
import paramiko

HOST = os.environ.get("DEPLOY_HOST", "101.33.218.140")
USER = os.environ.get("DEPLOY_USER", "ubuntu")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)

cmds = [
    "file /etc/nginx/sites-available/blog",
    "wc -l /etc/nginx/sites-available/blog",
    "grep -cve '^[[:space:]]*$' /etc/nginx/sites-available/blog || true",
    "grep -c '^[[:space:]]*$' /etc/nginx/sites-available/blog || true",
    "head -c 200 /etc/nginx/sites-available/blog | od -An -tx1",
    "sed -n '1,25p' /etc/nginx/sites-available/blog | cat -A",
]

for cmd in cmds:
    print("===", cmd, "===")
    full = f"echo '{PASSWORD}' | sudo -S bash -lc {repr(cmd)}"
    _, out, err = ssh.exec_command(full)
    out.channel.recv_exit_status()
    print((out.read() + err.read()).decode("utf-8", errors="replace").strip())
    print()

ssh.close()
