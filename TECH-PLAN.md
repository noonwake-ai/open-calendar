# 树莓派 Home App 技术方案

> 基于现有 `src/pi/` 项目，面向树莓派桌面终端产品的技术选型与演进路线。

## 1. 现有技术基础

| 模块 | 技术栈 | 状态 |
|------|--------|------|
| 前端框架 | React 18 + Vite 5 + TypeScript | ✅ 已搭建 |
| UI 组件 | Ant Design + Tailwind CSS + 自定义 Design Tokens | ✅ 已搭建 |
| AI 对话 | Dify API（流式对话 + Agent Thoughts） | ✅ 已接入 |
| 语音播报 | 火山引擎 TTS（管线化合成 + 顺序播放） | ✅ 已接入 |
| 本地存储 | Dexie.js (IndexedDB) 对话记录 | ✅ 已接入 |
| 双屏通信 | BroadcastChannel（主屏 ↔ 投影屏） | ✅ 已搭建 |
| 设备配对 | QR 码 + 手机验证码 | ✅ 已搭建 |
| 角色动画 | 视频素材自动映射（10 个十神 × 4 场景） | ✅ 已搭建 |

---

## 2. 开发调试工具链

### 2.1 核心工具矩阵（对标 Xcode / Android Studio）

| 需求 | 工具 | 安装复杂度 | 与 Xcode/AS 对比 |
|------|------|-----------|-----------------|
| 代码编写/调试 | VS Code Remote-SSH | 低 | ≈ AS Remote Device |
| Web 应用调试 | Chromium CDP + SSH 隧道 | 中 | = Safari Web Inspector |
| 热重载 | Vite HMR + SSH 隧道 / rsync + fswatch | 低 | ≈ AS Instant Run |
| 性能监控 | Netdata (Web 仪表盘) | 极低 | 比 Xcode Instruments 更直观 |
| 进程/服务管理 | Cockpit (Web 管理面板) | 低 | ≈ AS Device Manager + Logcat |
| 日志查看 | journalctl -f / PM2 logs | 极低 | ≈ Logcat |
| Pi 专项管理 | PiCockpit (SaaS, 免费 5 台) | 低 | Pi 独有 |
| 终端监控 | btop | 极低 | 比 htop 更现代 |

### 2.2 VS Code Remote-SSH（代码主战场）

VS Code 在本机运行 UI，所有代码编辑、终端、调试都在 Pi 上执行：

```bash
# Mac ~/.ssh/config
Host pi
  HostName 192.168.x.x
  User pi
  IdentityFile ~/.ssh/id_rsa

# VS Code 命令面板：Remote-SSH: Connect to Host → pi
```

推荐 VS Code 扩展：
- `ms-vscode-remote.remote-ssh` — 核心远程连接
- `ms-vscode.js-debug` — JS/Node.js 调试
- `DaryoushAlipourtirotir.remote-raspberry-pi-connector` — Pi 专用，支持 GPIO 管理

### 2.3 Chromium 远程 DevTools（Web 调试）

Pi 上 Chromium 启动时加 `--remote-debugging-port=9222`，通过 SSH 隧道在本机 Chrome 打开完整 DevTools：

```bash
# Mac 上建立隧道
ssh -fN -L 9222:localhost:9222 -L 9223:localhost:9223 pi@raspberrypi.local

# 打开 chrome://inspect → Configure → 添加 localhost:9222 / localhost:9223
# 两个 Kiosk 窗口可同时调试，互不干扰
```

VS Code 也可以直接 attach 调试（见下方 `.vscode/launch.json`）。

### 2.4 性能监控

**Netdata**（推荐，零配置开箱即用）：
```bash
# Pi 上安装
wget -O /tmp/netdata-kickstart.sh https://my-netdata.io/kickstart.sh
sudo sh /tmp/netdata-kickstart.sh
# 访问 http://raspberrypi:19999
```
实时 CPU per-core、内存、磁盘 I/O、网络、温度，刷新率 1 秒。

**Cockpit**（Web 管理面板，等效 Android Device Manager + Logcat）：
```bash
sudo apt install cockpit
sudo systemctl enable --now cockpit.socket
# 访问 https://raspberrypi:9090
```
Systemd 服务管理、Journal 实时日志、CPU/内存曲线、终端直连。

