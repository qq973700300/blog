#!/usr/bin/env python3
import os
import paramiko
import time

HOST = os.environ.get("DEPLOY_HOST", "101.33.218.140")
USER = os.environ.get("DEPLOY_USER", "ubuntu")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")
DB_PASS = os.environ.get("DB_PASSWORD", "")

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)
time.sleep(12)

cmds = [
    "journalctl -u blog -n 30 --no-pager",
    "curl -s http://127.0.0.1:8080/api/social/stats",
    f"mysql -u blog -p'{DB_PASS}' -e 'SHOW TABLES FROM blog'",
]
for c in cmds:
    print("===", c)
    _, o, e = ssh.exec_command(c)
    print(o.read().decode())
    err = e.read().decode()
    if err:
        print(err)
ssh.close()
