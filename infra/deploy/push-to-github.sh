#!/usr/bin/env bash
# Push duoshou-erp/ subdirectory to the independent GitHub repo.
# Usage: bash infra/deploy/push-to-github.sh
#
# This repo lives as a subdirectory of a parent git repo at /Users/mx4com/coding.
# `git subtree push` splits the duoshou-erp/ history and pushes it as
# independent commits to the GitHub repo's main branch.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
GITHUB_URL="https://github.com/sggtong1/duoshou-erp.git"

# 如果当前在 duoshou-erp/ 子目录里运行,父 repo 才是 subtree 操作的上下文
# git rev-parse --show-toplevel 应该返回 /Users/mx4com/coding
if [ ! -d "${REPO_ROOT}/duoshou-erp" ]; then
  echo "Error: /Users/mx4com/coding/duoshou-erp not found. Are you running from the correct parent repo?"
  exit 1
fi

cd "${REPO_ROOT}"
echo "Pushing duoshou-erp subtree to ${GITHUB_URL} main..."
git subtree push -P duoshou-erp "${GITHUB_URL}" main
echo "Push done."