**命令行快速检查**：
```bash
vcgencmd measure_temp       # GPU 温度
vcgencmd get_throttled      # 是否因高温降频
cat /sys/class/thermal/thermal_zone0/temp  # CPU 温度（毫度）
btop                        # 全功能终端监控
```

### 2.5 SSH 隧道一键命令

在 Mac `~/.zshrc` 中添加：

```bash
alias pi-tunnel='ssh -fN \
    -L 9222:localhost:9222 \
    -L 9223:localhost:9223 \
    -L 8082:localhost:8082 \
    -L 19999:localhost:19999 \
    -L 9090:localhost:9090 \
    pi@raspberrypi.local && echo "Pi tunnel established"'
```

---

## 3. Kiosk 模式部署方案

### 3.1 系统架构

```
┌──────────────────────────────────────────────────────────┐
│  开发机 (macOS)                                          │
│   yarn build-pi → dist-pi/                              │
│   make deploy  → rsync → Pi                             │
│   SSH 隧道 ←→ Chrome DevTools (9222/9223)               │
└──────────────────────┬───────────────────────────────────┘
                       │ SSH / rsync
┌──────────────────────▼───────────────────────────────────┐
│  Raspberry Pi 5 (Bookworm / Wayland / Wayfire)          │
│                                                          │
│  nginx (静态文件服务 :8082, /pi/)                        │
│  PM2 → hardware-service (Node.js 硬件桥接 :3001)        │
│                                                          │
│  Wayfire 自启:                                           │
│  ├── Chromium 1 → HDMI-A-1 主屏  :9222 (DevTools)      │
│  └── Chromium 2 → HDMI-A-2 副屏  :9223 (DevTools)      │
└──────────────────────────────────────────────────────────┘
```

### 3.2 nginx 静态服务（推荐，内存仅 ~2MB）

```nginx
# /etc/nginx/sites-available/pi-app
server {
    listen 8082;
    server_name localhost;

    gzip on;
    gzip_types text/plain text/css application/javascript application/json;
    gzip_min_length 1024;

    # Vite 构建产物带 hash，长缓存安全
    location /pi/assets/ {
        alias /home/pi/app/dist-pi/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA 入口：no-cache 确保每次加载最新 index.html
    location /pi/ {
        alias /home/pi/app/dist-pi/;
        try_files $uri $uri/ /pi/index.html;
        add_header Cache-Control "no-cache";
    }

    # 后端 API 反代（与 Vite dev server 保持一致）
    location /back/ {
        proxy_pass http://127.0.0.1:18001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
    }

    # 火山 TTS 反代
    location /volcan-tts/ {
        proxy_pass https://openspeech.bytedance.com/api/v1/tts/;
        proxy_ssl_server_name on;
        proxy_set_header Host openspeech.bytedance.com;
    }
}
```

### 3.3 Kiosk 启动脚本

```bash
#!/bin/bash
# ~/app/start-kiosk.sh
set -e

URL_MAIN="http://localhost:8082/pi/"
URL_PROJ="http://localhost:8082/pi/projection"
CHROME_PROFILE_1="/home/pi/.config/chromium-kiosk-1"
CHROME_PROFILE_2="/home/pi/.config/chromium-kiosk-2"

CHROME_FLAGS=(
    "--noerrdialogs"
    "--disable-infobars"
    "--disable-session-crashed-bubble"
    "--no-first-run"
    "--disable-translate"
    "--overscroll-history-navigation=0"
    "--disable-pinch"
    "--autoplay-policy=no-user-gesture-required"
    "--ozone-platform=wayland"
    "--enable-features=UseOzonePlatform"
)

# 清除崩溃恢复弹窗
for profile in "$CHROME_PROFILE_1" "$CHROME_PROFILE_2"; do
    prefs="$profile/Default/Preferences"
    if [ -f "$prefs" ]; then
        sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/g' "$prefs"
        sed -i 's/"exited_cleanly":false/"exited_cleanly":true/g' "$prefs"
    fi
done

sleep 3

# 主屏（左屏）
chromium-browser \
    "${CHROME_FLAGS[@]}" \
    --user-data-dir="$CHROME_PROFILE_1" \
    --remote-debugging-port=9222 \
    --remote-debugging-address=0.0.0.0 \
    --window-position=0,0 \
    --window-size=1920,1080 \
    --start-fullscreen \
    "$URL_MAIN" &

sleep 2

# 副屏（右屏，不同调试端口 + 不同 profile）
chromium-browser \
    "${CHROME_FLAGS[@]}" \
    --user-data-dir="$CHROME_PROFILE_2" \
    --remote-debugging-port=9223 \
    --remote-debugging-address=0.0.0.0 \
    --window-position=1920,0 \
    --window-size=1920,1080 \
    --start-fullscreen \
    "$URL_PROJ" &

wait
```

