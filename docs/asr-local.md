# 树莓派本地语音识别（ASR）方案

## 背景

树莓派使用开源 Chromium 浏览器，不支持 Chrome 的 Web Speech API（依赖 Google 专有云端服务）。因此需要本地 ASR 方案替代。

## 方案选型

| 方案 | 中文质量 | Pi5 RTF | 流式识别 | 内存 | 维护状态 |
|------|---------|---------|---------|------|---------|
| **Sherpa-onnx** | 优秀 | 0.04 | 原生支持 | ~200MB | 活跃（周更） |
| Vosk | 良好 | 0.3-0.5 | 支持 | ~100-400MB | 较慢 |
| faster-whisper | 良好 | 1-2 | 不支持 | ~300MB+ | 活跃 |
| whisper.cpp | 良好 | 1.5-3 | 实验性 | ~400MB+ | 活跃 |

> RTF (Real-Time Factor): 越小越好，<1.0 表示快于实时。例如 0.04 表示比实时快 25 倍。

**最终选择: Sherpa-onnx + SenseVoice (int8)**

理由：
- 来自 next-gen-kaldi (k2-fsa) 团队，中文识别质量优秀
- SenseVoice 模型专为中文优化，支持中/英/日/韩/粤语
- int8 量化版在 Pi5 上 RTF 仅 0.04，性能余量充足
- 原生 WebSocket 服务支持，方便浏览器端对接
- Python/Node.js/C++ 多语言 API

## 性能测试数据（Pi5 8GB）

```
模型: SenseVoice int8
线程: 4
测试音频: 5.59s 中文语音
识别结果: "开放时间早上9点至下午5点。"（准确）
识别耗时: 0.22s
RTF: 0.039
内存占用: ~300MB
```

## 安装步骤

### 1. 创建 Python 虚拟环境

```bash
python3 -m venv ~/asr-env
source ~/asr-env/bin/activate
pip install sherpa-onnx numpy websockets
```

### 2. 下载 SenseVoice 模型

```bash
mkdir -p ~/asr-models && cd ~/asr-models

# 下载模型（约 230MB）
wget https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17.tar.bz2 -O sensevoice.tar.bz2

tar xjf sensevoice.tar.bz2
```

模型目录结构：
```
~/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/
├── model.int8.onnx    # int8 量化模型（推荐，速度快）
├── model.onnx         # fp32 模型（精度略高，速度慢）
├── tokens.txt         # 词表
└── test_wavs/         # 测试音频
```

### 3. WebSocket ASR 服务

服务文件: `~/asr-server.py`

协议说明：
- **连接**: `ws://<pi-ip>:6006`
- **发送音频**: 直接发送二进制 PCM 数据（16-bit, 16kHz, mono）
- **请求识别**: 发送 JSON `{"action": "recognize"}`
- **接收结果**: JSON `{"type": "result", "text": "识别文本", "duration": 5.59, "elapsed": 0.22}`
- **清空缓冲**: 发送 JSON `{"action": "clear"}`
- **心跳检测**: 发送 JSON `{"action": "ping"}`，回复 `{"type": "pong"}`

### 4. Systemd 服务配置

服务文件: `/etc/systemd/system/asr-server.service`

```ini
[Unit]
Description=Sherpa-onnx WebSocket ASR Server
After=network.target

[Service]
Type=simple
User=noonwake
WorkingDirectory=/home/noonwake
ExecStart=/home/noonwake/asr-env/bin/python3 /home/noonwake/asr-server.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

常用命令：
```bash
# 启动/停止/重启
sudo systemctl start asr-server
sudo systemctl stop asr-server
sudo systemctl restart asr-server

# 查看状态和日志
sudo systemctl status asr-server
sudo journalctl -u asr-server -f
```

## 浏览器端接入示例

```javascript
class ASRClient {
    constructor(wsUrl = 'ws://192.168.5.212:6006') {
        this.wsUrl = wsUrl
        this.ws = null
        this.mediaRecorder = null
        this.audioContext = null
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.wsUrl)
            this.ws.binaryType = 'arraybuffer'
            this.ws.onopen = () => resolve()
            this.ws.onerror = (e) => reject(e)
            this.ws.onmessage = (event) => {
                const result = JSON.parse(event.data)
                if (result.type === 'result' && this.onResult) {
                    this.onResult(result.text)
                }
            }
        })
    }

    async startRecording() {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: { sampleRate: 16000, channelCount: 1 }
        })
        this.audioContext = new AudioContext({ sampleRate: 16000 })
        const source = this.audioContext.createMediaStreamSource(stream)
        const processor = this.audioContext.createScriptProcessor(4096, 1, 1)

        processor.onaudioprocess = (e) => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                const float32 = e.inputBuffer.getChannelData(0)
                const int16 = new Int16Array(float32.length)
                for (let i = 0; i < float32.length; i++) {
                    int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768))
                }
                this.ws.send(int16.buffer)
            }
        }

        source.connect(processor)
        processor.connect(this.audioContext.destination)
        this.stream = stream
        this.processor = processor
        this.source = source
    }

    stopAndRecognize() {
        // 停止录音
        this.stream?.getTracks().forEach(t => t.stop())
        this.processor?.disconnect()
        this.source?.disconnect()
        // 请求识别
        this.ws?.send(JSON.stringify({ action: 'recognize' }))
    }

    disconnect() {
        this.ws?.close()
    }
}

