#!/usr/bin/env python3
import os
import paramiko

HOST = os.environ.get("DEPLOY_HOST", "101.33.218.140")
USER = os.environ.get("DEPLOY_USER", "ubuntu")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")

cmds = [
    "journalctl -u blog --since '24 hours ago' | grep -E 'ERROR|Failed|Exception|Started BlogApplication|Stopped|restart' | tail -30",
    "journalctl -u nginx --since '24 hours ago' | grep -E 'error|502|upstream' | tail -20",
    "systemctl show blog -p After,Requires,Wants,Restart,RestartUSec",
    "uptime",
    "last reboot | head -3",
]

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)
try:
    for cmd in cmds:
        print(f"\n=== {cmd} ===")
        _, out, err = ssh.exec_command(cmd)
        out.channel.recv_exit_status()
        print((out.read() + err.read()).decode("utf-8", errors="replace").strip())
finally:
    ssh.close()
