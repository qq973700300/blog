#!/usr/bin/env python3
import os
import paramiko

HOST = os.environ.get("DEPLOY_HOST", "101.33.218.140")
USER = os.environ.get("DEPLOY_USER", "ubuntu")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")

cmds = [
    "systemctl is-active blog nginx",
    "ss -tlnp | grep -E ':443|:8080|:80'",
    "curl -s -o /dev/null -w '8080 dance.js: %{http_code} size=%{size_download}\\n' http://127.0.0.1:8080/js/dance.js",
    "curl -s -o /dev/null -w '443 dance.js: %{http_code} size=%{size_download}\\n' -k https://127.0.0.1/js/dance.js -H 'Host: xiewenwen.xyz'",
    "curl -s -o /dev/null -w 'ext dance.js: %{http_code}\\n' https://xiewenwen.xyz/js/dance.js",
    "curl -s -o /dev/null -w 'ext home: %{http_code}\\n' https://xiewenwen.xyz/",
    "journalctl -u blog -n 20 --no-pager",
    "tail -20 /var/log/nginx/error.log 2>/dev/null || echo 'no nginx error log'",
    "free -h",
    "df -h /",
]

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)
try:
    for cmd in cmds:
        print("===", cmd)
        _, out, err = ssh.exec_command(cmd)
        out.channel.recv_exit_status()
        text = (out.read() + err.read()).decode("utf-8", errors="replace")
        print(text.strip() or "(empty)")
        print()
finally:
    ssh.close()
