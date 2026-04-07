import fs from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Reason: 从 public/config/config.json 读取运行时配置，避免在代码中硬编码敏感信息
function loadConfig(): Record<string, any> {
    try {
        const raw = fs.readFileSync('public/config/config.json', 'utf-8')
        return JSON.parse(raw)
    } catch {
        return {}
    }
}

const config = loadConfig()
const doubao = config.DOUBAO ?? {}
const apiTarget = process.env.API_TARGET || config.BASE_URL || 'https://apis.test.noonwake.net'

export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist',
    },
    server: {
        host: '0.0.0.0',
        port: 8082,
        proxy: {
            '/back': {
                target: apiTarget,
                changeOrigin: true,
            },
            '/volcan-tts': {
                target: 'https://openspeech.bytedance.com',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/volcan-tts/, '/api/v1/tts'),
            },
            '/doubao-realtime': {
                target: 'wss://openspeech.bytedance.com',
                ws: true,
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/doubao-realtime/, '/api/v3/realtime/dialogue'),
                headers: {
                    'X-Api-App-ID': doubao.APP_ID ?? '',
                    'X-Api-Access-Key': doubao.ACCESS_KEY ?? '',
                    'X-Api-Resource-Id': 'volc.speech.dialog',
                    'X-Api-App-Key': doubao.APP_KEY ?? '',
                },
            },
        },
    },
})
