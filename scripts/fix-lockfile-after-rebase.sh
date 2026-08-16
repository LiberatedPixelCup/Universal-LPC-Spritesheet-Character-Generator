#!/usr/bin/env bash
# Restore a complete package-lock.json after a rebase, then apply package.json
# changes without pruning other-platform optional dependencies.
#
# `npm install` on macOS with node_modules present rewrites the lockfile from
# what is on disk and drops Linux/Windows optional packages. Linux `npm ci`
# then fails. This script takes the upstream lockfile and updates it with
# `npm install --package-lock-only` instead.
#
# Usage:
#   scripts/fix-lockfile-after-rebase.sh [upstream]
#
# Examples:
#   scripts/fix-lockfile-after-rebase.sh
#   npm run lockfile:fix
#   scripts/fix-lockfile-after-rebase.sh origin/master
#
# During an in-progress rebase, takes the upstream lockfile ("ours").
# After a rebase, checks the lockfile out from the given upstream (default: master).

set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

upstream="${1:-master}"

if ! git rev-parse --verify "$upstream" >/dev/null 2>&1; then
  echo "error: unknown ref '$upstream'" >&2
  exit 1
fi

rebase_in_progress=0
if [[ -d "$(git rev-parse --git-path rebase-merge)" || -d "$(git rev-parse --git-path rebase-apply)" ]]; then
  rebase_in_progress=1
fi

if [[ "$rebase_in_progress" -eq 1 ]]; then
  echo "Rebase in progress: taking upstream package-lock.json (git checkout --ours)."
  git checkout --ours -- package-lock.json
  git add package-lock.json
else
  echo "Checking out package-lock.json from $upstream."
  git checkout "$upstream" -- package-lock.json
fi

echo "Updating lockfile from package.json without pruning optional platform packages."
npm install --package-lock-only

missing=0
required=(
  "node_modules/sass-embedded-win32-x64"
  "node_modules/@img/sharp-linux-x64"
  "node_modules/@parcel/watcher-linux-x64-glibc"
)
for pkg in "${required[@]}"; do
  if ! grep -Fq "\"$pkg\"" package-lock.json; then
    echo "error: $pkg is missing from package-lock.json" >&2
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  echo "error: lockfile is still missing other-platform optional packages." >&2
  echo "Do not commit this lockfile. Restore $upstream and retry." >&2
  exit 1
fi

echo "Lockfile looks complete. Installing from it the same way CI does."
npm ci --ignore-scripts

if [[ "$rebase_in_progress" -eq 1 ]]; then
  git add package-lock.json
  echo "Staged package-lock.json. Continue the rebase with: git rebase --continue"
else
  echo "Done. Review and commit package-lock.json if it changed."
fi