### 3.4 Wayfire 双屏配置

```ini
# ~/.config/wayfire.ini

[idle]
screensaver_timeout = 0
dpms_timeout = 0

[output:HDMI-A-1]
mode = 1920x1080@60
position = 0,0

[output:HDMI-A-2]
mode = 1920x1080@60
position = 1920,0

# DSI 触摸屏（如果用官方 7 寸屏替代 HDMI-A-1）：
# [output:DSI-1]
# mode = 800x480@60
# position = 0,0

[autostart]
autostart_wf_shell = false
hide_cursor = unclutter --timeout 1 &
kiosk = /home/pi/app/start-kiosk.sh
```

### 3.5 systemd 崩溃自动重启

```ini
# ~/.config/systemd/user/pi-kiosk.service
[Unit]
Description=Pi Kiosk Chromium Browser
After=graphical-session.target
PartOf=graphical-session.target

[Service]
ExecStart=/home/pi/app/start-kiosk.sh
Restart=always
RestartSec=5s
Environment=WAYLAND_DISPLAY=wayland-1
Environment=XDG_RUNTIME_DIR=/run/user/1000
StandardOutput=journal
StandardError=journal
SyslogIdentifier=pi-kiosk

[Install]
WantedBy=graphical-session.target
```

```bash
systemctl --user enable pi-kiosk.service
sudo loginctl enable-linger pi
```

### 3.6 PM2 进程管理

```javascript
// ~/app/ecosystem.config.js
module.exports = {
    apps: [{
        name: 'hardware-service',
        script: './src/hardware/index.js',
        cwd: '/home/pi/app',
        autorestart: true,
        max_memory_restart: '150M',
        restart_delay: 3000,
        env: {
            NODE_ENV: 'production',
            PORT: 3001,
            SERIAL_PORT: '/dev/ttyACM0',
        },
        out_file: '/home/pi/logs/hardware-out.log',
        error_file: '/home/pi/logs/hardware-error.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss',
    }],
}
```

### 3.7 开发热更新工作流

**方案 A：本地构建 + rsync 同步（推荐日常开发）**

```bash
# 监听文件变化，自动构建并同步
brew install fswatch
fswatch -r src/pi/ | while read; do
    yarn build-pi && rsync -avz --delete dist-pi/ pi@raspberrypi.local:~/app/dist-pi/
done
```

**方案 B：Vite dev server 在 Pi 上运行（即时 HMR）**

通过 VS Code Remote-SSH 直接在 Pi 上编辑，`yarn dev-pi-local` 运行 Vite HMR。

### 3.8 一键部署 Makefile

```makefile
PI_HOST := pi@raspberrypi.local

.PHONY: deploy sync build restart logs tunnel

deploy: build sync restart
	@echo "✓ 部署完成"

build:
	yarn build-pi

sync:
	rsync -avz --delete --exclude='*.map' dist-pi/ $(PI_HOST):~/app/dist-pi/

restart:
	ssh $(PI_HOST) "sudo nginx -s reload"

logs:
	ssh $(PI_HOST) "pm2 logs --lines 50"

tunnel:
	ssh -fN -L 9222:localhost:9222 -L 9223:localhost:9223 $(PI_HOST)
	@echo "主屏调试: http://localhost:9222"
	@echo "副屏调试: http://localhost:9223"

restart-kiosk:
	ssh $(PI_HOST) "systemctl --user restart pi-kiosk.service"
```

### 3.9 VS Code 调试配置

