#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

PORT="${1:-8000}"
BASE_URL="http://localhost:${PORT}/app/index.html"
CACHE_BUST="$(date +%s)"
URL="${BASE_URL}?_ts=${CACHE_BUST}"

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "Error: python3/python not found. Install Python first."
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
    echo "Port ${PORT} is in use. Killing existing server process(es): ${EXISTING_PIDS}"
    kill ${EXISTING_PIDS} >/dev/null 2>&1 || true
    sleep 1
  else
    echo "Port ${PORT} is in use, but PID lookup failed. Trying to continue..."
  fi
fi

echo "Starting static server on port ${PORT} (cache disabled)..."
nohup "${PYTHON_BIN}" - "${PORT}" >/tmp/xiuxian-simulator-http-server.log 2>&1 <<'PY' &
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

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", port), NoCacheHandler) as httpd:
    httpd.serve_forever()
PY
sleep 1

echo "Opening ${URL} in Chrome..."

# 尝试多种方式打开 Chrome
if command -v google-chrome >/dev/null 2>&1; then
  # Linux 原生 Chrome
  google-chrome "${URL}" >/dev/null 2>&1 &
elif command -v chromium >/dev/null 2>&1; then
  # Chromium
  chromium "${URL}" >/dev/null 2>&1 &
elif command -v chromium-browser >/dev/null 2>&1; then
  # Chromium (另一种命名)
  chromium-browser "${URL}" >/dev/null 2>&1 &
elif command -v /mnt/c/Program\ Files/Google/Chrome/Application/chrome.exe >/dev/null 2>&1; then
  # WSL - Windows Chrome (Program Files)
  "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe" "${URL}" >/dev/null 2>&1 &
elif command -v /mnt/c/Program\ Files\ \(x86\)/Google/Chrome/Application/chrome.exe >/dev/null 2>&1; then
  # WSL - Windows Chrome (Program Files x86)
  "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" "${URL}" >/dev/null 2>&1 &
elif command -v explorer.exe >/dev/null 2>&1; then
  # WSL - 回退到默认浏览器
  echo "Chrome not found, falling back to default browser..."
  explorer.exe "${URL}" >/dev/null 2>&1 || true
else
  echo "Could not find Chrome or default browser. Open this URL manually: ${URL}"
fi

echo "Done. Server log: /tmp/xiuxian-simulator-http-server.log"
