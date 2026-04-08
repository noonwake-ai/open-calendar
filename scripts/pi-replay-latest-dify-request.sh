#!/usr/bin/env bash
set -euo pipefail

PI_HOST="${PI_HOST:-192.168.48.253}"
PI_USER="${PI_USER:-noonwake}"
PI_PASS="${PI_PASS:-noonwake}"

sshpass -p "$PI_PASS" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/tmp/open-calendar_known_hosts "$PI_USER@$PI_HOST" '
python3 - <<'"'"'PY'"'"'
import json
import pathlib
import urllib.request
import urllib.error

frontend_log = pathlib.Path.home() / ".local/state/pi-event-bridge/frontend.log"
config_path = pathlib.Path("/home/noonwake/app/dist-pi/config/config.json")

latest = None
for raw in frontend_log.read_text().splitlines():
    if "scope=consumer:dify message=completion.request.start extra=" not in raw:
        continue
    latest = raw

if latest is None:
    raise SystemExit("未找到 consumer:dify completion.request.start 日志")

prefix = "extra="
extra_json = latest[latest.index(prefix) + len(prefix):]
extra = json.loads(extra_json)

cfg = json.loads(config_path.read_text())
api_key = cfg["DIFY"]["HEXAGRAM_REPORT_KEY"]
body = {
    "inputs": extra["inputs"],
    "user": extra["user"],
    "files": [],
    "response_mode": extra["responseMode"],
}

targets = [
    ("proxy", "http://127.0.0.1:8082/dify/completion-messages"),
    ("upstream_http", "http://dify-cn.noonwake.net/v1/completion-messages"),
]

print("== latest request summary ==")
print(json.dumps({
    "question": body["inputs"].get("question"),
    "hexagram": body["inputs"].get("hexagram"),
    "user": body["user"],
    "inputKeys": list(body["inputs"].keys()),
    "userBaziLength": len(body["inputs"].get("user_bazi_info", "")),
}, ensure_ascii=False, indent=2))

for name, url in targets:
    req = urllib.request.Request(
        url,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )
    print(f"\n== replay {name} ==")
    print(url)
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            body_text = resp.read().decode("utf-8", "ignore")
            print(f"status={resp.status}")
            print(body_text[:1200])
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", "ignore")
        print(f"status={e.code}")
        print(body_text[:1200])
    except Exception as e:
        print(type(e).__name__)
        print(str(e))
PY
'