// 使用示例
const asr = new ASRClient()
asr.onResult = (text) => console.log('识别结果:', text)
await asr.connect()
await asr.startRecording()
// ... 用户说话 ...
asr.stopAndRecognize()  // 停止并获取结果
```

## 项目集成

### 自动切换机制

代码通过 `config.json` 中的 `ASR_WS_URL` 字段自动判断使用哪种 ASR：

- **有 `ASR_WS_URL`**: 使用 WebSocket 连接本地 Sherpa-onnx（树莓派环境）
- **无 `ASR_WS_URL`**: 使用浏览器原生 `webkitSpeechRecognition`（Chrome 环境）

### 相关代码文件

| 文件 | 说明 |
|------|------|
| `src/back/pi/utils/speech-recognition.ts` | 统一 ASR 接口，包含原生和 WebSocket 两种实现 |
| `src/back/pi/home/shake-hexagram.tsx` | AudioSpectrum 组件，使用统一 ASR 接口 |
| `src/back/pi/utils/api.ts` | AppConfig 类型定义（含 `ASR_WS_URL`） |
| `src/back/pi/public/config.json` | 运行时配置（生产环境） |

### 配置方式

树莓派部署的 `config.json`：
```json
{
    "BASE_URL": "https://apis.noonwake.net",
    "ASR_WS_URL": "ws://192.168.5.212:6006"
}
```

开发环境（Mac Chrome）不配置 `ASR_WS_URL`，自动走原生 API。

## 文件清单

树莓派上的相关文件：

| 路径 | 说明 |
|------|------|
| `~/asr-env/` | Python 虚拟环境 |
| `~/asr-server.py` | WebSocket ASR 服务主程序 |
| `~/asr-models/` | 模型文件目录 |
| `/etc/systemd/system/asr-server.service` | Systemd 服务配置 |

## 后续优化方向

1. **流式识别**: 当前是攒完音频再识别，可改用 Sherpa-onnx 的 streaming 模型实现边说边出字
2. **VAD（语音活动检测）**: 自动检测说话起止，无需手动按按钮
3. **模型升级**: 关注 SenseVoice 后续版本，k2-fsa 团队更新频繁
4. **多并发**: 当前单 recognizer 实例，高并发场景可加 recognizer pool

---

## 豆包端到端语音大模型（聊天模块）

摇卦结果页的语音追问聊天使用豆包端到端实时语音大模型（O2.0 版本），替代原来的 Dify + TTS 方案。

### 与 Sherpa-onnx ASR 的分工

| 场景 | 方案 | 说明 |
|------|------|------|
| 摇卦前的语音提问 | Sherpa-onnx 本地 ASR | 只需语音转文字 |
| 解卦报告朗读 | Dify completion + 火山 TTS | 需要长文本生成 + 高质量语音 |
| 结果页语音追问聊天 | 豆包端到端 | 语音到语音直接对话，低延迟 |

### 架构

浏览器通过 nginx WebSocket 反向代理连接豆包 Realtime API，nginx 注入认证 Headers（浏览器 WebSocket 不支持自定义 Headers）。

```
浏览器 → ws://127.0.0.1:8082/doubao-realtime → nginx → wss://openspeech.bytedance.com/api/v3/realtime/dialogue
```

### 相关代码文件

| 文件 | 说明 |
|------|------|
| `src/back/pi/utils/doubao-realtime.ts` | 豆包端到端 WebSocket 客户端（二进制协议编解码、会话管理、PCM 播放） |
| `src/back/pi/home/shake-hexagram.tsx` | 结果页自动初始化豆包会话，录音时发送 PCM 到豆包 |
| `src/back/pi/pages/doubao-realtime-demo.tsx` | 独立调试 Demo 页面 |

### nginx 代理配置

```nginx
location /doubao-realtime {
    proxy_pass https://openspeech.bytedance.com/api/v3/realtime/dialogue;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host openspeech.bytedance.com;
    proxy_set_header X-Api-App-ID 5023004934;
    proxy_set_header X-Api-Access-Key <access_key>;
    proxy_set_header X-Api-Resource-Id volc.speech.dialog;
    proxy_set_header X-Api-App-Key PlgvMymc7f3tQnJ6;
    proxy_ssl_server_name on;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
}
```

### 模型配置

- 模型版本: O2.0 (`model: "1.2.1.1"`)
- 音色: `zh_female_xiaohe_jupiter_bigtts`
- 输入模式: `push_to_talk`（按键说话）
- 音频格式: 上行 PCM 16kHz s16le mono，下行 PCM 24kHz s16le mono

---

## Chromium Kiosk 全屏模式

树莓派使用 Chromium kiosk 模式实现全屏 Home App 效果。

### 启动脚本

`~/start-kiosk.sh` — 以 kiosk 模式启动 Chromium：
- `--kiosk`: 全屏无边框
- `--noerrdialogs --disable-infobars`: 无弹窗干扰
- `--autoplay-policy=no-user-gesture-required`: 音频自动播放
- `--use-fake-ui-for-media-stream`: 自动允许麦克风权限

### 树莓派文件清单

| 路径 | 说明 |
|------|------|
| `~/start-kiosk.sh` | Chromium kiosk 启动脚本 |
| `~/pi_button_bridge.py` | GPIO 按键桥接（唤醒键启动 kiosk） |
| `/etc/systemd/system/kiosk.service` | Kiosk 开机自启服务 |
| `/etc/nginx/sites-enabled/pi-app` | nginx 配置（含豆包 WS 代理） |
