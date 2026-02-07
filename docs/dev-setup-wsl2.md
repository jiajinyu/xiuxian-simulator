# Development Setup on Plain WSL2 (Windows)

This guide covers a clean setup for this project on a fresh Windows + WSL2 environment.

## 1. Install WSL2 and Ubuntu

Run PowerShell as Administrator:

```powershell
wsl --install
```

Then restart Windows if prompted.

Verify WSL version:

```powershell
wsl --status
```

Install Ubuntu from Microsoft Store if `wsl --install` did not do it automatically.

## 2. First-time Ubuntu setup

Open Ubuntu terminal and run:

```bash
sudo apt update
sudo apt install -y git nodejs npm
```

Check versions:

```bash
git --version
node --version
npm --version
```

## 3. Clone project inside WSL filesystem

Use Linux home directory (recommended for performance):

```bash
cd ~
git clone <your-repo-url> xiuxian-simulator
cd xiuxian-simulator
```

## 4. Open project in editor (optional but recommended)

If you use VS Code:

```bash
code .
```

If `code` is not available in WSL, install VS Code and the "WSL" extension first.

## 5. Run project locally

This repo is no-build. You can run it in either way:

1. Direct file open:

```bash
explorer.exe app/index.html
```

2. Static server (recommended for browser compatibility):

```bash
cd /home/$USER/xiuxian-simulator
python3 -m http.server 8080
```

Then open in browser:

- `http://localhost:8080/app/index.html`

## 6. Required checks after changes

Run these in repo root:

```bash
node --check src/game-engine.js
node --check config/game-config.js
```

If you modified ops template, also run:

```bash
node --check config/game-config.ops-template.js
```

## 7. Manual smoke test flow

After edits, verify core flow in browser:

1. Start a new run (开局)
2. Train/cultivate for multiple ticks (修炼)
3. Reach summary/death settlement (结算)

## 8. Common issues

- `code: command not found`
  - Install VS Code on Windows + WSL extension, reopen WSL terminal.

- Browser cannot open `localhost`
  - Ensure `python3 -m http.server 8080` is running in current repo.

- Node command missing
  - Reinstall with `sudo apt install -y nodejs npm`.

- Slow file IO
  - Keep repo under WSL path (for example `~/xiuxian-simulator`), not under `/mnt/c/...`.

## 9. Project boundaries reminder

Follow these repo rules during development:

- `app/`: page and styles only
- `config/`: configuration data only
- `src/`: engine logic only
- `docs/`: documentation only

Prefer changing `config/game-config.js` first. Only modify `src/game-engine.js` when config-only changes are insufficient.
