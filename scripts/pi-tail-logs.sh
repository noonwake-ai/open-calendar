#!/usr/bin/env bash
set -euo pipefail

PI_HOST="${PI_HOST:-192.168.48.253}"
PI_USER="${PI_USER:-noonwake}"
PI_PASS="${PI_PASS:-noonwake}"

sshpass -p "$PI_PASS" ssh -o StrictHostKeyChecking=no "$PI_USER@$PI_HOST" '
mkdir -p ~/.local/state/pi-event-bridge
touch ~/.local/state/pi-event-bridge/bridge.log ~/.local/state/pi-event-bridge/frontend.log
echo "== tail bridge.log + frontend.log on $(hostname) =="
tail -F ~/.local/state/pi-event-bridge/bridge.log ~/.local/state/pi-event-bridge/frontend.log
'
