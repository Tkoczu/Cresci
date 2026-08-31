#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/cresci"
DATA_DIR="${APP_DIR}/data"
BACKUP_DIR="${APP_DIR}/backups"
REPO_URL="https://github.com/Tkoczu/Cresci.git"
GITHUB_REPO="Tkoczu/Cresci"

SERVICE_NAME="cresci"
WEB_USER="cresci"
WEB_GROUP="cresci"

STATUS_FILE="${DATA_DIR}/update-status.json"
LOCK_FILE="/run/cresci-update.lock"

MODE="${1:-}"

write_status() {
  local status="$1"
  local stage="$2"
  local message="$3"
  local version="${4:-}"
  local rollback="${5:-false}"

  mkdir -p "${DATA_DIR}"

  cat > "${STATUS_FILE}" <<EOF
{
  "status": "${status}",
  "stage": "${stage}",
  "message": "${message}",
  "version": "${version}",
  "rollback": ${rollback},
  "updatedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

  chown "${WEB_USER}:${WEB_GROUP}" "${STATUS_FILE}" 2>/dev/null || true
}

restore_permissions() {
  echo "Restoring CRESCI permissions..."

  chown -R root:root "${APP_DIR}"

  find "${APP_DIR}" -type d -exec chmod 755 {} \;
  find "${APP_DIR}" -type f -exec chmod 644 {} \;

  chmod +x "${APP_DIR}/scripts/update.sh" 2>/dev/null || true
  chmod +x "${APP_DIR}/scripts/cresci" 2>/dev/null || true
  chmod +x "${APP_DIR}/scripts/update-runner.sh" 2>/dev/null || true
  chmod +x "${APP_DIR}/scripts/install-update-helper.sh" 2>/dev/null || true

  mkdir -p "${DATA_DIR}" "${BACKUP_DIR}"

  chown -R "${WEB_USER}:${WEB_GROUP}" \
    "${DATA_DIR}" \
    "${BACKUP_DIR}"

  if [ -f "${APP_DIR}/.env" ]; then
    chown "${WEB_USER}:${WEB_GROUP}" "${APP_DIR}/.env"
    chmod 600 "${APP_DIR}/.env"
  fi
}

cleanup() {
  rm -f "${LOCK_FILE}" 2>/dev/null || true
}

trap cleanup EXIT

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: update-runner.sh must run as root."
  exit 1
fi

if [ ! -d "${APP_DIR}/.git" ]; then
  echo "ERROR: ${APP_DIR} is not a Git repository."
  exit 1
fi

if [ -e "${LOCK_FILE}" ]; then
  echo "ERROR: CRESCI update is already running."
  exit 1
fi

touch "${LOCK_FILE}"

mkdir -p "${DATA_DIR}" "${BACKUP_DIR}"

write_status \
  "running" \
  "checking" \
  "Checking latest CRESCI release..."

echo "Checking latest CRESCI release..."

LATEST_VERSION="$(
  curl -fsSL \
    -H "Accept: application/vnd.github+json" \
    -H "User-Agent: CRESCI-Updater" \
    "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" |
  sed -n 's/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' |
  head -n 1
)"

if ! printf '%s' "${LATEST_VERSION}" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+$'; then
  write_status \
    "failed" \
    "checking" \
    "Could not determine latest CRESCI release."

  echo "ERROR: Could not determine latest CRESCI release."
  exit 1
fi

CURRENT_VERSION="$(
  node -e "
    const fs = require('fs');
    const p = JSON.parse(fs.readFileSync('${APP_DIR}/package.json', 'utf8'));
    process.stdout.write('v' + p.version);
  "
)"

echo "Current version: ${CURRENT_VERSION}"
echo "Latest version:  ${LATEST_VERSION}"

if [ "${CURRENT_VERSION}" = "${LATEST_VERSION}" ]; then
  write_status \
    "completed" \
    "done" \
    "CRESCI is already up to date." \
    "${LATEST_VERSION}"

  echo "CRESCI is already up to date."
  exit 0
fi

write_status \
  "running" \
  "backup" \
  "Creating backup before update..." \
  "${LATEST_VERSION}"

TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
PREVIOUS_COMMIT="$(git -C "${APP_DIR}" rev-parse HEAD)"
BACKUP_FILE="${BACKUP_DIR}/before-update-${TIMESTAMP}.sqlite"

if [ -f "${DATA_DIR}/gym-progress.sqlite" ]; then
  cp "${DATA_DIR}/gym-progress.sqlite" "${BACKUP_FILE}"
  chown "${WEB_USER}:${WEB_GROUP}" "${BACKUP_FILE}"
fi

write_status \
  "running" \
  "download" \
  "Downloading ${LATEST_VERSION}..." \
  "${LATEST_VERSION}"

echo "Fetching ${LATEST_VERSION}..."

git -C "${APP_DIR}" fetch --tags --force origin

if ! git -C "${APP_DIR}" rev-parse "${LATEST_VERSION}^{commit}" >/dev/null 2>&1; then
  write_status \
    "failed" \
    "download" \
    "Release tag ${LATEST_VERSION} was not found."

  echo "ERROR: Release tag ${LATEST_VERSION} was not found."
  exit 1
fi

write_status \
  "running" \
  "install" \
  "Installing ${LATEST_VERSION}..." \
  "${LATEST_VERSION}"

echo "Installing ${LATEST_VERSION}..."

systemctl stop "${SERVICE_NAME}" || true

if ! git -C "${APP_DIR}" checkout --force "${LATEST_VERSION}"; then
  echo "Checkout failed. Rolling back..."

  git -C "${APP_DIR}" checkout --force "${PREVIOUS_COMMIT}" || true
  restore_permissions
  systemctl start "${SERVICE_NAME}" || true

  write_status \
    "failed" \
    "rollback" \
    "Update failed and rollback was attempted." \
    "${CURRENT_VERSION}" \
    true

  exit 1
fi

restore_permissions

write_status \
  "running" \
  "restart" \
  "Restarting CRESCI..." \
  "${LATEST_VERSION}"

systemctl daemon-reload
systemctl start "${SERVICE_NAME}"

write_status \
  "running" \
  "healthcheck" \
  "Checking CRESCI after update..." \
  "${LATEST_VERSION}"

echo "Waiting for CRESCI..."
sleep 3

if systemctl is-active --quiet "${SERVICE_NAME}"; then
  write_status \
    "completed" \
    "done" \
    "CRESCI successfully updated to ${LATEST_VERSION}." \
    "${LATEST_VERSION}"

  echo
  echo "======================================"
  echo "     CRESCI update completed"
  echo "======================================"
  echo
  echo "Version: ${LATEST_VERSION}"
  echo
  exit 0
fi

echo "Health check failed. Rolling back..."

systemctl stop "${SERVICE_NAME}" || true

git -C "${APP_DIR}" checkout --force "${PREVIOUS_COMMIT}" || true

restore_permissions

systemctl daemon-reload
systemctl start "${SERVICE_NAME}" || true

if systemctl is-active --quiet "${SERVICE_NAME}"; then
  write_status \
    "failed" \
    "rollback" \
    "Update to ${LATEST_VERSION} failed. Previous version was restored." \
    "${CURRENT_VERSION}" \
    true

  echo "Rollback completed."
else
  write_status \
    "failed" \
    "rollback" \
    "Update failed and rollback could not restore CRESCI." \
    "${CURRENT_VERSION}" \
    false

  echo "ERROR: Rollback failed."
fi

exit 1