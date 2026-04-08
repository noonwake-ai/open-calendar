import fs from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

function loadConfig(configPath: string): Record<string, any> {
    try {
        const raw = fs.readFileSync(configPath, 'utf-8')
        return JSON.parse(raw)
    } catch {
        return {}
    }
}

function resolveConfigSource(command: 'serve' | 'build'): {
    sourcePath: string
    runtimeFileName: string
} {
    if (command === 'serve') {
        return {
            sourcePath: 'public/config/config.dev.json',
            runtimeFileName: 'config.dev.json',
        }
    }

    return {
        sourcePath: 'public/config/config.pi.json',
        runtimeFileName: 'config.json',
    }
}

export default defineConfig(({ command }) => {
    const { sourcePath, runtimeFileName } = resolveConfigSource(command)
    const config = loadConfig(sourcePath)
    const doubao = config.DOUBAO ?? {}
    const apiTarget = process.env.API_TARGET || config.BASE_URL || 'https://apis.test.noonwake.net'

    return {
        base: '/pi/',
        define: {
            __APP_CONFIG_FILE__: JSON.stringify(runtimeFileName),
        },
        plugins: [
            react(),
            {
                name: 'write-runtime-config',
                closeBundle() {
                    if (command !== 'build') return

                    const outDir = 'dist-pi/config'
                    const outPath = path.join(outDir, 'config.json')
                    const redundantConfigPaths = [
                        path.join(outDir, 'config.dev.json'),
                        path.join(outDir, 'config.pi.json'),
                    ]

                    fs.mkdirSync(outDir, { recursive: true })
                    fs.writeFileSync(outPath, `${JSON.stringify(config, null, 4)}\n`, 'utf-8')
                    for (const redundantPath of redundantConfigPaths) {
                        if (fs.existsSync(redundantPath)) {
                            fs.rmSync(redundantPath)
                        }
                    }
                },
            },
        ],
        build: {
            outDir: 'dist-pi',
        },
        server: {
            host: '0.0.0.0',
            port: 8082,
            proxy: {
                '/back': {
                    target: apiTarget,
                    changeOrigin: true,
                },
                '/pi-bridge': {
                    target: 'http://127.0.0.1:8765',
                    changeOrigin: true,
                    rewrite: (routePath) => routePath.replace(/^\/pi-bridge/, ''),
                },
                '/dify': {
                    target: 'http://dify-cn.noonwake.net',
                    changeOrigin: true,
                    rewrite: (routePath) => routePath.replace(/^\/dify/, '/v1'),
                },
                '/volcan-tts': {
                    target: 'https://openspeech.bytedance.com',
                    changeOrigin: true,
                    rewrite: (routePath) => routePath.replace(/^\/volcan-tts/, '/api/v1/tts'),
                },
                '/doubao-realtime': {
                    target: 'https://openspeech.bytedance.com',
                    ws: true,
                    changeOrigin: true,
                    rewrite: (routePath) => routePath.replace(/^\/doubao-realtime/, '/api/v3/realtime/dialogue'),
                    headers: {
                        'X-Api-App-ID': doubao.APP_ID ?? '',
                        'X-Api-Access-Key': doubao.ACCESS_KEY ?? '',
                        'X-Api-Resource-Id': 'volc.speech.dialog',
                        'X-Api-App-Key': doubao.APP_KEY ?? '',
                    },
                },
            },
        },
    }
})