```jsonc
// .vscode/launch.json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Attach Pi 主屏 (9222)",
            "type": "chrome",
            "request": "attach",
            "port": 9222,
            "urlFilter": "http://localhost:8082/pi/*",
            "webRoot": "${workspaceFolder}/src/pi",
            "sourceMapPathOverrides": { "/pi/*": "${workspaceFolder}/src/pi/*" }
        },
        {
            "name": "Attach Pi 副屏 (9223)",
            "type": "chrome",
            "request": "attach",
            "port": 9223,
            "urlFilter": "http://localhost:8082/pi/projection*",
            "webRoot": "${workspaceFolder}/src/pi"
        }
    ]
}
```

---

## 4. Electron vs Tauri 对比（桌面应用化方案）

### 4.1 核心对比

| 维度 | Electron (v34.x) | Tauri (v2.0) |
|------|-------------------|--------------|
| **ARM64 支持** | 官方预编译二进制 ✅ | 官方支持，需 CI 编译 ✅ |
| **空载内存** | 150–300 MB | 30–80 MB |
| **安装包体积** | 80–150 MB | 3–15 MB |
| **冷启动时间** | Pi4: 2–5s, Pi5: 1–3s | 0.5–1.5s |
| **渲染引擎** | Chromium（完整兼容） | WebKitGTK（Linux 上有性能问题） |
| **双屏支持** | `screen.getAllDisplays()` 原生 ✅ | Linux 多窗口有已知 Bug ❌ |
| **硬件 GPIO** | onoff / pigpio (成熟) | rppal (已退役⚠️) / gpio-cdev |
| **串口/打印** | node-serialport + node-thermal-printer (成熟) | tauri-plugin-serialplugin (社区) |
| **蓝牙** | Web Bluetooth (Chromium 完整) | WebKitGTK Web Bluetooth 残缺 ❌ |
| **学习曲线** | JS/TS 全栈，零门槛 | 需要学 Rust |
| **OTA 更新** | electron-updater (AppImage 差量更新) | tauri-plugin-updater (更新包更小) |
| **DevTools** | 内置 Chromium DevTools (完整) | WebKitGTK Inspector (功能较少) |
| **社区生态** | 114k Star, Pi 教程丰富 | 87k Star, Pi 案例较少 |

### 4.2 关键差异详解

**WebKitGTK 渲染问题（Tauri 的核心短板）**：
- 多个 Tauri issue 报告 Linux 上 WebKitGTK 滚动/动画卡顿
- CSS 动画、Canvas 复杂 UI 在 Pi 上表现不可预测
- 部分 WebRTC、CSS Houdini、WebGPU 功能缺失

**双屏支持（决定性差异）**：
- Electron: `screen.getAllDisplays()` + `setBounds()` 精确控制窗口到指定屏幕，Pi 双 HDMI 验证有效
- Tauri: issue #14019 Wayland 多窗口无法正确放置到不同显示器; issue #11171 Linux 多窗口 IPC 事件只有第一个窗口能接收

**原生模块构建**：
- Electron: `node-serialport` 是 native addon，每次 Electron 升级需 `electron-rebuild`，ABI 版本不匹配是常见坑
- Tauri: Rust crate 编译进二进制，无 ABI 兼容问题，但 `rppal` GPIO 库已于 2025 年退役

**交叉编译**：
- 两者都不能从 macOS 一键交叉编译到 ARM64 Linux
- 都需要 GitHub Actions `ubuntu-*-arm` runner 或 Docker + QEMU
- Tauri 的 Rust 交叉编译工具链（`cross`）相对更成熟

### 4.3 备选方案

| 方案 | ARM64 支持 | 适用性评价 |
|------|-----------|-----------|
| NW.js | 无官方 ARM64 二进制 ❌ | 不推荐 |
| Neutralinojs | 官方 ARM64 二进制 ✅ | 体积极小但硬件扩展弱，适合简单展示 |
| Wails (Go) | Go 交叉编译成熟 ✅ | 同样用 WebKitGTK，与 Tauri 相同渲染问题 |

### 4.4 结论：推荐 Electron

针对本项目需求（GPIO + 串口打印机 + 蓝牙 + 双屏 + 已有 React/Vite），**Electron 是更务实的选择**：

1. **双屏 Kiosk 是核心需求** — Tauri Linux 多窗口有已知 IPC 和定位 Bug
2. **硬件 npm 生态成熟** — onoff、serialport、node-thermal-printer 均有完整 Pi 实战案例
3. **零 Rust 学习成本** — TypeScript 全栈团队
4. **WebKitGTK 渲染风险** — React 应用若有动画会在 Tauri/Pi 上踩坑
5. **真实参考项目** — Beekeeper Studio 在 Pi ARM64 上生产运行

