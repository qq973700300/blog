#!/usr/bin/env python3
import os
import paramiko

HOST = os.environ.get("DEPLOY_HOST", "101.33.218.140")
USER = os.environ.get("DEPLOY_USER", "ubuntu")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")

cmds = [
    "systemctl is-active blog nginx mysql",
    "systemctl show blog -p NRestarts,ActiveEnterTimestamp,Result",
    "journalctl -u blog -n 40 --no-pager",
    "curl -s -o /dev/null -w 'local8080:%{http_code} time:%{time_total}\n' http://127.0.0.1:8080/",
    "curl -s -o /dev/null -w 'https:%{http_code} time:%{time_total}\n' https://xiewenwen.xyz/",
    "cat /etc/nginx/sites-enabled/blog 2>/dev/null || cat /etc/nginx/sites-enabled/default 2>/dev/null | head -60",
    "grep -r xiewenwen /etc/nginx/ 2>/dev/null | head -20",
]

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)
try:
    for cmd in cmds:
        print(f"\n=== {cmd} ===")
        _, out, err = ssh.exec_command(cmd)
        out.channel.recv_exit_status()
        text = (out.read() + err.read()).decode("utf-8", errors="replace")
        print(text.strip() or "(empty)")
finally:
    ssh.close()
