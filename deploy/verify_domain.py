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
    "ss -tlnp",
    "curl -s -I https://xiewenwen.xyz/ | head -8",
    "curl -s -I http://xiewenwen.xyz/ | head -5",
]
for c in cmds:
    print("===", c)
    _, o, _ = ssh.exec_command(c)
    print(o.read().decode())
ssh.close()
