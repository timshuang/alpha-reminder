#!/usr/bin/env bash

set -euo pipefail

REPO_URL="https://github.com/timshuang/alpha-reminder"
ARCHIVE_URL="https://github.com/timshuang/alpha-reminder/archive/refs/heads/main.tar.gz"
INSTALL_DIR="${HOME}/alpha-reminder"
TMP_ARCHIVE="$(mktemp)"

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

ensure_fetch_tools() {
  if command -v curl >/dev/null 2>&1 && command -v tar >/dev/null 2>&1; then
    return
  fi

  log "Installing missing fetch tools (curl, tar)..."
  require_root_for_apt apt-get update
  require_root_for_apt apt-get install -y curl tar
}

main() {
  log "Preparing one-command install for ${REPO_URL}"
  ensure_fetch_tools

  if [[ -d "${INSTALL_DIR}" ]]; then
    log "Existing install found at ${INSTALL_DIR}. Removing it for a clean reinstall."
    rm -rf "${INSTALL_DIR}"
  fi

  mkdir -p "${INSTALL_DIR}"

  log "Downloading latest main branch archive..."
  curl -fsSL "${ARCHIVE_URL}" -o "${TMP_ARCHIVE}"

  log "Extracting project into ${INSTALL_DIR}..."
  tar -xzf "${TMP_ARCHIVE}" -C "${INSTALL_DIR}" --strip-components=1
  rm -f "${TMP_ARCHIVE}"

  cd "${INSTALL_DIR}"
  log "Handing off to project setup script..."
  bash scripts/setup-linux.sh
}

main "$@"
