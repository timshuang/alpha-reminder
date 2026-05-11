#!/usr/bin/env bash

set -euo pipefail

REPO_URL="https://github.com/timshuang/alpha-reminder.git"
INSTALL_DIR="${HOME}/alpha-reminder"

log() {
  printf '[install] %s\n' "$1"
}

require_root_for_apt() {
  if [[ "${EUID}" -ne 0 ]]; then
    sudo "$@"
  else
    "$@"
  fi
}

ensure_git() {
  if command -v git >/dev/null 2>&1; then
    return
  fi

  log "Installing git..."
  require_root_for_apt apt-get update
  require_root_for_apt apt-get install -y git
}

main() {
  log "Preparing one-command install for ${REPO_URL}"
  ensure_git

  if [[ -d "${INSTALL_DIR}" ]]; then
    log "Existing install found at ${INSTALL_DIR}. Removing it for a clean reinstall."
    rm -rf "${INSTALL_DIR}"
  fi

  log "Cloning latest code from ${REPO_URL}..."
  git clone "${REPO_URL}" "${INSTALL_DIR}"

  cd "${INSTALL_DIR}"
  log "Handing off to project setup script..."
  bash scripts/setup-linux.sh
}

main "$@"
