# Development Setup on Plain WSL2 (Windows)

This guide covers a clean setup for this project on a fresh Windows + WSL2 environment.

## 1. Install WSL2 and Ubuntu 24.04

Run PowerShell as Administrator:

```powershell
wsl --install -d Ubuntu-24.04
```

Then restart Windows if prompted.

Verify WSL version:

```powershell
wsl --status
```

If Ubuntu 24.04 is not installed automatically, install it from Microsoft Store or run:

```powershell
wsl --install -d Ubuntu-24.04
```

## 2. First-time Ubuntu setup

Open Ubuntu terminal and run:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl
```

## 3. Install Node.js via NVM (Recommended)

Install NVM (Node Version Manager):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
```

Reload shell configuration:

```bash
source ~/.bashrc
```

Install Node.js LTS version:

```bash
nvm install --lts
nvm use --lts
```

Verify installation:

```bash
node --version
npm --version
```

## 4. Install Python (for static server)

Ubuntu 24.04 comes with Python 3 pre-installed. Verify:

```bash
python3 --version
```

If not installed:

```bash
sudo apt install -y python3
```

## 5. Install ripgrep (optional but recommended)

The check script uses `rg` for finding JSON files:

```bash
sudo apt install -y ripgrep
```

## 6. Clone project inside WSL filesystem

Use Linux home directory (recommended for performance):

```bash
cd ~
git clone <your-repo-url> xiuxian-simulator
cd xiuxian-simulator
```

## 7. Install project dependencies

```bash
npm install
```

This installs ESLint for code linting.

## 8. Open project in editor (optional but recommended)

If you use VS Code:

```bash
code .
```

If `code` is not available in WSL, install VS Code and the "WSL" extension first.

## 9. Run project locally

This repo is no-build. You can run it in either way:

### Option 1: Using the provided script (recommended)

```bash
bash scripts/start-app-wsl.sh
```

Optional custom port (default 8000):

```bash
bash scripts/start-app-wsl.sh 8080
```

### Option 2: Manual static server

```bash
cd /home/$USER/xiuxian-simulator
python3 -m http.server 8080
```

Then open in browser:

- `http://localhost:8080/app/index.html`

### Option 3: Direct file open (limited browser compatibility)

```bash
explorer.exe app/index.html
```

## 10. Required checks after changes

Run these in repo root:

```bash
bash scripts/check.sh
```

Or run checks individually:

```bash
node --check src/game-engine.js
node --check config/game-config.js
```

If you modified ops template, also run:

```bash
node --check config/game-config.ops-template.js
```

## 11. Manual smoke test flow

After edits, verify core flow in browser:

1. Start a new run (开局)
2. Train/cultivate for multiple ticks (修炼)
3. Reach summary/death settlement (结算)

## 12. Common issues

- `code: command not found`
  - Install VS Code on Windows + WSL extension, reopen WSL terminal.

- Browser cannot open `localhost`
  - Ensure `python3 -m http.server 8080` is running in current repo.

- Node command missing
  - Ensure NVM is loaded: `source ~/.bashrc`
  - Or reinstall Node.js: `nvm install --lts`

- `rg: command not found`
  - Install ripgrep: `sudo apt install -y ripgrep`

- Slow file IO
  - Keep repo under WSL path (for example `~/xiuxian-simulator`), not under `/mnt/c/...`.

## 13. Project boundaries reminder

Follow these repo rules during development:

- `app/`: page and styles only
- `config/`: configuration data only
- `src/`: engine logic only
- `docs/`: documentation only

Prefer changing `config/game-config.js` first. Only modify `src/game-engine.js` when config-only changes are insufficient.
