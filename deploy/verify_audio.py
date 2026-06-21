#!/usr/bin/env python3
import os
import paramiko

HOST = os.environ.get("DEPLOY_HOST", "101.33.218.140")
USER = os.environ.get("DEPLOY_USER", "ubuntu")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")

cmds = [
    "curl -s -o /dev/null -w '%{http_code}' https://xiewenwen.xyz/",
    "grep -c bgm-audio /home/ubuntu/blog/src/main/resources/static/index.html",
    "grep -c '?v=4' /home/ubuntu/blog/src/main/resources/static/index.html",
    "grep -c tryPlayMp3Sync /home/ubuntu/blog/src/main/resources/static/js/music.js",
    "grep -c pointerup /home/ubuntu/blog/src/main/resources/static/js/dance.js",
]

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)
try:
    for cmd in cmds:
        _, out, err = ssh.exec_command(cmd)
        out.channel.recv_exit_status()
        print(f"{cmd} => {(out.read() + err.read()).decode().strip()}")
finally:
    ssh.close()
