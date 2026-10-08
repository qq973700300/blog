#!/usr/bin/env python3
"""Ensure @starting exists in every server block that references it."""
import os
import re
import paramiko

HOST = os.environ.get("DEPLOY_HOST", "101.33.218.140")
USER = os.environ.get("DEPLOY_USER", "ubuntu")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")

STARTING_BLOCK = """
    location @starting {
        default_type text/html;
        charset utf-8;
                return 503 '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="refresh" content="2"><meta name="viewport" content="width=device-width,initial-scale=1"><title>xiewenwen.xyz</title><style>body{margin:0;background:#0a0e17;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:22px;font-family:"JetBrains Mono",Consolas,monospace}.d{width:8px;height:8px;border-radius:50%;background:#00f5ff;animation:p 1.2s infinite}.d2{animation-delay:.2s}.d3{animation-delay:.4s}@keyframes p{0%,80%,100%{opacity:.15;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}p{margin:0;color:#5a6b80;font-size:12px;letter-spacing:.35em}</style></head><body><div style="display:flex;gap:12px"><span class="d"></span><span class="d d2"></span><span class="d d3"></span></div><p>RECONNECTING</p></body></html>';
    }
"""


def split_server_blocks(text: str) -> list[tuple[str, str]]:
    """Return list of (header, body) for each server { ... } block."""
    blocks = []
    i = 0
    while True:
        m = re.search(r"server\s*\{", text[i:])
        if not m:
            break
        start = i + m.start()
        depth = 0
        j = i + m.end() - 1
        while j < len(text):
            if text[j] == "{":
                depth += 1
            elif text[j] == "}":
                depth -= 1
                if depth == 0:
                    blocks.append((text[start : j + 1], start, j + 1))
                    i = j + 1
                    break
            j += 1
        else:
            break
    return blocks


def patch_server_block(block: str) -> str:
    if "@starting" not in block and "error_page 502" not in block:
        return block
    if "location @starting" in block:
        return block
    # insert before final closing brace of server block
    return block[:-1].rstrip() + STARTING_BLOCK + "\n}\n"


def patch_nginx(text: str) -> str:
    blocks_info = split_server_blocks(text)
    if not blocks_info:
        return text

    result = []
    last_end = 0
    for block, start, end in blocks_info:
        result.append(text[last_end:start])
        result.append(patch_server_block(block))
        last_end = end
    result.append(text[last_end:])
    return "".join(result)


def run(ssh, cmd, sudo=False):
    if sudo:
        cmd = f"echo '{PASSWORD}' | sudo -S bash -lc {repr(cmd)}"
    _, out, err = ssh.exec_command(cmd, get_pty=True)
    code = out.channel.recv_exit_status()
    return code, (out.read() + err.read()).decode("utf-8", errors="replace")


def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    _, nginx = run(ssh, "cat /etc/nginx/sites-available/blog", sudo=True)
    print("Before: @starting count", nginx.count("location @starting"))
    print("Before: error_page 502 count", nginx.count("error_page 502"))

    patched = patch_nginx(nginx)
    print("After: @starting count", patched.count("location @starting"))

    sftp = ssh.open_sftp()
    with sftp.file("/tmp/blog.nginx", "w") as f:
        f.write(patched)
    sftp.close()

    code, out = run(
        ssh,
        "cp /tmp/blog.nginx /etc/nginx/sites-available/blog && nginx -t && systemctl reload nginx",
        sudo=True,
    )
    print(out)
    if code != 0:
        return 1

    import time
    time.sleep(8)
    _, out = run(ssh, "systemctl is-active blog; curl -s -o /dev/null -w '%{http_code}' https://xiewenwen.xyz/js/dance.js")
    print("Health:", out.strip())
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
