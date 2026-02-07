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

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "${current_branch}" != "main" ]; then
  echo "Error: current branch is '${current_branch}', expected 'main'."
  echo "Please switch to main first: git checkout main"
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "Error: remote 'origin' not found."
  exit 1
fi

echo "Checking sync status with origin/main..."
git fetch origin main

local_main="$(git rev-parse main)"
remote_main="$(git rev-parse origin/main)"
base_main="$(git merge-base main origin/main)"

if [ "${local_main}" = "${remote_main}" ]; then
  echo "main is already synced with origin/main."
elif [ "${local_main}" = "${base_main}" ]; then
  echo "main is behind origin/main. Pulling latest changes..."
  git pull --ff-only origin main
  echo "main synced from origin/main."
elif [ "${remote_main}" = "${base_main}" ]; then
  echo "main is ahead of origin/main. Pushing local commits..."
  git push origin main
  echo "origin/main synced from local main."
else
  echo "Error: local main and origin/main have diverged."
  echo "Please resolve manually before creating a new branch."
  exit 1
fi

read -r -p "请输入新分支名: " new_branch
new_branch="${new_branch## }"
new_branch="${new_branch%% }"

if [ -z "${new_branch}" ]; then
  echo "Error: branch name cannot be empty."
  exit 1
fi

if ! git check-ref-format --branch "${new_branch}" >/dev/null 2>&1; then
  echo "Error: invalid branch name '${new_branch}'."
  exit 1
fi

if git show-ref --verify --quiet "refs/heads/${new_branch}"; then
  echo "Error: local branch '${new_branch}' already exists."
  exit 1
fi

git checkout -b "${new_branch}"
git push -u origin "${new_branch}"

echo "Done: branch '${new_branch}' created and tracking origin/${new_branch}."
