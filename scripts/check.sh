#!/usr/bin/env bash
set -euo pipefail

if ! command -v git >/dev/null 2>&1; then
  echo "Error: git not found."
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: current directory is not a git repository."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node not found."
  exit 1
fi

echo "Running local checks..."

node --check src/game-engine.js
node --check config/game-config.js
node --check config/game-config.ops-template.js

if [ -x "./node_modules/.bin/eslint" ]; then
  echo "Running ESLint..."
  ./node_modules/.bin/eslint src config scripts tests --ext .js
elif command -v eslint >/dev/null 2>&1; then
  echo "Running ESLint (global)..."
  eslint src config scripts tests --ext .js
else
  echo "Skip ESLint: install with 'npm install' to enable lint checks."
fi

while IFS= read -r json_file; do
  if [ -f "${json_file}" ]; then
    echo "Validating JSON: ${json_file}"
    node -e "const fs=require('fs'); JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));" "${json_file}"
  fi
done < <(rg --files -g '*.json' || true)

echo "Running smoke test..."
node scripts/smoke-test.js

if [ -f "tests/game-engine.test.js" ]; then
  echo "Running node tests..."
  node --test tests/game-engine.test.js
fi

echo "All local checks passed."
