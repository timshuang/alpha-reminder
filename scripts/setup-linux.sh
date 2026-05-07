#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
ENV_EXAMPLE_FILE="$PROJECT_ROOT/.env.example"

log() {
  printf '[setup] %s\n' "$1"
}

require_root_for_apt() {
  if [[ "${EUID}" -ne 0 ]]; then
    log "Installing system packages requires sudo/root. Re-running apt command may prompt for sudo."
    sudo "$@"
  else
    "$@"
  fi
}

ensure_command() {
  local command_name="$1"
  local install_kind="$2"

  if command -v "$command_name" >/dev/null 2>&1; then
    return
  fi

  if [[ "$install_kind" == "apt-node" ]]; then
    log "Installing nodejs and npm via apt..."
    require_root_for_apt apt-get update
    require_root_for_apt apt-get install -y nodejs npm
    return
  fi

  if [[ "$install_kind" == "npm-pm2" ]]; then
    log "Installing pm2 globally via npm..."
    npm install -g pm2
    return
  fi
}

prompt_bark_key() {
  local bark_key=""
  local tty_device="/dev/tty"

  if [[ ! -r "${tty_device}" ]]; then
    log "Interactive input is unavailable because ${tty_device} cannot be read."
    log "Please run this installer in an interactive terminal."
    exit 1
  fi

  while [[ -z "$bark_key" ]]; do
    read -r -p "Enter BARK_DEVICE_KEY (required): " bark_key < "${tty_device}"
    bark_key="$(printf '%s' "$bark_key" | xargs)"
    if [[ -z "$bark_key" ]]; then
      log "BARK_DEVICE_KEY cannot be empty. Please try again."
    fi
  done

  node - "$ENV_FILE" "$bark_key" <<'EOF'
const fs = require("node:fs");

const filePath = process.argv[2];
const barkKey = process.argv[3];
const contents = fs.readFileSync(filePath, "utf8");
const lines = contents.split(/\r?\n/);
let replaced = false;

const nextLines = lines.map((line) => {
  if (line.startsWith("BARK_DEVICE_KEY=")) {
    replaced = true;
    return `BARK_DEVICE_KEY=${barkKey}`;
  }
  return line;
});

if (!replaced) {
  nextLines.push(`BARK_DEVICE_KEY=${barkKey}`);
}

fs.writeFileSync(filePath, `${nextLines.join("\n").replace(/\n*$/, "\n")}`);
EOF
}

main() {
  if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
    log "package.json not found. Please run this script from the project workspace."
    exit 1
  fi

  ensure_command node apt-node
  ensure_command npm apt-node
  ensure_command pm2 npm-pm2

  if [[ ! -f "$ENV_FILE" ]]; then
    log ".env not found. Copying from .env.example..."
    cp "$ENV_EXAMPLE_FILE" "$ENV_FILE"
  fi

  prompt_bark_key

  mkdir -p "$PROJECT_ROOT/data" "$PROJECT_ROOT/logs"

  cd "$PROJECT_ROOT"
  log "Running npm install..."
  npm install

  log "Running npm test..."
  npm test

  log "Sending installation Bark test notification..."
  npm run test-bark

  log "Starting pm2 process..."
  pm2 start ecosystem.config.js

  log "Saving pm2 process list..."
  pm2 save

  log "Generating pm2 startup command..."
  pm2 startup

  log "Setup complete. If pm2 startup printed a sudo command above, run it once to enable boot-time restore."
}

main "$@"
