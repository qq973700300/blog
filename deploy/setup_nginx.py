#!/usr/bin/env python3
import os
import paramiko

HOST = "101.33.218.140"
USER = "ubuntu"
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")

NGINX_CONF = """server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
"""


def run(ssh, cmd):
    full = f"echo '{PASSWORD}' | sudo -S bash -lc {repr(cmd)}"
    _, stdout, stderr = ssh.exec_command(full, get_pty=True)
    code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    print(f"=== {cmd} (exit {code}) ===")
    print(out)
    if err.strip():
        print("ERR:", err)
    return code


def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    run(
        ssh,
        "DEBIAN_FRONTEND=noninteractive apt-get install -y nginx",
    )

    sftp = ssh.open_sftp()
    with sftp.file("/tmp/blog.nginx", "w") as f:
        f.write(NGINX_CONF)
    sftp.close()

    run(
        ssh,
        "cp /tmp/blog.nginx /etc/nginx/sites-available/blog && "
        "ln -sf /etc/nginx/sites-available/blog /etc/nginx/sites-enabled/blog && "
        "rm -f /etc/nginx/sites-enabled/default",
    )
    run(ssh, "nginx -t && systemctl enable nginx && systemctl restart nginx")
    run(ssh, "curl -s -I http://127.0.0.1/ | head -5")
    run(ssh, "ss -tlnp")
    ssh.close()


if __name__ == "__main__":
    main()
