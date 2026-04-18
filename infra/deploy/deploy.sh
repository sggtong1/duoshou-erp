#!/usr/bin/env bash
set -euo pipefail

SERVER="${DEPLOY_HOST:?DEPLOY_HOST required}"
USER="${DEPLOY_USER:-ubuntu}"
TAG="${1:-latest}"

echo "Deploying tag=${TAG} to ${USER}@${SERVER}"

ssh "${USER}@${SERVER}" <<EOF
set -euo pipefail
cd /opt/duoshou-erp
export TAG="${TAG}"
docker compose pull
docker compose up -d
docker image prune -f
EOF

echo "Deploy done."
