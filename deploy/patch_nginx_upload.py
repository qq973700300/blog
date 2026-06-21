#!/usr/bin/env python3
"""Set client_max_body_size and upload timeouts on nginx blog config."""
import os
import re
import paramiko

HOST = os.environ.get("DEPLOY_HOST", "101.33.218.140")
USER = os.environ.get("DEPLOY_USER", "ubuntu")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")
MAX_BODY = "500M"


def run(ssh, cmd, sudo=False):
    if sudo:
        cmd = f"echo '{PASSWORD}' | sudo -S bash -lc {repr(cmd)}"
    _, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
    code = stdout.channel.recv_exit_status()
    return code, stdout.read().decode(), stderr.read().decode()


def patch_nginx(text: str) -> str:
    if re.search(r"client_max_body_size\s+\d+[mM]", text):
        text = re.sub(
            r"client_max_body_size\s+\d+[mM]\s*;",
            f"client_max_body_size {MAX_BODY};",
            text,
        )
    else:

        def add_body_size(match: re.Match) -> str:
            block = match.group(0)
            if "client_max_body_size" in block:
                return block
            return block.replace("server {", f"server {{\n    client_max_body_size {MAX_BODY};", 1)

        text = re.sub(r"server\s*\{", add_body_size, text, count=1)

    text = text.replace(
        "proxy_read_timeout 60s;",
        "proxy_read_timeout 600s;\n        proxy_send_timeout 600s;",
    )
    if "proxy_send_timeout" not in text:
        text = text.replace(
            "proxy_read_timeout 30s;",
            "proxy_read_timeout 600s;\n        proxy_send_timeout 600s;",
        )
    return text


def main() -> int:
    if not PASSWORD:
        print("Set DEPLOY_PASSWORD")
        return 1

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    _, nginx, _ = run(ssh, "cat /etc/nginx/sites-available/blog", sudo=True)
    patched = patch_nginx(nginx)

    if patched == nginx:
        print(f"nginx already set to {MAX_BODY}, nothing to do")
        ssh.close()
        return 0

    sftp = ssh.open_sftp()
    with sftp.file("/tmp/blog.nginx", "w") as f:
        f.write(patched)
    sftp.close()

    code, out, err = run(
        ssh,
        "cp /tmp/blog.nginx /etc/nginx/sites-available/blog && nginx -t && systemctl reload nginx",
        sudo=True,
    )
    print(out or err)
    ssh.close()
    return 0 if code == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
