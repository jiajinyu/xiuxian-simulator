#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

PORT="${1:-8080}"
PAGE_PATH="${2:-/app/index.html}"
WSL_DISTRO="${3:-}"
KEEP_OPEN="${KEEP_OPEN:-1}"
SERVER_LOG="/tmp/xiuxian-simulator-mobile-server.log"

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "错误：未找到 python3/python，请先安装 Python。"
  exit 1
fi

is_port_in_use() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"${PORT}" -sTCP:LISTEN -n -P >/dev/null 2>&1
    return
  fi
  if command -v ss >/dev/null 2>&1; then
    ss -ltn "( sport = :${PORT} )" | tail -n +2 | grep -q .
    return
  fi
  return 1
}

get_port_pids() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -tiTCP:"${PORT}" -sTCP:LISTEN 2>/dev/null || true
    return
  fi
  if command -v ss >/dev/null 2>&1; then
    ss -ltnp "( sport = :${PORT} )" 2>/dev/null | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | sort -u || true
    return
  fi
}

if is_port_in_use; then
  EXISTING_PIDS="$(get_port_pids)"
  if [ -n "${EXISTING_PIDS}" ]; then
    echo "端口 ${PORT} 已被占用，正在结束进程：${EXISTING_PIDS}"
    kill ${EXISTING_PIDS} >/dev/null 2>&1 || true
    sleep 1
  else
    echo "端口 ${PORT} 已占用，但未能定位 PID，继续尝试启动。"
  fi
fi

echo "正在启动 WSL 静态服务（0.0.0.0:${PORT}）..."
nohup "${PYTHON_BIN}" - "${PORT}" >"${SERVER_LOG}" 2>&1 <<'PY' &
import http.server
import socketserver
import sys

port = int(sys.argv[1])

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

with ReusableTCPServer(("0.0.0.0", port), NoCacheHandler) as httpd:
    httpd.serve_forever()
PY
sleep 1

PS_SCRIPT_WIN="$(wslpath -w "${SCRIPT_DIR}/expose-wsl-mobile.ps1")"
PS_ARGS=(-ExecutionPolicy Bypass -File "${PS_SCRIPT_WIN}" -Port "${PORT}" -Path "${PAGE_PATH}")
if [ -n "${WSL_DISTRO}" ]; then
  PS_ARGS+=(-WslDistro "${WSL_DISTRO}")
fi
if [ "${KEEP_OPEN}" = "1" ]; then
  PS_ARGS+=(-KeepOpen)
fi

echo "正在启动 PowerShell 配置 Windows 端口转发与防火墙..."
powershell.exe "${PS_ARGS[@]}"

echo ""
echo "本地访问地址：http://localhost:${PORT}${PAGE_PATH}"
echo "服务日志：${SERVER_LOG}"
echo "手机访问地址会显示在弹出的管理员 PowerShell 窗口中。"
