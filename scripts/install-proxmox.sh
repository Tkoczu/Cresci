#!/usr/bin/env bash

set -e

APP_NAME="CRESCI"
APP_VERSION="v1.0.2"
REPO_URL="https://github.com/Tkoczu/Cresci.git"

CPU_CORES=2
MEMORY_MB=4096
DISK_GB=16
HOSTNAME="cresci"
BRIDGE="vmbr0"

echo
echo "======================================"
echo "        CRESCI LXC Installer"
echo "======================================"
echo

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: Run this script as root on the Proxmox host."
  exit 1
fi

if ! command -v pct >/dev/null 2>&1; then
  echo "ERROR: This does not appear to be a Proxmox VE host."
  exit 1
fi

echo "[1/10] Detecting free container ID..."
CTID="$(pvesh get /cluster/nextid)"
echo "Container ID: ${CTID}"

echo
echo "[2/10] Detecting storage..."

ROOT_STORAGE=""
for STORAGE in local-lvm local-zfs local; do
  if pvesm status 2>/dev/null | awk 'NR>1 {print $1}' | grep -qx "${STORAGE}"; then
    if pvesm status -storage "${STORAGE}" 2>/dev/null | grep -q "rootdir"; then
      ROOT_STORAGE="${STORAGE}"
      break
    fi
  fi
done

if [ -z "${ROOT_STORAGE}" ]; then
  ROOT_STORAGE="$(pvesm status -content rootdir 2>/dev/null | awk 'NR==2 {print $1}')"
fi

if [ -z "${ROOT_STORAGE}" ]; then
  echo "ERROR: No storage supporting LXC root disks was found."
  exit 1
fi

TEMPLATE_STORAGE="$(pvesm status -content vztmpl 2>/dev/null | awk 'NR==2 {print $1}')"

if [ -z "${TEMPLATE_STORAGE}" ]; then
  echo "ERROR: No storage supporting container templates was found."
  exit 1
fi

echo "Container storage: ${ROOT_STORAGE}"
echo "Template storage:  ${TEMPLATE_STORAGE}"

echo
echo "[3/10] Looking for Debian 13 template..."

pveam update >/dev/null

TEMPLATE="$(pveam available --section system | awk '/debian-13-standard/ && /amd64/ {print $2}' | tail -n 1)"

if [ -z "${TEMPLATE}" ]; then
  echo "ERROR: Debian 13 LXC template was not found."
  exit 1
fi

echo "Template: ${TEMPLATE}"

if ! pveam list "${TEMPLATE_STORAGE}" | grep -q "${TEMPLATE}"; then
  echo "Downloading Debian 13 template..."
  pveam download "${TEMPLATE_STORAGE}" "${TEMPLATE}"
else
  echo "Template already downloaded."
fi

echo
echo "[4/10] Creating LXC ${CTID}..."

pct create "${CTID}" "${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE}" \
  --hostname "${HOSTNAME}" \
  --cores "${CPU_CORES}" \
  --memory "${MEMORY_MB}" \
  --swap 512 \
  --rootfs "${ROOT_STORAGE}:${DISK_GB}" \
  --net0 "name=eth0,bridge=${BRIDGE},ip=dhcp,type=veth" \
  --unprivileged 1 \
  --onboot 1 \
  --features keyctl=1 \
  --start 0

echo
echo "[5/10] Starting LXC..."

pct start "${CTID}"

echo "Waiting for container..."
sleep 5

echo
echo "[6/10] Installing system packages..."

pct exec "${CTID}" -- bash -c '
set -e

apt-get update
apt-get install -y \
  ca-certificates \
  curl \
  git \
  gnupg \
  sudo

curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

echo "Node version:"
node --version
'

echo
echo "[7/10] Downloading CRESCI ${APP_VERSION}..."

pct exec "${CTID}" -- bash -c "
set -e

rm -rf /opt/cresci

git clone \
  --branch '${APP_VERSION}' \
  --depth 1 \
  '${REPO_URL}' \
  /opt/cresci

mkdir -p /opt/cresci/data
mkdir -p /opt/cresci/backups
"

echo
echo "[8/10] Creating CRESCI configuration..."

pct exec "${CTID}" -- bash -c "cat > /opt/cresci/.env <<'EOF'
PORT=4173
HOST=0.0.0.0
DATABASE_PATH=/opt/cresci/data/gym-progress.sqlite

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
EOF
"

echo
echo "[9/10] Creating systemd service..."

pct exec "${CTID}" -- bash -c "cat > /etc/systemd/system/cresci.service <<'EOF'
[Unit]
Description=CRESCI
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/cresci
EnvironmentFile=/opt/cresci/.env
Environment=NODE_ENV=production
Environment=CRESCI_UPDATE_ENABLED=1
ExecStart=/usr/bin/node /opt/cresci/server.js
Restart=unless-stopped
RestartSec=5
User=cresci
Group=cresci

[Install]
WantedBy=multi-user.target
EOF

id cresci >/dev/null 2>&1 || useradd --system --home-dir /opt/cresci --shell /usr/sbin/nologin cresci
chown -R root:root /opt/cresci
chown -R cresci:cresci /opt/cresci/data /opt/cresci/backups
chown cresci:cresci /opt/cresci/.env
chmod 0600 /opt/cresci/.env
systemctl daemon-reload
systemctl enable cresci
systemctl start cresci
"

echo
echo "Installing CRESCI management command..."

pct exec "${CTID}" -- bash -c "
chmod +x /opt/cresci/scripts/update.sh
chmod +x /opt/cresci/scripts/cresci
chmod +x /opt/cresci/scripts/update-runner.sh
chmod +x /opt/cresci/scripts/install-update-helper.sh
ln -sf /opt/cresci/scripts/cresci /usr/local/bin/cresci
/opt/cresci/scripts/install-update-helper.sh
"
echo
echo "[10/10] Checking CRESCI..."

sleep 3

if pct exec "${CTID}" -- systemctl is-active --quiet cresci; then
  STATUS="RUNNING"
else
  echo
  echo "ERROR: CRESCI service failed to start."
  echo
  pct exec "${CTID}" -- journalctl -u cresci --no-pager -n 50
  exit 1
fi

IP="$(pct exec "${CTID}" -- hostname -I | awk '{print $1}')"

echo
echo "======================================"
echo "       CRESCI installation done!"
echo "======================================"
echo
echo "Version:      ${APP_VERSION}"
echo "Container ID: ${CTID}"
echo "Hostname:     ${HOSTNAME}"
echo "Status:       ${STATUS}"
echo
echo "CRESCI:"
echo "http://${IP}:4173"
echo
echo "The container will start automatically"
echo "with the Proxmox host."
echo


