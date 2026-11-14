#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/Users/Desouza/.gemini/antigravity/scratch/arquibancada-ucl2027"
RUNNER_DIR="/Users/Desouza/.gemini/antigravity/scratch/n8n-runner"
WORKFLOW_FILE="$PROJECT_DIR/n8n/workflow-arquibancada-ucl2027.json"

if [ -f "$PROJECT_DIR/.env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_DIR/.env.local"
  set +a
fi

mkdir -p "$RUNNER_DIR/n8n-data"

export N8N_USER_FOLDER="$RUNNER_DIR/n8n-data"
export N8N_PORT="${N8N_PORT:-5678}"
export N8N_HOST="${N8N_HOST:-127.0.0.1}"
export WEBHOOK_URL="${WEBHOOK_URL:-http://localhost:5678/}"
export N8N_BLOCK_ENV_ACCESS_IN_NODE="false"
export N8N_RESTRICT_FILE_ACCESS_TO="/Users/Desouza"
export N8N_DEFAULT_BINARY_DATA_MODE="default"
export N8N_DIAGNOSTICS_ENABLED="false"
export N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS="false"
export APP_BASE_URL="${APP_BASE_URL:-${NEXT_PUBLIC_APP_URL:-http://localhost:3033}}"

cd "$RUNNER_DIR"

./node_modules/.bin/n8n import:workflow --input="$WORKFLOW_FILE"
./node_modules/.bin/n8n publish:workflow --id=arquibancadaUCL27

exec ./node_modules/.bin/n8n start
