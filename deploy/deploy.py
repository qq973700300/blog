#!/usr/bin/env python3
"""将 blog 项目部署到 Ubuntu 服务器（SSH + SFTP）。"""

import argparse
import os
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

import paramiko

PROJECT_ROOT = Path(__file__).resolve().parent.parent
JAR_CANDIDATES = [
    PROJECT_ROOT / "target" / "blog-0.0.1-SNAPSHOT.jar",
    PROJECT_ROOT / "target" / "blog.jar",
]
REMOTE_JAR = "/tmp/blog.jar"
REMOTE_SETUP = "/tmp/server-setup.sh"
REMOTE_ZIP = "/tmp/blog-project.zip"


def zip_project() -> Path:
    """打包项目源码，供服务器远程构建。"""
    import io
    zip_path = Path(tempfile.gettempdir()) / "blog-project.zip"
    include = ["pom.xml", "mvnw", "mvnw.cmd", ".mvn"]
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for name in include:
            path = PROJECT_ROOT / name
            if path.is_dir():
                for f in path.rglob("*"):
                    if f.is_file():
                        zf.write(f, f.relative_to(PROJECT_ROOT).as_posix())
            elif path.exists():
                zf.write(path, name)
        for f in (PROJECT_ROOT / "src").rglob("*"):
            if f.is_file():
                zf.write(f, f.relative_to(PROJECT_ROOT).as_posix())
    return zip_path


def find_jar() -> Path | None:
    for candidate in JAR_CANDIDATES:
        if candidate.exists():
            return candidate
    return None


def build_jar() -> Path:
    mvnw = PROJECT_ROOT / "mvnw.cmd" if os.name == "nt" else PROJECT_ROOT / "mvnw"
    if not mvnw.exists():
        raise FileNotFoundError("未找到 mvnw，请先在 IDE 中执行 Maven package 生成 JAR")

    print("==> 本地打包 JAR...")
    subprocess.run([str(mvnw), "package", "-DskipTests", "-q"], cwd=PROJECT_ROOT, check=True)

    jar = find_jar()
    if not jar:
        raise FileNotFoundError("打包完成但未找到 target/*.jar")
    return jar


def connect(host: str, user: str, password: str, port: int) -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"==> 连接 {user}@{host}:{port} ...")
    client.connect(host, port=port, username=user, password=password, timeout=20)
    return client


def upload(sftp: paramiko.SFTPClient, local: Path, remote: str) -> None:
    print(f"    上传 {local.name} -> {remote}")
    sftp.put(str(local), remote)


def run(client: paramiko.SSHClient, cmd: str) -> None:
    print(f"    执行: {cmd}")
    _, stdout, stderr = client.exec_command(cmd)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    if out.strip():
        print(out.rstrip())
    if err.strip():
        print(err.rstrip(), file=sys.stderr)
    if exit_code != 0:
        raise RuntimeError(f"命令失败 (exit {exit_code}): {cmd}")


def main() -> None:
    parser = argparse.ArgumentParser(description="部署 blog 到腾讯云 Ubuntu 服务器")
    parser.add_argument("--host", required=True, help="服务器公网 IP")
    parser.add_argument("--user", default="ubuntu", help="SSH 用户名")
    parser.add_argument("--password", required=True, help="SSH 密码")
    parser.add_argument("--port", type=int, default=22, help="SSH 端口")
    parser.add_argument("--skip-build", action="store_true", help="跳过本地打包，使用已有 JAR")
    parser.add_argument("--build-on-server", action="store_true", help="上传源码到服务器构建（本地无 JAR 时使用）")
    args = parser.parse_args()

    jar = find_jar()
    use_server_build = args.build_on_server or jar is None

    if not use_server_build:
        if not jar and not args.skip_build:
            try:
                jar = build_jar()
            except Exception as exc:
                print(f"本地打包失败: {exc}，改为服务器构建...")
                use_server_build = True
        elif not jar:
            print("未找到 JAR，将使用服务器构建模式")
            use_server_build = True

    setup_script = Path(__file__).parent / "server-setup.sh"
    if not setup_script.exists():
        print(f"缺少 {setup_script}")
        sys.exit(1)

    client = connect(args.host, args.user, args.password, args.port)
    try:
        sftp = client.open_sftp()
        if use_server_build:
            project_zip = zip_project()
            print(f"==> 上传项目包 ({project_zip.stat().st_size // 1024} KB)...")
            upload(sftp, project_zip, REMOTE_ZIP)
        else:
            upload(sftp, jar, REMOTE_JAR)
        upload(sftp, setup_script, REMOTE_SETUP)
        sftp.close()

        run(client, "chmod +x /tmp/server-setup.sh && bash /tmp/server-setup.sh")
        print(f"\n成功! 打开 http://{args.host}:8080/")
    finally:
        client.close()


if __name__ == "__main__":
    main()
