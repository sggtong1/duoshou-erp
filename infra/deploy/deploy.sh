#!/usr/bin/env bash
# Deploy the latest `main` from GitHub to the VPS.
# Usage:
#   DEPLOY_HOST=your-vps.example.com DEPLOY_USER=ubuntu bash infra/deploy/deploy.sh
#
# Assumes the VPS has /opt/duoshou-erp as a clone of
# https://github.com/sggtong1/duoshou-erp.git and /opt/duoshou-erp/.env.production
# exists (see docs/deploy/README.md).
set -euo pipefail

SERVER="${DEPLOY_HOST:?DEPLOY_HOST required}"
USER="${DEPLOY_USER:-ubuntu}"

echo "Deploying to ${USER}@${SERVER}"

ssh "${USER}@${SERVER}" <<'EOF'
set -euo pipefail
cd /opt/duoshou-erp
git fetch origin
git reset --hard origin/main
cd infra/docker
docker compose build api web
docker compose up -d
docker image prune -f
echo "--- tail api log ---"
docker compose logs --tail 30 api
EOF

echo "Deploy done."
