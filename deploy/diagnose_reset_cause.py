#!/usr/bin/env python3
import os
import paramiko

HOST = os.environ.get("DEPLOY_HOST", "101.33.218.140")
USER = os.environ.get("DEPLOY_USER", "ubuntu")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")

cmds = [
    "systemctl show blog -p ActiveState -p SubState -p NRestarts --no-pager",
    "journalctl -u blog --since '6 hours ago' --no-pager | grep -E 'Started BlogApplication|Stopped|restart|Failed|Killed' | tail -40",
    "grep -c 'location @starting' /etc/nginx/sites-available/blog",
    "grep -c 'error_page 502' /etc/nginx/sites-available/blog",
    "nginx -T 2>/dev/null | grep -A2 'error_page\\|@starting' | head -30 || sudo nginx -T 2>/dev/null | grep -A2 'error_page\\|@starting' | head -30",
    "grep -E 'js/(media-url|music|boot)' /var/log/nginx/access.log 2>/dev/null | tail -15 || echo 'no access log perm'",
]

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)
for cmd in cmds:
    print("===", cmd, "===")
    full = f"echo '{PASSWORD}' | sudo -S bash -lc {repr(cmd)}"
    _, out, err = ssh.exec_command(full)
    out.channel.recv_exit_status()
    print((out.read() + err.read()).decode("utf-8", errors="replace").strip() or "(empty)")
    print()
ssh.close()
