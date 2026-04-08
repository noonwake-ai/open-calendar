# Pi Event Bridge Handoff

## Purpose
This service runs locally on the Raspberry Pi and converts three physical inputs into simple event states for upstream business logic.

It does **not** perform wake, recording, or divination logic itself.
It only emits events.

## Inputs
- Wake button
- Record button
- Shake lever

## Event contract
The upstream service only needs to consume `kind` + `action`.

### Wake
```json
{"kind":"wake","action":"trigger"}
```

### Record start
```json
{"kind":"record","action":"start"}
```

### Record stop
```json
{"kind":"record","action":"stop"}
```

### Shake trigger
```json
{"kind":"shake","action":"trigger"}
```

## Access pattern
Do **not** hardcode the current Raspberry Pi LAN IP.

### Recommended
If your business service runs on the same Raspberry Pi, use:
```txt
http://127.0.0.1:8765
```

If your business service runs on another machine, make the base URL configurable, for example:
```txt
PI_EVENT_BRIDGE_BASE_URL=http://<raspberry-pi-ip>:8765
```

## Simplest integration
Poll:
```txt
GET /state
```

Read:
- `latest.seq`
- `latest.kind`
- `latest.action`

When `latest.seq` changes, a new hardware event has arrived.

## API
### Health
```txt
GET /health
```

### Current state
```txt
GET /state
```

### Recent events
```txt
GET /events
```

### Local test page
```txt
GET /test
```

### Manual trigger endpoints
```txt
POST /trigger/wake
POST /trigger/record/start
POST /trigger/record/stop
POST /trigger/shake
```

## Example `/state` response
```json
{
  "ok": true,
  "recording": false,
  "latest": {
    "seq": 12,
    "ts": "2026-04-05T22:12:11+08:00",
    "kind": "shake",
    "action": "trigger"
  },
  "counts": {
    "wake": 1,
    "record_start": 3,
    "record_stop": 3,
    "shake": 2
  }
}
```

## Hardware wiring
Use **physical pin numbers** on the Raspberry Pi 40-pin header.

### Wake button
- signal -> Pin 15 (GPIO22)
- GND -> Pin 14

### Record button
- signal -> Pin 16 (GPIO23)
- GND -> Pin 20

### Shake lever
Single-side test:
- COM -> Pin 25 (GND)
- NO -> Pin 18 (GPIO24)
- NC -> not connected

Final two-direction version:
- left COM + right COM -> Pin 25 (GND)
- left NO + right NO -> Pin 18 (GPIO24)
- both NC -> not connected

## Rules
- GND can be shared.
- Signal pins must stay separate.
- Lever must use **COM + NO**.
- Do not replace it with `NC + NO`.

## Local files
- `~/pi_event_bridge.py`
- `~/.config/systemd/user/pi-event-bridge.service`
- `~/.local/state/pi-event-bridge/latest.json`
- `~/.local/state/pi-event-bridge/events.jsonl`

## Restore package
Bundle includes:
- `pi_event_bridge.py`
- `pi-event-bridge.service`
- `install.sh`
- `README.md`
- `WIRING.svg`
- `pi-event-bridge-20260405.tar.gz`

## Systemd
```bash
systemctl --user status pi-event-bridge.service
systemctl --user restart pi-event-bridge.service
journalctl --user -u pi-event-bridge.service -n 50 --no-pager
```

## Handoff summary
This is a local GPIO event bridge.
Your side only needs to connect business logic to these events:
- wake.trigger
- record.start
- record.stop
- shake.trigger
