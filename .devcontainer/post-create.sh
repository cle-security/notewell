#!/usr/bin/env bash
# Runs once after the container is created. Bootstraps pnpm, fixes
# ownership on persisted volumes, and (if a manifest already exists)
# installs deps. On a fresh empty repo the install is a no-op.

set -euo pipefail

# Named-volume mounts come up root-owned on first creation; hand them to
# the node user so claude-code and shell history can write.
sudo chown -R node:node /home/node/.claude /commandhistory

corepack enable
corepack prepare pnpm@latest --activate

if [ -f package.json ]; then
  pnpm install --frozen-lockfile=false
fi
