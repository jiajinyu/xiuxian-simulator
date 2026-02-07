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
if [ "${current_branch}" = "HEAD" ]; then
  echo "Error: detached HEAD detected. Please checkout a branch first."
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "Error: remote 'origin' not found."
  exit 1
fi

if [ ! -x "scripts/check.sh" ]; then
  echo "Error: scripts/check.sh not found or not executable."
  exit 1
fi

echo "Step 1/4: local checks"
bash scripts/check.sh

default_msg="ops: update $(date '+%Y-%m-%d %H:%M:%S')"
read -r -p "请输入 commit 信息（直接回车使用默认）: " commit_msg
if [ -z "${commit_msg}" ]; then
  commit_msg="${default_msg}"
fi

echo "Fetching latest remote refs..."
git fetch origin

git add -A

if git show-ref --verify --quiet "refs/remotes/origin/${current_branch}"; then
  remote_ref="origin/${current_branch}"
  ahead_count="$(git rev-list --count "${remote_ref}..HEAD")"
  behind_count="$(git rev-list --count "HEAD..${remote_ref}")"

  if [ "${behind_count}" -gt 0 ]; then
    echo "Error: current branch is behind ${remote_ref} by ${behind_count} commit(s)."
    echo "Please sync branch first before squashing/pushing."
    exit 1
  fi

  if [ "${ahead_count}" -gt 0 ]; then
    echo "Squashing ${ahead_count} unpushed commit(s) into one commit..."
    git reset --soft "${remote_ref}"
  fi
else
  echo "Remote branch origin/${current_branch} not found. Will create it on push."
  if git show-ref --verify --quiet "refs/remotes/origin/main"; then
    base_ref="$(git merge-base HEAD origin/main)"
    if [ "$(git rev-parse HEAD)" != "${base_ref}" ]; then
      echo "Squashing local commits since branch point with origin/main..."
      git reset --soft "${base_ref}"
    fi
  fi
fi

if git diff --cached --quiet; then
  echo "No local changes or unpushed commits to commit."
else
  git commit -m "${commit_msg}"
fi

if git show-ref --verify --quiet "refs/remotes/origin/${current_branch}"; then
  git push origin "${current_branch}"
else
  git push -u origin "${current_branch}"
fi

echo "Done: pushed branch '${current_branch}' to origin."
