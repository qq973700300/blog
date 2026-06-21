#!/usr/bin/env python3
import os
import paramiko

HOST = os.environ.get("DEPLOY_HOST", "101.33.218.140")
USER = os.environ.get("DEPLOY_USER", "ubuntu")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)

for c in [
    "ss -tlnp | grep 3306 || echo 'no 3306 listener'",
    "sudo mysql -e \"SELECT user,host FROM mysql.user WHERE user='blog'\"",
    "systemctl is-active mysql",
]:
    print("===", c)
    cmd = f"echo '{PASSWORD}' | sudo -S bash -lc {repr(c)}" if "sudo" in c else c
    _, o, e = ssh.exec_command(cmd, get_pty="sudo" in c)
    print(o.read().decode())
ssh.close()
