#!/usr/bin/env bash

set -Eeuo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: CRESCI update runner requires root."
  exit 1
fi

MODE="${1:---interactive}"
case "${MODE}" in --web|--interactive) ;; *) echo "ERROR: Unsupported runner mode."; exit 2 ;; esac

SOURCE="/opt/cresci/scripts/update.sh"
if [ ! -f "${SOURCE}" ] || [ ! -x "${SOURCE}" ]; then
  echo "ERROR: Trusted CRESCI updater is missing or not executable."
  exit 1
fi

TEMP_SCRIPT="$(mktemp /run/cresci-update.XXXXXX)"
trap 'rm -f "${TEMP_SCRIPT}"' EXIT
install -m 0700 -o root -g root "${SOURCE}" "${TEMP_SCRIPT}"

if [ "${MODE}" = "--web" ]; then
  /bin/bash "${TEMP_SCRIPT}" --web
else
  /bin/bash "${TEMP_SCRIPT}"
fi
