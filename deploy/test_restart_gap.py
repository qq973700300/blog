#!/usr/bin/env python3
import os
import time
import paramiko

HOST = os.environ.get("DEPLOY_HOST", "101.33.218.140")
USER = os.environ.get("DEPLOY_USER", "ubuntu")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)

print("Restarting blog service...")
_, out, err = ssh.exec_command("sudo systemctl restart blog")
out.channel.recv_exit_status()

for i in range(12):
    time.sleep(0.5)
    _, out, _ = ssh.exec_command(
        "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/ ; "
        "curl -s -o /dev/null -w ' %{http_code}' https://xiewenwen.xyz/"
    )
    out.channel.recv_exit_status()
    result = out.read().decode().strip()
    print(f"t+{(i+1)*0.5:.1f}s  local/https: {result}")

ssh.close()
