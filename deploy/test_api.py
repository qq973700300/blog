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
    "curl -s http://127.0.0.1:8080/api/social/stats",
    "curl -s -X POST http://127.0.0.1:8080/api/social/high-five",
    "journalctl -u blog -n 20 --no-pager | grep -iE 'error|exception' | tail -8",
]
for c in cmds:
    print("===", c)
    _, o, _ = ssh.exec_command(c)
    print(o.read().decode())
ssh.close()
