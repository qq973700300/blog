#!/usr/bin/env python3
import os
import paramiko

HOST = "101.33.218.140"
USER = "ubuntu"
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")
DOMAIN = os.environ.get("DEPLOY_DOMAIN", "xiewenwen.xyz")

NGINX_CONF = f"""server {{
    listen 80;
    listen [::]:80;
    server_name {DOMAIN} www.{DOMAIN};

    location / {{
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}
}}
"""


def run(ssh, cmd):
    full = f"echo '{PASSWORD}' | sudo -S bash -lc {repr(cmd)}"
    _, stdout, stderr = ssh.exec_command(full, get_pty=True)
    code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    print(f"=== {cmd} (exit {code}) ===")
    print(out[-3000:] if len(out) > 3000 else out)
    if err.strip():
        print("ERR:", err[-800:])
    return code


def main():
    if not PASSWORD:
        print("Set DEPLOY_PASSWORD environment variable.")
        return 1

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    run(
        ssh,
        "DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx",
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
    run(ssh, "nginx -t && systemctl restart nginx")

    run(
        ssh,
        f"certbot --nginx -d {DOMAIN} -d www.{DOMAIN} "
        f"--non-interactive --agree-tos --register-unsafely-without-email --redirect",
    )

    run(ssh, f"curl -s -I https://{DOMAIN}/ | head -8")
    run(ssh, "systemctl status certbot.timer --no-pager | head -5")
    ssh.close()
    print(f"Done: https://{DOMAIN}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
