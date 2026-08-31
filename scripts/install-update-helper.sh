#!/usr/bin/env bash

set -Eeuo pipefail

APP_DIR="/opt/cresci"
APP_USER="cresci"
SERVICE="cresci"
RUNNER_TARGET="/usr/local/libexec/cresci-update-runner"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: Run this helper installer as root inside the CRESCI LXC."
  exit 1
fi
if [ ! -d "${APP_DIR}" ] || [ ! -f "${APP_DIR}/server.js" ]; then
  echo "ERROR: CRESCI installation was not found in ${APP_DIR}."
  exit 1
fi
if ! command -v sudo >/dev/null 2>&1 || ! command -v visudo >/dev/null 2>&1; then
  echo "ERROR: Install the sudo package before configuring the update helper."
  exit 1
fi

if ! id "${APP_USER}" >/dev/null 2>&1; then
  useradd --system --home-dir "${APP_DIR}" --shell /usr/sbin/nologin "${APP_USER}"
fi

systemctl stop "${SERVICE}" 2>/dev/null || true
trap 'systemctl restart "${SERVICE}" 2>/dev/null || true' ERR

# Application code and the updater remain root-owned. The web process may write
# only runtime data, backups and its local configuration.
chown -R root:root "${APP_DIR}"
install -d -m 0750 -o "${APP_USER}" -g "${APP_USER}" "${APP_DIR}/data" "${APP_DIR}/backups"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}/data" "${APP_DIR}/backups"
if [ -f "${APP_DIR}/.env" ]; then chown "${APP_USER}:${APP_USER}" "${APP_DIR}/.env"; chmod 0600 "${APP_DIR}/.env"; fi
chmod 0755 "${APP_DIR}/scripts/update.sh" "${APP_DIR}/scripts/cresci" "${APP_DIR}/scripts/update-runner.sh" "${APP_DIR}/scripts/install-update-helper.sh"

install -d -m 0755 -o root -g root /usr/local/libexec
install -m 0755 -o root -g root "${APP_DIR}/scripts/update-runner.sh" "${RUNNER_TARGET}"
install -d -m 0750 -o root -g "${APP_USER}" /var/lib/cresci-updater
install -d -m 0750 -o root -g root /var/backups/cresci

cat > /etc/systemd/system/cresci-update.service <<'EOF'
[Unit]
Description=CRESCI fixed release updater
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=root
Group=root
UMask=0027
ExecStart=/opt/cresci/scripts/update-runner.sh --web
EOF

install -d -m 0755 -o root -g root /etc/systemd/system/cresci.service.d
cat > /etc/systemd/system/cresci.service.d/10-security-and-updates.conf <<'EOF'
[Service]
User=cresci
Group=cresci
Environment=NODE_ENV=production
Environment=CRESCI_UPDATE_ENABLED=1
EOF

cat > /etc/sudoers.d/cresci-update <<'EOF'
cresci ALL=(root) NOPASSWD: /usr/bin/systemctl start --no-block cresci-update.service
EOF
chmod 0440 /etc/sudoers.d/cresci-update
visudo -cf /etc/sudoers.d/cresci-update >/dev/null

systemctl daemon-reload
trap - ERR
systemctl restart "${SERVICE}"

echo "CRESCI update helper installed."
echo "Web service user: ${APP_USER}"
echo "Allowed privileged command: /usr/bin/systemctl start --no-block cresci-update.service"