**注意事项**：
- Pi 4 建议 4GB+ RAM（2GB 版运行 Electron 紧张）
- Pi 5 (8GB) 运行 Electron 完全没问题
- 串口模块每次 Electron 升级后需 `electron-rebuild`，建议锁定版本
- 长期运行注意内存泄漏（某些 Electron kiosk 4–10 天后需重启）

**推荐技术栈**：
```
Electron v34.x
+ electron-builder (打包 ARM64 AppImage/DEB)
+ electron-updater (OTA 更新)
+ Vite HMR (开发热重载)
+ onoff / pigpio (GPIO)
+ node-serialport + node-thermal-printer (热敏打印)
+ noble (蓝牙 BLE)
+ screen.getAllDisplays() (双屏窗口管理)
```

---

## 5. 硬件交互层

### 5.1 架构设计

Kiosk 阶段通过 HTTP/WebSocket 桥接，Electron 阶段通过 IPC 直连：

```
Kiosk 阶段:    React UI ←→ HTTP/WebSocket ←→ Node.js 硬件服务 ←→ 硬件
Electron 阶段: Renderer ←→ IPC / contextBridge ←→ Main Process ←→ 硬件
```

### 5.2 关键硬件库

| 功能 | npm 库 | 说明 |
|------|--------|------|
| GPIO 控制 | `onoff` / `pigpio` | 按钮、LED、继电器 |
| 热敏打印 | `node-thermal-printer` | USB/串口热敏打印机 |
| 串口通信 | `serialport` | 通用串口设备 |
| I2C 传感器 | `i2c-bus` | 温湿度、光照等 |
| 蓝牙 | `noble` | BLE 设备连接 |

### 5.3 打印机集成（PRD 核心需求）

现有状态：打印机已切到虚拟串口模式 `/dev/ttyACM0`

```typescript
import { ThermalPrinter, PrinterTypes } from 'node-thermal-printer'

const printer = new ThermalPrinter({
  type: PrinterTypes.EPSON,
  interface: '/dev/ttyACM0',
  options: { baudRate: 9600 }
})
```

---

## 6. 显示方案

### 6.1 推荐配置

| 屏幕 | 接口 | 用途 |
|------|------|------|
| 官方 7 寸触摸屏 (800×480) | DSI | 主交互屏（左屏） |
| HDMI 显示器 | HDMI | 投影角色舱（右屏） |

### 6.2 双屏实现

Pi 4/5 原生支持双屏输出，现有 BroadcastChannel 架构直接复用：
- 窗口 1：`http://localhost:8082/pi/` → 主屏日历/运势
- 窗口 2：`http://localhost:8082/pi/projection` → 角色投影

---

## 7. 语音交互升级路线

```
唤醒词检测 → ASR 语音识别 → Dify 对话 → TTS 语音播报（已有）
```

| 环节 | 方案 | 是否离线 |
|------|------|---------|
| 唤醒词 | Porcupine (Picovoice) | ✅ 离线 |
| ASR | Web Speech API / Whisper.cpp | 在线/离线 |
| 对话 | Dify API（已有） | 在线 |
| TTS | 火山引擎（已有）/ piper-tts（离线备选） | 在线/离线 |
| 硬件 | USB 麦克风 + 3.5mm/蓝牙音箱 | — |

---

## 8. 智能家居集成（远期）

| 协议 | 库/工具 | 用途 |
|------|--------|------|
| MQTT | `mqtt.js` | 连接 Home Assistant / IoT 设备 |
| Matter | `matter.js` | 新一代智能家居标准 |
| Zigbee | zigbee2mqtt + USB 适配器 | 控制米家/Aqara 传感器 |
| HomeKit | HAP-NodeJS | 暴露为 Apple HomeKit 配件 |

---

## 9. 推荐硬件清单

