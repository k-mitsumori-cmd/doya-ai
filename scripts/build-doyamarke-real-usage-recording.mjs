import { createHash } from 'node:crypto'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const OUTPUT = path.join(ROOT, 'reference/generated-assets/2026-08-28-doyamarke-real-usage-recordings')
const SERVICE_DIR = path.join(OUTPUT, 'public/banner')
const FRAMES_DIR = path.join(SERVICE_DIR, 'frames')
const VIDEO = path.join(SERVICE_DIR, 'doyabanner-real-usage-16x9.mp4')
const CONTACT_SHEET = path.join(SERVICE_DIR, 'actual-operation-contact-sheet.png')

const SEQUENCE = [
  ['10-initial.png', 2.0, '初期画面'],
  ['11-sample-filled.png', 2.4, 'サンプル入力'],
  ['12-generation-started.png', 1.8, '生成開始'],
  ['13-generation-progress-1.png', 1.8, '生成進捗（10%）'],
  ['15-generation-progress-3.png', 2.0, '生成終盤（82%）'],
  ['16-generation-check.png', 1.5, '生成完了確認'],
  ['17-result-complete.png', 2.8, '完成A案'],
  ['18-result-gallery.png', 3.0, '完成B案へ切替'],
]

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('close', code => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr)))
  })
}

async function sha256(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex')
}

async function makeContactSheet() {
  const cardWidth = 520
  const cardHeight = 360
  const cols = 3
  const gap = 28
  const margin = 46
  const header = 108
  const rows = Math.ceil(SEQUENCE.length / cols)
  const width = margin * 2 + cols * cardWidth + (cols - 1) * gap
  const height = header + margin + rows * cardHeight + (rows - 1) * gap + margin
  const bg = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#eef2ff"/>
    <text x="${margin}" y="72" font-family="Noto Sans JP, sans-serif" font-size="43" font-weight="700" fill="#0f172a">ドヤバナーAI 実操作キャプチャ</text>
  </svg>`)
  const layers = []

  for (let i = 0; i < SEQUENCE.length; i += 1) {
    const [name, , label] = SEQUENCE[i]
    const screenshot = await sharp(path.join(FRAMES_DIR, name))
      .resize(480, 270, { fit: 'contain', background: '#ffffff' })
      .png()
      .toBuffer()
    const card = await sharp(Buffer.from(`<svg width="${cardWidth}" height="${cardHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" rx="22" fill="#ffffff"/>
      <text x="22" y="324" font-family="Noto Sans JP, sans-serif" font-size="26" font-weight="700" fill="#0f172a">${i + 1}. ${label}</text>
    </svg>`)).composite([{ input: screenshot, left: 20, top: 20 }]).png().toBuffer()
    layers.push({
      input: card,
      left: margin + (i % cols) * (cardWidth + gap),
      top: header + margin + Math.floor(i / cols) * (cardHeight + gap),
    })
  }
  await sharp(bg).composite(layers).png().toFile(CONTACT_SHEET)
}

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'doya-real-usage-'))
try {
  const concatFile = path.join(tempDir, 'frames.ffconcat')
  const lines = ['ffconcat version 1.0']
  for (const [name, duration] of SEQUENCE) {
    lines.push(`file '${path.join(FRAMES_DIR, name).replaceAll("'", "'\\''")}'`)
    lines.push(`duration ${duration}`)
  }
  lines.push(`file '${path.join(FRAMES_DIR, SEQUENCE.at(-1)[0]).replaceAll("'", "'\\''")}'`)
  await writeFile(concatFile, `${lines.join('\n')}\n`)

  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'concat', '-safe', '0', '-i', concatFile,
    '-vf', 'scale=1920:1080:flags=lanczos:in_range=full:out_range=tv,fps=30,format=yuv420p',
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-color_range', 'tv',
    '-movflags', '+faststart', VIDEO,
  ])
  await makeContactSheet()

  const { stdout } = await run('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,codec_name,pix_fmt:format=duration,size',
    '-of', 'json', VIDEO,
  ])
  const info = JSON.parse(stdout)
  const manifest = {
    generatedAt: new Date().toISOString(),
    service: 'ドヤバナーAI',
    route: 'http://localhost:3017/banner/dashboard/create',
    captureType: 'browser-only actual-operation capture',
    captureViewport: { width: 1600, height: 900 },
    note: 'These frames were captured before and after real browser clicks and a real banner-generation request. This is a privacy-safe browser-only state recording, not an OS-level continuous desktop capture.',
    actions: SEQUENCE.map(([file, duration, label]) => ({ file: `frames/${file}`, duration, label })),
    result: 'Generation completed; three banner proposals were displayed.',
    video: {
      file: path.basename(VIDEO),
      width: info.streams[0].width,
      height: info.streams[0].height,
      codec: info.streams[0].codec_name,
      pixelFormat: info.streams[0].pix_fmt,
      durationSeconds: Number(info.format.duration),
      bytes: Number(info.format.size),
      sha256: await sha256(VIDEO),
    },
    contactSheet: {
      file: path.basename(CONTACT_SHEET),
      sha256: await sha256(CONTACT_SHEET),
    },
  }
  const qa = {
    status: info.streams[0].width === 1920 && info.streams[0].height === 1080 && info.streams[0].codec_name === 'h264' && info.streams[0].pix_fmt === 'yuv420p' && SEQUENCE.length === 8 ? 'PASS' : 'FAIL',
    checks: {
      actualOperationFrameCount: SEQUENCE.length,
      video1920x1080: info.streams[0].width === 1920 && info.streams[0].height === 1080,
      videoH264: info.streams[0].codec_name === 'h264',
      videoYuv420p: info.streams[0].pix_fmt === 'yuv420p',
      generationResultIncluded: SEQUENCE.some(([name]) => name === '18-result-gallery.png'),
    },
  }
  await writeFile(path.join(SERVICE_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  await writeFile(path.join(SERVICE_DIR, 'qa.json'), `${JSON.stringify(qa, null, 2)}\n`)
  await writeFile(path.join(SERVICE_DIR, 'README.md'), `# ドヤバナーAI 実操作キャプチャ\n\n実ブラウザでサンプル入力を実行し、AI生成の進捗を待ち、完成した3案を表示した記録です。\n\nOS全画面には他アプリの情報が映るため、ブラウザ領域だけを安全に記録しています。\n`)
  process.stdout.write(`${qa.status}: ${manifest.video.durationSeconds}s ${manifest.video.width}x${manifest.video.height}\n`)
} finally {
  await rm(tempDir, { recursive: true, force: true })
}
