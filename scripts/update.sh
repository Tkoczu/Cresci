#!/usr/bin/env bash

set -euo pipefail

APP_DIR="/opt/cresci"
BACKUP_DIR="/var/backups/cresci"
REPO="Tkoczu/Cresci"
SERVICE="cresci"
DEFAULT_PORT="4173"

echo
echo "======================================"
echo "          CRESCI Updater"
echo "======================================"
echo

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: Run updater as root."
  exit 1
fi

if [ ! -d "${APP_DIR}/.git" ]; then
  echo "ERROR: CRESCI installation not found in ${APP_DIR}"
  exit 1
fi

cd "${APP_DIR}"

CURRENT_VERSION="$(git describe --tags --exact-match 2>/dev/null || git rev-parse --short HEAD)"

echo "Current version: ${CURRENT_VERSION}"
echo "Checking GitHub Releases..."

LATEST_VERSION="$(
  curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" |
  sed -n 's/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' |
  head -n 1
)"

if [ -z "${LATEST_VERSION}" ]; then
  echo "ERROR: Could not determine latest CRESCI version."
  exit 1
fi

echo "Latest version:  ${LATEST_VERSION}"
echo

if [ "${CURRENT_VERSION}" = "${LATEST_VERSION}" ]; then
  echo "CRESCI is already up to date."
  exit 0
fi

echo "New version available: ${LATEST_VERSION}"
echo

read -r -p "Install update? [y/N]: " CONFIRM

case "${CONFIRM}" in
  y|Y|yes|YES)
    ;;
  *)
    echo "Update cancelled."
    exit 0
    ;;
esac

TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
BACKUP_PATH="${BACKUP_DIR}/${TIMESTAMP}"
PREVIOUS_COMMIT="$(git rev-parse HEAD)"

mkdir -p "${BACKUP_PATH}"

echo
echo "[1/7] Creating backup..."

if [ -f "${APP_DIR}/.env" ]; then
  cp "${APP_DIR}/.env" "${BACKUP_PATH}/.env"
fi

if [ -d "${APP_DIR}/data" ]; then
  tar -czf "${BACKUP_PATH}/data.tar.gz" -C "${APP_DIR}" data
fi

echo "${CURRENT_VERSION}" > "${BACKUP_PATH}/version.txt"
echo "${PREVIOUS_COMMIT}" > "${BACKUP_PATH}/commit.txt"

echo "Backup: ${BACKUP_PATH}"

echo
echo "[2/7] Downloading release information..."

git fetch --tags --force origin

if ! git rev-parse "${LATEST_VERSION}^{commit}" >/dev/null 2>&1; then
  echo "ERROR: Release tag ${LATEST_VERSION} was not found."
  exit 1
fi

echo
echo "[3/7] Stopping CRESCI..."

systemctl stop "${SERVICE}"

rollback() {
  echo
  echo "======================================"
  echo "UPDATE FAILED - starting rollback"
  echo "======================================"

  cd "${APP_DIR}"

  git checkout --force "${PREVIOUS_COMMIT}"

  if [ -f "${BACKUP_PATH}/.env" ]; then
    cp "${BACKUP_PATH}/.env" "${APP_DIR}/.env"
  fi

  if [ -f "${BACKUP_PATH}/data.tar.gz" ]; then
    rm -rf "${APP_DIR}/data"
    tar -xzf "${BACKUP_PATH}/data.tar.gz" -C "${APP_DIR}"
  fi

  systemctl restart "${SERVICE}" || true

  echo
  echo "CRESCI restored to ${CURRENT_VERSION}."
  exit 1
}

trap rollback ERR

echo
echo "[4/7] Installing ${LATEST_VERSION}..."

git checkout --force "${LATEST_VERSION}"

mkdir -p "${APP_DIR}/data"
mkdir -p "${APP_DIR}/backups"

if [ -f "${APP_DIR}/package-lock.json" ]; then
  npm ci --omit=dev
fi

if [ -f "${APP_DIR}/scripts/migrate.js" ]; then
  echo
  echo "Running database migrations..."
  node "${APP_DIR}/scripts/migrate.js"
fi

echo
echo "[5/7] Starting CRESCI..."

systemctl restart "${SERVICE}"

echo
echo "[6/7] Running health check..."

PORT="${DEFAULT_PORT}"

if [ -f "${APP_DIR}/.env" ]; then
  ENV_PORT="$(sed -n 's/^PORT=//p' "${APP_DIR}/.env" | tail -n 1)"
  if [ -n "${ENV_PORT}" ]; then
    PORT="${ENV_PORT}"
  fi
fi

HEALTH_OK=0

for ATTEMPT in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
    HEALTH_OK=1
    break
  fi

  sleep 2
done

if [ "${HEALTH_OK}" -ne 1 ]; then
  echo "ERROR: CRESCI health check failed."
  false
fi

echo
echo "[7/7] Cleaning up..."

trap - ERR

echo
echo "======================================"
echo "        Update successful!"
echo "======================================"
echo
echo "${CURRENT_VERSION} -> ${LATEST_VERSION}"
echo
echo "Backup:"
echo "${BACKUP_PATH}"
echo