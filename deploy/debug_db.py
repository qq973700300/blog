#!/usr/bin/env python3
import os
import paramiko

HOST = os.environ.get("DEPLOY_HOST", "101.33.218.140")
USER = os.environ.get("DEPLOY_USER", "ubuntu")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")
DB_PASS = os.environ.get("DB_PASSWORD", "")

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)

cmds = [
    "grep -E 'DB_|Environment' /etc/systemd/system/blog.service",
    "journalctl -u blog -n 80 --no-pager | grep -iE 'error|exception|access|denied|Communications' | tail -15",
    f"mysql -u blog -p'{DB_PASS}' -e 'SELECT 1'",
    "sudo mysql -e \"SELECT user,host,plugin FROM mysql.user WHERE user='blog'\"",
]
for c in cmds:
    print("===", c)
    full = f"echo '{PASSWORD}' | sudo -S bash -lc {repr(c)}" if c.startswith("sudo") else c
    _, o, e = ssh.exec_command(full, get_pty=bool(c.startswith("sudo")))
    print(o.read().decode())
    err = e.read().decode()
    if err:
        print(err)
ssh.close()
