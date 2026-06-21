#!/usr/bin/env python3
"""Patch nginx + systemd so cold start no longer needs manual triple-refresh."""
import os
import re
import paramiko

HOST = os.environ.get("DEPLOY_HOST", "101.33.218.140")
USER = os.environ.get("DEPLOY_USER", "ubuntu")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")

PROXY_KEYS = (
    "proxy_http_version",
    "proxy_set_header Connection",
    "proxy_set_header Host",
    "proxy_set_header X-Real-IP",
    "proxy_set_header X-Forwarded-For",
    "proxy_set_header X-Forwarded-Proto",
    "proxy_connect_timeout",
    "proxy_read_timeout",
    "proxy_next_upstream error",
    "proxy_next_upstream_tries",
    "proxy_intercept_errors",
    "error_page 502",
)

PROXY_LINES = [
    "        proxy_http_version 1.1;",
    '        proxy_set_header Connection "";',
    "        proxy_set_header Host $host;",
    "        proxy_set_header X-Real-IP $remote_addr;",
    "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
    "        proxy_set_header X-Forwarded-Proto $scheme;",
    "        proxy_connect_timeout 30s;",
    "        proxy_read_timeout 60s;",
    "        proxy_next_upstream error timeout http_502 http_503 http_504;",
    "        proxy_next_upstream_tries 2;",
    "        proxy_intercept_errors on;",
    "        error_page 502 503 = @starting;",
]

STARTING_BLOCK = """
    location @starting {
        default_type text/html;
        charset utf-8;
        return 503 '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="refresh" content="2"><meta name="viewport" content="width=device-width,initial-scale=1"><title>启动中</title></head><body style="margin:0;background:#0a0e17;color:#00f5ff;font-family:system-ui,sans-serif;text-align:center;padding:18vh 16px"><h1 style="font-weight:600">代码跳舞博客启动中…</h1><p style="color:#8899aa">Spring Boot 正在暖机，约 2 秒后自动刷新</p></body></html>';
    }
"""


def run(ssh, cmd, sudo=False):
    if sudo:
        cmd = f"echo '{PASSWORD}' | sudo -S bash -lc {repr(cmd)}"
    _, out, err = ssh.exec_command(cmd, get_pty=True)
    code = out.channel.recv_exit_status()
    return code, (out.read() + err.read()).decode("utf-8", errors="replace")


def _line_key(line: str) -> str | None:
    stripped = line.strip()
    for key in PROXY_KEYS:
        if stripped.startswith(key):
            return key
    return None


def dedupe_location_directives(nginx: str) -> str:
    """Remove duplicate proxy_* directives inside each location block."""
    lines = nginx.splitlines()
    result: list[str] = []
    in_location = False
    seen: set[str] = set()

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("location "):
            in_location = True
            seen = set()
        elif in_location and stripped == "}":
            in_location = False
            seen = set()

        if in_location:
            key = _line_key(line)
            if key:
                if key in seen:
                    continue
                seen.add(key)

        result.append(line)

    return "\n".join(result) + ("\n" if nginx.endswith("\n") else "")


def patch_location_blocks(nginx: str) -> str:
    """Append missing proxy directives to each `location /` block."""
    pattern = re.compile(
        r"(location\s+/\s*\{)(.*?)(^\s*\})",
        re.MULTILINE | re.DOTALL,
    )

    def repl(match: re.Match[str]) -> str:
        head, body, tail = match.group(1), match.group(2), match.group(3)
        existing = body
        to_add: list[str] = []
        for line in PROXY_LINES:
            key = _line_key(line)
            if key and key not in existing:
                to_add.append(line)
        if not to_add:
            return match.group(0)
        suffix = "\n".join(to_add)
        if existing and not existing.endswith("\n"):
            existing += "\n"
        return head + existing + suffix + "\n" + tail

    updated = pattern.sub(repl, nginx)
    if "@starting" not in updated:
        updated = updated.rstrip() + STARTING_BLOCK + "\n"
    return updated


def patch_nginx(nginx: str) -> str:
    updated = dedupe_location_directives(nginx)
    updated = patch_location_blocks(updated)
    updated = dedupe_location_directives(updated)
    return updated


def patch_systemd(unit: str) -> str:
    updated = unit
    if "Type=notify" not in updated:
        updated = updated.replace("Type=simple", "Type=notify")
    if "NotifyAccess=main" not in updated:
        updated = updated.replace("Type=notify", "Type=notify\nNotifyAccess=main")
    if "TimeoutStartSec=" not in updated:
        updated = updated.replace("RestartSec=5", "RestartSec=5\nTimeoutStartSec=120")
    pre = (
        "ExecStartPre=/bin/bash -c "
        "'for i in $(seq 1 60); do mysqladmin ping --protocol=TCP -h127.0.0.1 "
        "--silent 2>/dev/null && exit 0; sleep 1; done; exit 1'\n"
    )
    if "ExecStartPre=" not in updated and "ExecStart=" in updated:
        updated = updated.replace("ExecStart=", pre + "ExecStart=")
    if "Requires=mysql.service" not in updated:
        updated = updated.replace(
            "After=network.target mysql.service",
            "After=network-online.target mysql.service\nRequires=mysql.service\nWants=network-online.target",
        )
    return updated


def main():
    if not PASSWORD:
        print("Set DEPLOY_PASSWORD environment variable.")
        return 1

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    _, unit = run(ssh, "cat /etc/systemd/system/blog.service", sudo=True)
    unit = patch_systemd(unit)
    sftp = ssh.open_sftp()
    with sftp.file("/tmp/blog.service", "w") as f:
        f.write(unit)
    sftp.close()
    run(ssh, "cp /tmp/blog.service /etc/systemd/system/blog.service && systemctl daemon-reload", sudo=True)
    print("systemd unit patched (notify + mysql wait + 120s start timeout)")

    _, nginx = run(ssh, "cat /etc/nginx/sites-available/blog", sudo=True)
    nginx = patch_nginx(nginx)
    sftp2 = ssh.open_sftp()
    with sftp2.file("/tmp/blog.nginx", "w") as f:
        f.write(nginx)
    sftp2.close()
    code, out = run(ssh, "cp /tmp/blog.nginx /etc/nginx/sites-available/blog && nginx -t && systemctl reload nginx", sudo=True)
    print(out.strip() or "nginx reloaded")
    if code != 0:
        print("nginx -t failed, check /etc/nginx/sites-available/blog manually")
        return 1

    run(ssh, "systemctl restart blog", sudo=True)
    print("blog restarted; cold start should auto-refresh instead of blank 502")
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
