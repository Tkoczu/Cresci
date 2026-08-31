#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/cresci"
DATA_DIR="${APP_DIR}/data"
BACKUP_DIR="${APP_DIR}/backups"

GITHUB_REPO="Tkoczu/Cresci"

SERVICE_NAME="cresci"
WEB_USER="cresci"
WEB_GROUP="cresci"

STATUS_DIR="/var/lib/cresci-updater"
STATUS_FILE="${STATUS_DIR}/status.json"

LOCK_FILE="/run/cresci-update.lock"

MODE="${1:-}"

write_status() {
  local state="$1"
  local stage="$2"
  local message="$3"
  local version="${4:-}"
  local rollback="${5:-null}"

  mkdir -p "${STATUS_DIR}"

  cat > "${STATUS_FILE}" <<EOF
{
  "state": "${state}",
  "stage": "${stage}",
  "message": "${message}",
  "target_version": "${version}",
  "rollback_succeeded": ${rollback},
  "updated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

  chown "${WEB_USER}:${WEB_GROUP}" "${STATUS_FILE}" 2>/dev/null || true
  chmod 640 "${STATUS_FILE}" 2>/dev/null || true
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

  mkdir -p "${STATUS_DIR}"
  chown "${WEB_USER}:${WEB_GROUP}" "${STATUS_DIR}"
  chmod 750 "${STATUS_DIR}"

  if [ -f "${STATUS_FILE}" ]; then
    chown "${WEB_USER}:${WEB_GROUP}" "${STATUS_FILE}"
    chmod 640 "${STATUS_FILE}"
  fi
}

cleanup() {
  rm -f "${LOCK_FILE}" 2>/dev/null || true
}

rollback_to_previous() {
  local previous_commit="$1"
  local current_version="$2"
  local target_version="$3"

  echo "Rolling back to previous CRESCI version..."

  systemctl stop "${SERVICE_NAME}" || true

  git -C "${APP_DIR}" checkout --force "${previous_commit}" || true

  restore_permissions

  systemctl daemon-reload
  systemctl start "${SERVICE_NAME}" || true

  sleep 2

  if systemctl is-active --quiet "${SERVICE_NAME}"; then
    write_status \
      "failed" \
      "rollback" \
      "Aktualizacja do ${target_version} nie powiodła się. Poprzednia wersja została przywrócona." \
      "${target_version}" \
      true

    echo "Rollback completed."
    return 0
  fi

  write_status \
    "failed" \
    "rollback" \
    "Aktualizacja nie powiodła się i nie udało się automatycznie przywrócić poprzedniej wersji." \
    "${target_version}" \
    false

  echo "ERROR: Rollback failed."
  return 1
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

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl is required."
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "ERROR: git is required."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node is required."
  exit 1
fi

if [ -e "${LOCK_FILE}" ]; then
  echo "ERROR: CRESCI update is already running."
  exit 1
fi

touch "${LOCK_FILE}"

mkdir -p "${DATA_DIR}" "${BACKUP_DIR}" "${STATUS_DIR}"

chown "${WEB_USER}:${WEB_GROUP}" "${STATUS_DIR}" 2>/dev/null || true
chmod 750 "${STATUS_DIR}" 2>/dev/null || true

write_status \
  "running" \
  "checking" \
  "Sprawdzanie najnowszego wydania CRESCI..."

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
    "Nie udało się ustalić najnowszej wersji CRESCI."

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
    "success" \
    "done" \
    "CRESCI jest już w najnowszej wersji." \
    "${LATEST_VERSION}"

  echo "CRESCI is already up to date."
  exit 0
fi

write_status \
  "running" \
  "backup" \
  "Tworzenie kopii bezpieczeństwa przed aktualizacją..." \
  "${LATEST_VERSION}"

TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
PREVIOUS_COMMIT="$(git -C "${APP_DIR}" rev-parse HEAD)"
BACKUP_FILE="${BACKUP_DIR}/before-update-${TIMESTAMP}.sqlite"

if [ -f "${DATA_DIR}/gym-progress.sqlite" ]; then
  cp "${DATA_DIR}/gym-progress.sqlite" "${BACKUP_FILE}"

  chown "${WEB_USER}:${WEB_GROUP}" "${BACKUP_FILE}"
  chmod 600 "${BACKUP_FILE}"

  echo "Database backup: ${BACKUP_FILE}"
else
  echo "Database file not found. Skipping database backup."
fi

write_status \
  "running" \
  "download" \
  "Pobieranie wydania ${LATEST_VERSION}..." \
  "${LATEST_VERSION}"

echo "Fetching ${LATEST_VERSION}..."

git -C "${APP_DIR}" fetch --tags --force origin

if ! git -C "${APP_DIR}" rev-parse "${LATEST_VERSION}^{commit}" >/dev/null 2>&1; then
  write_status \
    "failed" \
    "download" \
    "Nie znaleziono taga wydania ${LATEST_VERSION}." \
    "${LATEST_VERSION}"

  echo "ERROR: Release tag ${LATEST_VERSION} was not found."
  exit 1
fi

write_status \
  "running" \
  "install" \
  "Instalowanie ${LATEST_VERSION}..." \
  "${LATEST_VERSION}"

echo "Installing ${LATEST_VERSION}..."

systemctl stop "${SERVICE_NAME}" || true

if ! git -C "${APP_DIR}" checkout --force "${LATEST_VERSION}"; then
  echo "Checkout failed."

  rollback_to_previous \
    "${PREVIOUS_COMMIT}" \
    "${CURRENT_VERSION}" \
    "${LATEST_VERSION}"

  exit 1
fi

restore_permissions

write_status \
  "running" \
  "restart" \
  "Ponowne uruchamianie CRESCI..." \
  "${LATEST_VERSION}"

systemctl daemon-reload

if ! systemctl start "${SERVICE_NAME}"; then
  echo "CRESCI failed to start."

  rollback_to_previous \
    "${PREVIOUS_COMMIT}" \
    "${CURRENT_VERSION}" \
    "${LATEST_VERSION}"

  exit 1
fi

write_status \
  "running" \
  "health_check" \
  "Sprawdzanie działania CRESCI po aktualizacji..." \
  "${LATEST_VERSION}"

echo "Waiting for CRESCI..."

HEALTH_OK=0

for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if systemctl is-active --quiet "${SERVICE_NAME}"; then
    HEALTH_OK=1
    break
  fi

  sleep 1
done

if [ "${HEALTH_OK}" -eq 1 ]; then
  INSTALLED_VERSION="$(
    node -e "
      const fs = require('fs');
      const p = JSON.parse(fs.readFileSync('${APP_DIR}/package.json', 'utf8'));
      process.stdout.write('v' + p.version);
    "
  )"

  if [ "${INSTALLED_VERSION}" != "${LATEST_VERSION}" ]; then
    echo "ERROR: Installed version mismatch."
    echo "Expected: ${LATEST_VERSION}"
    echo "Found:    ${INSTALLED_VERSION}"

    rollback_to_previous \
      "${PREVIOUS_COMMIT}" \
      "${CURRENT_VERSION}" \
      "${LATEST_VERSION}"

    exit 1
  fi

  write_status \
    "success" \
    "done" \
    "CRESCI zostało pomyślnie zaktualizowane do ${LATEST_VERSION}." \
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

echo "Health check failed."

rollback_to_previous \
  "${PREVIOUS_COMMIT}" \
  "${CURRENT_VERSION}" \
  "${LATEST_VERSION}"

exit 1