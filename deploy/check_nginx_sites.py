#!/usr/bin/env python3
import os
import paramiko

HOST = os.environ.get("DEPLOY_HOST", "101.33.218.140")
USER = os.environ.get("DEPLOY_USER", "ubuntu")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)
for cmd in [
    "ls -la /etc/nginx/sites-enabled/",
    "grep -l error_page /etc/nginx/sites-enabled/* 2>/dev/null | xargs -I{} sh -c 'echo FILE:{}; grep -c @starting {}; grep error_page {}'",
    "curl -s -o /dev/null -w 'dance.js:%{http_code} ' https://xiewenwen.xyz/js/dance.js",
    "curl -s -o /dev/null -w 'home:%{http_code}' https://xiewenwen.xyz/",
    "systemctl is-active blog",
]:
    _, o, _ = ssh.exec_command(cmd)
    o.channel.recv_exit_status()
    print(o.read().decode())
ssh.close()
