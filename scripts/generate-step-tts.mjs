#!/usr/bin/env node

/**
 * 预生成摇卦页固定步骤提示语的 MP3 文件
 *
 * 用法:
 *   node scripts/generate-step-tts.mjs
 *   node scripts/generate-step-tts.mjs --config public/config/config.pi.json
 *
 * 输出: src/assets/tts/step-{asking,ready,interpreting}.mp3
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import axios from 'axios'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')

// ── 配置 ──

// Reason: 与 src/home/shake-hexagram.tsx 的 TTS_VOICE_TYPE 保持一致，修改时需同步
const VOICE_TYPE = 'zh_female_xiaohe_uranus_bigtts'
const TTS_API_URL = 'https://openspeech.bytedance.com/api/v1/tts'
const OUTPUT_DIR = resolve(PROJECT_ROOT, 'src/assets/tts')

const STEPS = [
    { name: 'step-asking',       text: '请按住语音键，说出你的疑问' },
    { name: 'step-ready',        text: '请拉动摇杆，获取卦象' },
    { name: 'step-interpreting', text: '卦象解读中，请静心等待' },
]

// ── 解析 --config 参数 ──

function parseConfigPath() {
    const idx = process.argv.indexOf('--config')
    const relative = idx !== -1 && process.argv[idx + 1]
        ? process.argv[idx + 1]
        : 'public/config/config.dev.json'
    return resolve(PROJECT_ROOT, relative)
}

function loadConfig(configPath) {
    const raw = readFileSync(configPath, 'utf-8')
    const config = JSON.parse(raw)
    const appId = config.DOUBAO?.APP_ID
    const accessKey = config.DOUBAO?.ACCESS_KEY
    if (!appId || !accessKey) {
        throw new Error(`配置文件缺少 DOUBAO.APP_ID 或 DOUBAO.ACCESS_KEY: ${configPath}`)
    }
    return { appId, accessKey }
}

// ── TTS 合成（复用 volcan-tts.ts 的请求结构） ──

let reqCounter = 0

// Reason: 请求结构镜像 src/utils/volcan-tts.ts 的 synthesize 函数，修改时需同步
async function synthesize(text, appId, accessKey) {
    const body = {
        app: {
            appid: appId,
            token: 'access_token',
            cluster: 'volcano_tts',
        },
        user: { uid: 'pi-user' },
        audio: {
            voice_type: VOICE_TYPE,
            encoding: 'mp3',
            rate: 24000,
            speed_ratio: 1.0,
        },
        request: {
            reqid: `pi-tts-gen-${Date.now()}-${++reqCounter}`,
            text,
            operation: 'query',
        },
    }

    const resp = await axios.post(TTS_API_URL, body, {
        headers: {
            'Authorization': `Bearer;${accessKey}`,
            'Content-Type': 'application/json; charset=utf-8',
        },
    })

    const data = resp.data
    if (data.code === 3000 && data.data) {
        return Buffer.from(data.data, 'base64')
    }
    throw new Error(`TTS 失败: ${data.message || '未知错误'} (code: ${data.code})`)
}

// ── 主流程 ──

async function main() {
    const configPath = parseConfigPath()
    console.log(`配置文件: ${configPath}`)

    const { appId, accessKey } = loadConfig(configPath)
    mkdirSync(OUTPUT_DIR, { recursive: true })

    for (const step of STEPS) {
        const outPath = resolve(OUTPUT_DIR, `${step.name}.mp3`)
        console.log(`生成 "${step.text}" → ${step.name}.mp3 ...`)

        const mp3 = await synthesize(step.text, appId, accessKey)
        writeFileSync(outPath, mp3)
        console.log(`  ✓ ${(mp3.length / 1024).toFixed(1)} KB`)
    }

    console.log(`\n全部完成，输出目录: ${OUTPUT_DIR}`)
}

main().catch(e => {
    console.error('生成失败:', e.message)
    process.exit(1)
})
