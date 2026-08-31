#!/usr/bin/env bash
set -euo pipefail

RUNNER="/usr/local/libexec/cresci-update-runner"

echo
echo "======================================"
echo "          CRESCI Updater"
echo "======================================"
echo

if [ ! -x "${RUNNER}" ]; then
  echo "ERROR: CRESCI update helper is not installed."
  echo
  echo "Run as root:"
  echo
  echo "  /opt/cresci/scripts/install-update-helper.sh"
  echo
  exit 1
fi

if [ "$(id -u)" -eq 0 ]; then
  exec "${RUNNER}"
fi

if command -v sudo >/dev/null 2>&1; then
  exec sudo "${RUNNER}"
fi

echo "ERROR: sudo is not available."
exit 1