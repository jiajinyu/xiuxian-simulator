#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-8000}"
URL="http://localhost:${PORT}/app/index.html"

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

if is_port_in_use; then
  echo "Port ${PORT} is already in use. Reusing existing server and opening browser..."
else
  echo "Starting static server on port ${PORT}..."
  nohup "${PYTHON_BIN}" -m http.server "${PORT}" >/tmp/xiuxian-simulator-http-server.log 2>&1 &
  sleep 1
fi

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
