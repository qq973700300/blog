#!/usr/bin/env python3
import json
import os
import paramiko
import time

HOST = os.environ.get("DEPLOY_HOST", "101.33.218.140")
USER = os.environ.get("DEPLOY_USER", "ubuntu")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")

time.sleep(10)
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)

cmds = [
    "curl -s http://127.0.0.1:8080/api/social/dancers",
    "curl -s http://127.0.0.1:8080/api/social/leaderboard",
    """curl -s -X POST http://127.0.0.1:8080/api/social/messages -H 'Content-Type: application/json' -d '{"nickname":"测试舞者","content":"我来领舞了"}'""",
]
for c in cmds:
    print("===", c)
    _, o, _ = ssh.exec_command(c)
    print(o.read().decode())
ssh.close()