| 硬件 | 型号/规格 | 用途 |
|------|----------|------|
| 主板 | Raspberry Pi 5 (8GB) | 主控 |
| 主屏 | 官方 7 寸触摸屏 | 日历/运势交互 |
| 副屏 | HDMI 显示器 | 角色投影 |
| 音频输入 | USB 麦克风 | 语音交互 |
| 音频输出 | 3.5mm / 蓝牙音箱 | TTS 播放 |
| 打印机 | 热敏打印机 (USB/串口) | 签文打印 |
| 散热 | 风扇 + 金属外壳 | 长期运行稳定 |
| 存储 | 64GB+ A2 级 TF 卡 | 系统 + 应用 |

---

## 10. 演进路线

```
Phase 1: Kiosk 验证（当前阶段）
├── Chromium Kiosk 全屏部署 (nginx + Wayfire)
├── 双屏显示验证 (HDMI-A-1 + HDMI-A-2)
├── TTS + 对话基础体验
├── 远程调试工作流建立 (CDP + SSH 隧道)
└── make deploy 一键部署

Phase 2: 硬件集成
├── 本地 Node.js 硬件服务 (PM2 管理)
├── 热敏打印机对接 (node-thermal-printer)
├── 物理按键/压杆接入 (onoff)
└── 语音唤醒 + ASR (Porcupine + Whisper.cpp)

Phase 3: Electron 桌面应用化
├── Electron v34.x 集成
├── IPC 直连硬件（替代 HTTP 桥接）
├── screen.getAllDisplays() 双屏管理
├── AppImage 打包 + OTA 更新
└── 离线能力增强

Phase 4: 产品化
├── GitHub Actions ARM64 CI/CD
├── electron-updater OTA
├── 设备管理后台
├── 智能家居集成
└── 批量部署方案
```

---

## 11. Pi 初始化清单

首次在新树莓派上配置时：

```bash
# 1. 系统更新
sudo apt update && sudo apt upgrade -y

# 2. 安装必要软件
sudo apt install -y nginx unclutter-xfixes curl git btop

# 3. 安装 Node.js
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc && nvm install 22 && nvm alias default 22

# 4. 安装 PM2
npm install -g pm2

# 5. 创建应用目录
mkdir -p ~/app/dist-pi ~/logs

# 6. 配置 nginx（见 3.2 节）
sudo ln -s /etc/nginx/sites-available/pi-app /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo systemctl enable nginx && sudo systemctl restart nginx

# 7. 配置 Kiosk 自启（见 3.3–3.5 节）
chmod +x ~/app/start-kiosk.sh
systemctl --user enable pi-kiosk.service
sudo loginctl enable-linger pi

# 8. 配置 Pi 自动登录桌面
sudo raspi-config  # → System Options → Boot → Desktop Autologin

# 9. 允许无密码 nginx reload
echo "pi ALL=(ALL) NOPASSWD: /usr/sbin/nginx" | sudo tee /etc/sudoers.d/pi-nginx

# 10. SSH 免密登录（在开发机上执行）
ssh-copy-id pi@raspberrypi.local

# 11. 安装监控工具（可选）
# Netdata: wget -O /tmp/netdata-kickstart.sh https://my-netdata.io/kickstart.sh && sudo sh /tmp/netdata-kickstart.sh
# Cockpit: sudo apt install cockpit && sudo systemctl enable --now cockpit.socket
```

---

## 参考资料

- [Raspberry Pi Kiosk Mode (Bookworm/Wayland)](https://www.raspberrypi.com/tutorials/how-to-use-a-raspberry-pi-in-kiosk-mode/)
- [Chromium Remote Debugging on Pi](https://blog.sebastian-martens.de/development/raspberry-pi-remote-debug-chrome/)
- [VS Code Remote SSH for Pi](https://www.raspberrypi.com/news/coding-on-raspberry-pi-remotely-with-visual-studio-code/)
- [Electron Apps for ARM and Raspberry Pi (Beekeeper Studio)](https://www.beekeeperstudio.io/blog/electron-apps-for-arm-and-raspberry-pi)
- [Tauri on Raspberry Pi](https://www.elan8.com/blog/tauri-on-raspberry-pi)
- [Netdata on Raspberry Pi](https://pimylifeup.com/raspberry-pi-netdata/)
- [Cockpit on Raspberry Pi](https://raspberrytips.com/cockpit-on-raspberry-pi/)
- [Wayfire Dual Display Kiosk](https://forums.raspberrypi.com/viewtopic.php?t=383642)
