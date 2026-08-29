#!/usr/bin/env bash

set -Eeuo pipefail

APP_DIR="/opt/cresci"
BACKUP_DIR="/var/backups/cresci"
STATUS_DIR="/var/lib/cresci-updater"
STATUS_FILE="${STATUS_DIR}/status.json"
REPO="Tkoczu/Cresci"
REPO_URL="https://github.com/Tkoczu/Cresci.git"
SERVICE="cresci"
DEFAULT_PORT="4173"
WEB_MODE=0
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
LATEST_VERSION=""

if [ "${#}" -gt 1 ]; then
  echo "ERROR: Unsupported updater arguments."
  exit 2
fi
if [ "${1:-}" = "--web" ]; then
  WEB_MODE=1
elif [ "${#}" -ne 0 ]; then
  echo "ERROR: Unsupported updater argument."
  exit 2
fi

write_status() {
  [ "${WEB_MODE}" -eq 1 ] || return 0
  local state="${1}" stage="${2}" message="${3}" rollback="${4:-null}"
  install -d -m 0750 -o root -g cresci "${STATUS_DIR}"
  STATUS_STATE="${state}" STATUS_STAGE="${stage}" STATUS_MESSAGE="${message}" \
  STATUS_ROLLBACK="${rollback}" STATUS_STARTED_AT="${STARTED_AT}" STATUS_CURRENT="${CURRENT_VERSION:-}" STATUS_TARGET="${LATEST_VERSION}" \
  STATUS_FILE="${STATUS_FILE}" /usr/bin/node -e '
    const fs=require("fs");
    const rollback=process.env.STATUS_ROLLBACK==="true"?true:process.env.STATUS_ROLLBACK==="false"?false:null;
    const now=new Date().toISOString();
    const payload={state:process.env.STATUS_STATE,stage:process.env.STATUS_STAGE,message:process.env.STATUS_MESSAGE,current_version:process.env.STATUS_CURRENT||null,target_version:process.env.STATUS_TARGET||null,rollback_succeeded:rollback,started_at:process.env.STATUS_STARTED_AT,updated_at:now,completed_at:["success","failed"].includes(process.env.STATUS_STATE)?now:null};
    const tmp=`${process.env.STATUS_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp,JSON.stringify(payload,null,2),{mode:0o640});
    fs.renameSync(tmp,process.env.STATUS_FILE);
    fs.chmodSync(process.env.STATUS_FILE,0o640);
  '
  chown root:cresci "${STATUS_FILE}"
}

fail_before_install() {
  local message="${1}"
  write_status failed "${2:-preparation}" "${message}" null
  echo "ERROR: ${message}"
  exit 1
}

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: Run updater as root."
  exit 1
fi
if [ ! -d "${APP_DIR}/.git" ]; then
  fail_before_install "CRESCI installation not found in ${APP_DIR}." preparation
fi
if ! id cresci >/dev/null 2>&1; then
  fail_before_install "System user cresci is missing. Run install-update-helper.sh first." preparation
fi

cd "${APP_DIR}"
GIT=(git -c safe.directory="${APP_DIR}")
CURRENT_VERSION="$("${GIT[@]}" describe --tags --exact-match 2>/dev/null || "${GIT[@]}" rev-parse --short HEAD)"

echo
echo "======================================"
echo "          CRESCI Updater"
echo "======================================"
echo
echo "Current version: ${CURRENT_VERSION}"
echo "Checking GitHub Releases..."
write_status running preparation "Sprawdzanie najnowszego GitHub Release."

if ! RELEASE_JSON="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest")"; then
  fail_before_install "Could not read the latest public CRESCI release from GitHub." download
fi
LATEST_VERSION="$(printf '%s' "${RELEASE_JSON}" | sed -n 's/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
if [ -z "${LATEST_VERSION}" ]; then
  fail_before_install "Could not determine the latest public CRESCI release." download
fi
if ! [[ "${LATEST_VERSION}" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
  fail_before_install "GitHub returned an invalid release tag." download
fi

echo "Latest version:  ${LATEST_VERSION}"
if [ "${CURRENT_VERSION}" = "${LATEST_VERSION}" ]; then
  write_status success complete "CRESCI is already up to date."
  echo "CRESCI is already up to date."
  exit 0
fi

if [ "${WEB_MODE}" -ne 1 ]; then
  echo
  read -r -p "Install update? [y/N]: " CONFIRM
  case "${CONFIRM}" in y|Y|yes|YES) ;; *) echo "Update cancelled."; exit 0 ;; esac
fi

TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
BACKUP_PATH="${BACKUP_DIR}/${TIMESTAMP}"
PREVIOUS_COMMIT="$("${GIT[@]}" rev-parse HEAD)"
mkdir -p "${BACKUP_PATH}"

echo "[1/6] Creating backup..."
write_status running backup "Tworzenie kopii zapasowej danych i konfiguracji."
[ ! -f "${APP_DIR}/.env" ] || cp "${APP_DIR}/.env" "${BACKUP_PATH}/.env"
[ ! -d "${APP_DIR}/data" ] || tar -czf "${BACKUP_PATH}/data.tar.gz" -C "${APP_DIR}" data
echo "${CURRENT_VERSION}" > "${BACKUP_PATH}/version.txt"
echo "${PREVIOUS_COMMIT}" > "${BACKUP_PATH}/commit.txt"

echo "[2/6] Downloading ${LATEST_VERSION}..."
write_status running download "Pobieranie wydania ${LATEST_VERSION} z GitHub Releases."
if ! "${GIT[@]}" fetch --force --no-tags "${REPO_URL}" "+refs/tags/${LATEST_VERSION}:refs/tags/${LATEST_VERSION}"; then
  fail_before_install "Could not download release tag ${LATEST_VERSION}." download
fi
if ! "${GIT[@]}" rev-parse --verify "refs/tags/${LATEST_VERSION}^{commit}" >/dev/null 2>&1; then
  fail_before_install "Release tag ${LATEST_VERSION} was not found after download." download
fi

rollback() {
  trap - ERR
  set +e
  echo "UPDATE FAILED - starting rollback"
  write_status running rollback "Aktualizacja nie powiodła się. Przywracanie poprzedniej wersji." null
  cd "${APP_DIR}" || true
  local rollback_ok=1
  "${GIT[@]}" checkout --force --detach "${PREVIOUS_COMMIT}" || rollback_ok=0
  [ ! -f "${BACKUP_PATH}/.env" ] || cp "${BACKUP_PATH}/.env" "${APP_DIR}/.env" || rollback_ok=0
  if [ -f "${BACKUP_PATH}/data.tar.gz" ]; then
    rm -rf "${APP_DIR}/data" || rollback_ok=0
    tar -xzf "${BACKUP_PATH}/data.tar.gz" -C "${APP_DIR}" || rollback_ok=0
  fi
  install -d -m 0750 -o cresci -g cresci "${APP_DIR}/data" "${APP_DIR}/backups" || rollback_ok=0
  chown -R cresci:cresci "${APP_DIR}/data" "${APP_DIR}/backups" || rollback_ok=0
  if [ -f "${APP_DIR}/.env" ]; then chown cresci:cresci "${APP_DIR}/.env"; chmod 0600 "${APP_DIR}/.env"; fi
  systemctl restart "${SERVICE}" || rollback_ok=0
  if [ "${rollback_ok}" -eq 1 ]; then
    write_status failed rollback "Aktualizacja nie powiodła się. Poprzednia wersja została przywrócona." true
  else
    write_status failed rollback "Aktualizacja i automatyczny rollback nie powiodły się. Sprawdź journalctl -u cresci-update.service." false
  fi
  exit 1
}
trap rollback ERR

echo "[3/6] Installing ${LATEST_VERSION}..."
write_status running install "Instalowanie wydania ${LATEST_VERSION}."
systemctl stop "${SERVICE}"
"${GIT[@]}" checkout --force --detach "refs/tags/${LATEST_VERSION}"

INSTALLED_VERSION="$(/usr/bin/node -p "JSON.parse(require('fs').readFileSync('${APP_DIR}/package.json','utf8').replace(/^\\uFEFF/,'')).version")"
NORMALIZED_TAG="${LATEST_VERSION#v}"
if [ "${INSTALLED_VERSION}" != "${NORMALIZED_TAG}" ]; then
  echo "ERROR: package.json version ${INSTALLED_VERSION} does not match release ${LATEST_VERSION}."
  false
fi

install -d -m 0750 -o cresci -g cresci "${APP_DIR}/data" "${APP_DIR}/backups"
if [ -f "${APP_DIR}/package-lock.json" ]; then npm ci --omit=dev; fi
if [ -f "${APP_DIR}/scripts/migrate.js" ]; then node "${APP_DIR}/scripts/migrate.js"; fi
chown -R root:root "${APP_DIR}/scripts"
chmod 0755 "${APP_DIR}/scripts/update.sh" "${APP_DIR}/scripts/cresci" "${APP_DIR}/scripts/update-runner.sh" "${APP_DIR}/scripts/install-update-helper.sh"
chown -R cresci:cresci "${APP_DIR}/data" "${APP_DIR}/backups"
if [ -f "${APP_DIR}/.env" ]; then chown cresci:cresci "${APP_DIR}/.env"; chmod 0600 "${APP_DIR}/.env"; fi

echo "[4/6] Restarting CRESCI..."
write_status running restart "Restart usługi CRESCI."
systemctl restart "${SERVICE}"

echo "[5/6] Running health check..."
write_status running health_check "Sprawdzanie działania nowej wersji."
PORT="${DEFAULT_PORT}"
if [ -f "${APP_DIR}/.env" ]; then
  ENV_PORT="$(sed -n 's/^PORT=//p' "${APP_DIR}/.env" | tail -n 1)"
  [ -z "${ENV_PORT}" ] || PORT="${ENV_PORT}"
fi
HEALTH_OK=0
for ATTEMPT in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then HEALTH_OK=1; break; fi
  sleep 2
done
if [ "${HEALTH_OK}" -ne 1 ]; then echo "ERROR: CRESCI health check failed."; false; fi

echo "[6/6] Update complete."
trap - ERR
install -m 0755 -o root -g root "${APP_DIR}/scripts/update-runner.sh" /usr/local/libexec/cresci-update-runner
write_status success complete "CRESCI zostało zaktualizowane do ${LATEST_VERSION}."
echo "${CURRENT_VERSION} -> ${LATEST_VERSION}"
echo "Backup: ${BACKUP_PATH}"
