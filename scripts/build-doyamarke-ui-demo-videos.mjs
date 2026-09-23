import { createHash } from 'node:crypto'
import { mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const OUTPUT = path.join(ROOT, 'reference/generated-assets/2026-08-28-doyamarke-ui-demos')
const TMP = path.join(OUTPUT, '.frames')

const SERVICES = [
  { id: 'banner', name: 'ドヤバナーAI', scope: 'public' },
  { id: 'seo', name: 'ドヤ記事作成', scope: 'public' },
  { id: 'interview', name: 'ドヤインタビュー', scope: 'public' },
  { id: 'persona', name: 'ドヤペルソナAI', scope: 'public' },
  { id: 'hr', name: 'ドヤHR', scope: 'public' },
  { id: 'kintai', name: 'ドヤ勤怠', scope: 'public' },
  { id: 'doyalist', name: 'ドヤリスト', scope: 'public' },
  { id: 'promane', name: 'ドヤプロマネ', scope: 'public' },
  { id: 'doyaslide', name: 'ドヤスライド', scope: 'public' },
  { id: 'cunning', name: 'ドヤカンニング', scope: 'public' },
  { id: 'sfa', name: 'ドヤ営業管理', scope: 'public' },
  { id: 'shodan', name: 'ドヤ商談準備', scope: 'public' },
  { id: 'aio', name: 'ドヤAIO', scope: 'public' },
  { id: 'mensetsu', name: 'ドヤ面接官', scope: 'internal-review' },
  { id: 'quote', name: 'ドヤ見積もりAI', scope: 'internal-review' },
  { id: 'aishodan', name: 'ドヤAI商談', scope: 'internal-review' },
  { id: 'adimage', name: 'ドヤ広告画像AI', scope: 'internal-review' },
]

const STEPS = [
  { source: '1-input.webp', output: '01-input.webp', label: '入力画面', cursor: [1435, 808] },
  { source: '2-process.webp', output: '02-process.webp', label: '処理画面', cursor: [1080, 690] },
  { source: '3-output.webp', output: '03-output.webp', label: '結果画面', cursor: [1450, 782] },
]

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('close', code => {
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(`${command} exited ${code}\n${stderr}`))
    })
  })
}

function escapeXml(value) {
  return value.replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[char]))
}

function frameBackground(service, step, index) {
  const accent = service.scope === 'public' ? '#2563eb' : '#7c3aed'
  const scopeLabel = service.scope === 'public' ? '公開サービス' : '社内確認用・開発中'
  return Buffer.from(`
    <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#eef4ff"/>
          <stop offset="1" stop-color="#f8fafc"/>
        </linearGradient>
        <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="22" stdDeviation="24" flood-color="#0f172a" flood-opacity="0.17"/>
        </filter>
      </defs>
      <rect width="1920" height="1080" fill="url(#bg)"/>
      <circle cx="1730" cy="90" r="260" fill="${accent}" opacity="0.08"/>
      <circle cx="145" cy="1020" r="230" fill="#38bdf8" opacity="0.07"/>
      <text x="110" y="92" font-family="Noto Sans JP, Hiragino Sans, sans-serif" font-size="44" font-weight="700" fill="#0f172a">${escapeXml(service.name)}</text>
      <rect x="110" y="119" width="220" height="42" rx="21" fill="${accent}"/>
      <text x="220" y="148" text-anchor="middle" font-family="Noto Sans JP, Hiragino Sans, sans-serif" font-size="21" font-weight="700" fill="white">${scopeLabel}</text>
      <text x="1748" y="95" text-anchor="end" font-family="Noto Sans JP, Hiragino Sans, sans-serif" font-size="26" font-weight="600" fill="#475569">${index + 1} / 3　${step.label}</text>
      <rect x="110" y="196" width="1700" height="850" rx="34" fill="#ffffff" filter="url(#shadow)"/>
    </svg>
  `)
}

function cursorOverlay(service, step) {
  const accent = service.scope === 'public' ? '#2563eb' : '#7c3aed'
  const [cursorX, cursorY] = step.cursor
  return Buffer.from(`
    <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${cursorX + 4}" cy="${cursorY + 4}" r="34" fill="${accent}" opacity="0.12"/>
      <circle cx="${cursorX + 4}" cy="${cursorY + 4}" r="34" fill="none" stroke="${accent}" stroke-width="7" opacity="0.78"/>
      <path d="M ${cursorX} ${cursorY} l 0 42 l 12 -11 l 12 26 l 13 -6 l -12 -25 l 17 0 z" fill="#ffffff" stroke="#0f172a" stroke-width="5" stroke-linejoin="round"/>
    </svg>
  `)
}

async function renderFrame(service, step, index, sourcePath, outputPath) {
  const screenshot = await sharp(sourcePath)
    .resize(1600, 800, { fit: 'contain', background: '#f8fafc' })
    .png()
    .toBuffer()

  const roundedMask = Buffer.from('<svg width="1600" height="800"><rect width="1600" height="800" rx="22" fill="white"/></svg>')
  const rounded = await sharp(screenshot)
    .composite([{ input: roundedMask, blend: 'dest-in' }])
    .png()
    .toBuffer()

  await sharp(frameBackground(service, step, index))
    .composite([
      { input: rounded, left: 160, top: 221 },
      { input: cursorOverlay(service, step), left: 0, top: 0 },
    ])
    .png()
    .toFile(outputPath)
}

async function makeVideo(framePaths, outputPath) {
  const inputs = framePaths.flatMap(frame => ['-loop', '1', '-t', '2.8', '-i', frame])
  const filters = [
    '[0:v]fps=30,format=yuv420p,setpts=PTS-STARTPTS[v0]',
    '[1:v]fps=30,format=yuv420p,setpts=PTS-STARTPTS[v1]',
    '[2:v]fps=30,format=yuv420p,setpts=PTS-STARTPTS[v2]',
    '[v0][v1]xfade=transition=fade:duration=0.45:offset=2.35[x1]',
    '[x1][v2]xfade=transition=fade:duration=0.45:offset=4.70,format=yuv420p[out]',
  ].join(';')

  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    ...inputs,
    '-filter_complex', filters,
    '-map', '[out]', '-an',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
    '-profile:v', 'high', '-level', '4.1', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', outputPath,
  ])
}

async function createContactSheet(services, outputPath, title) {
  const cols = services.length > 6 ? 4 : 2
  const cardWidth = 720
  const cardHeight = 500
  const gap = 28
  const margin = 54
  const header = 125
  const rows = Math.ceil(services.length / cols)
  const width = margin * 2 + cols * cardWidth + (cols - 1) * gap
  const height = header + margin + rows * cardHeight + (rows - 1) * gap + margin
  const background = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f1f5f9"/>
      <text x="${margin}" y="78" font-family="Noto Sans JP, Hiragino Sans, sans-serif" font-size="50" font-weight="700" fill="#0f172a">${escapeXml(title)}</text>
    </svg>
  `)
  const layers = []

  for (let index = 0; index < services.length; index += 1) {
    const service = services[index]
    const screenshotPath = path.join(OUTPUT, service.scope, service.id, 'screenshots', '02-process.webp')
    const screenshot = await sharp(screenshotPath)
      .resize(680, 380, { fit: 'contain', background: '#ffffff' })
      .png()
      .toBuffer()
    const card = await sharp(Buffer.from(`
      <svg width="${cardWidth}" height="${cardHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="${cardWidth}" height="${cardHeight}" rx="24" fill="#ffffff"/>
        <text x="24" y="454" font-family="Noto Sans JP, Hiragino Sans, sans-serif" font-size="29" font-weight="700" fill="#0f172a">${escapeXml(service.name)}</text>
        <text x="696" y="454" text-anchor="end" font-family="Noto Sans JP, Hiragino Sans, sans-serif" font-size="20" fill="#64748b">${service.id}</text>
      </svg>
    `)).composite([{ input: screenshot, left: 20, top: 20 }]).png().toBuffer()
    layers.push({
      input: card,
      left: margin + (index % cols) * (cardWidth + gap),
      top: header + margin + Math.floor(index / cols) * (cardHeight + gap),
    })
  }

  await sharp(background).composite(layers).png().toFile(outputPath)
}

async function sha256(filePath) {
  const data = await readFile(filePath)
  return createHash('sha256').update(data).digest('hex')
}

async function videoInfo(filePath) {
  const { stdout } = await run('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,codec_name,pix_fmt:format=duration,size',
    '-of', 'json', filePath,
  ])
  return JSON.parse(stdout)
}

async function main() {
  await mkdir(OUTPUT, { recursive: true })
  await mkdir(TMP, { recursive: true })

  const manifest = {
    generatedAt: new Date().toISOString(),
    note: 'Current UI demo assets built from the project\'s existing mock UI screenshots. Videos are illustrative walkthroughs, not recordings of real user data or completed API actions.',
    counts: { services: SERVICES.length, public: 13, internalReview: 4, screenshots: 0, videos: 0 },
    services: [],
  }

  for (const service of SERVICES) {
    const serviceDir = path.join(OUTPUT, service.scope, service.id)
    const screenshotDir = path.join(serviceDir, 'screenshots')
    const frameDir = path.join(TMP, service.id)
    await mkdir(screenshotDir, { recursive: true })
    await mkdir(frameDir, { recursive: true })
    const framePaths = []
    const screenshotFiles = []

    for (let index = 0; index < STEPS.length; index += 1) {
      const step = STEPS[index]
      const sourcePath = path.join(ROOT, 'public', service.id, 'shots', step.source)
      const copiedPath = path.join(screenshotDir, step.output)
      const framePath = path.join(frameDir, `${index + 1}.png`)
      await copyFile(sourcePath, copiedPath)
      await renderFrame(service, step, index, sourcePath, framePath)
      framePaths.push(framePath)
      screenshotFiles.push({
        step: step.label,
        path: path.relative(OUTPUT, copiedPath),
        sha256: await sha256(copiedPath),
      })
      manifest.counts.screenshots += 1
    }

    const videoPath = path.join(serviceDir, `${service.id}-ui-demo.mp4`)
    await makeVideo(framePaths, videoPath)
    const info = await videoInfo(videoPath)
    manifest.counts.videos += 1
    manifest.services.push({
      id: service.id,
      name: service.name,
      scope: service.scope,
      screenshots: screenshotFiles,
      video: {
        path: path.relative(OUTPUT, videoPath),
        sha256: await sha256(videoPath),
        codec: info.streams[0].codec_name,
        pixelFormat: info.streams[0].pix_fmt,
        width: info.streams[0].width,
        height: info.streams[0].height,
        durationSeconds: Number(info.format.duration),
        bytes: Number(info.format.size),
      },
    })
    process.stdout.write(`${service.name}: screenshots 3 + video 1\n`)
  }

  const contactDir = path.join(OUTPUT, 'contact-sheets')
  await mkdir(contactDir, { recursive: true })
  await createContactSheet(SERVICES.filter(s => s.scope === 'public'), path.join(contactDir, 'public-overview.png'), 'ドヤマーケ UIデモ（公開13サービス）')
  await createContactSheet(SERVICES.filter(s => s.scope === 'internal-review'), path.join(contactDir, 'internal-review-overview.png'), 'ドヤマーケ UIデモ（社内確認用4サービス）')

  const qaChecks = {
    serviceCountPass: manifest.counts.services === 17,
    publicServiceCountPass: manifest.counts.public === 13,
    internalReviewServiceCountPass: manifest.counts.internalReview === 4,
    screenshotCountPass: manifest.counts.screenshots === 51,
    videoCountPass: manifest.counts.videos === 17,
    videos1920x1080: manifest.services.every(s => s.video.width === 1920 && s.video.height === 1080),
    videosH264: manifest.services.every(s => s.video.codec === 'h264'),
    videosYuv420p: manifest.services.every(s => s.video.pixelFormat === 'yuv420p'),
    durationRangePass: manifest.services.every(s => s.video.durationSeconds >= 7 && s.video.durationSeconds <= 8),
  }
  const qa = {
    status: Object.values(qaChecks).every(Boolean) ? 'PASS' : 'FAIL',
    observed: manifest.counts,
    checks: qaChecks,
  }

  await writeFile(path.join(OUTPUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  await writeFile(path.join(OUTPUT, 'qa.json'), `${JSON.stringify(qa, null, 2)}\n`)

  for (const scope of ['public', 'internal-review']) {
    const selected = manifest.services.filter(service => service.scope === scope)
    const scopeLabel = scope === 'public' ? '公開対象13サービス' : '社内確認用4サービス'
    const scopeManifest = {
      generatedAt: manifest.generatedAt,
      scope,
      note: manifest.note,
      counts: {
        services: selected.length,
        screenshots: selected.reduce((sum, service) => sum + service.screenshots.length, 0),
        videos: selected.length,
      },
      services: selected,
    }
    const scopeQa = {
      status: selected.every(service =>
        service.screenshots.length === 3 &&
        service.video.width === 1920 && service.video.height === 1080 &&
        service.video.codec === 'h264' && service.video.pixelFormat === 'yuv420p' &&
        service.video.durationSeconds >= 7 && service.video.durationSeconds <= 8
      ) ? 'PASS' : 'FAIL',
      serviceCount: selected.length,
      screenshotCount: scopeManifest.counts.screenshots,
      videoCount: selected.length,
    }
    const scopeReadme = `# ドヤマーケ UIデモ — ${scopeLabel}\n\n` +
      `各サービスに入力・処理・結果のスクリーンショット3枚と、約7秒のMP4動画があります。\n\n` +
      (scope === 'public'
        ? `このフォルダは公開対象サービスのみを収録しています。\n`
        : `このフォルダは開発中サービスの社内確認用です。社外公開しないでください。\n`) +
      `動画は現行モックUIを使った紹介用デモで、実ユーザーデータやAPI処理成功の記録ではありません。\n`
    await writeFile(path.join(OUTPUT, scope, 'README.md'), scopeReadme)
    await writeFile(path.join(OUTPUT, scope, 'manifest.json'), `${JSON.stringify(scopeManifest, null, 2)}\n`)
    await writeFile(path.join(OUTPUT, scope, 'qa.json'), `${JSON.stringify(scopeQa, null, 2)}\n`)
  }

  const checksumLines = []
  for (const service of manifest.services) {
    for (const screenshot of service.screenshots) checksumLines.push(`${screenshot.sha256}  ${screenshot.path}`)
    checksumLines.push(`${service.video.sha256}  ${service.video.path}`)
  }
  for (const name of [
    'contact-sheets/public-overview.png', 'contact-sheets/internal-review-overview.png',
    'manifest.json', 'qa.json',
    'public/README.md', 'public/manifest.json', 'public/qa.json',
    'internal-review/README.md', 'internal-review/manifest.json', 'internal-review/qa.json',
  ]) {
    checksumLines.push(`${await sha256(path.join(OUTPUT, name))}  ${name}`)
  }
  await writeFile(path.join(OUTPUT, 'SHA256SUMS.txt'), `${checksumLines.join('\n')}\n`)

  const readme = `# ドヤマーケ UIデモ素材\n\n` +
    `現行17サービスのUI紹介素材です。各サービスに3枚のスクリーンショット（入力・処理・結果）と約7秒のMP4動画があります。\n\n` +
    `- \`public/\`: 公開対象13サービス\n` +
    `- \`internal-review/\`: 開発中・非公開4サービス（社外利用不可）\n` +
    `- \`contact-sheets/\`: 一覧確認画像\n` +
    `- \`manifest.json\`: ファイル一覧・動画仕様・SHA-256\n` +
    `- \`qa.json\`: 機械検証結果\n\n` +
    `## 重要\n\n` +
    `動画はプロジェクト内の現行モックUIを入力→処理→結果の順に見せる紹介用デモです。実ユーザーデータやAPI処理成功の記録ではありません。\n`
  await writeFile(path.join(OUTPUT, 'README.md'), readme)

  await rm(TMP, { recursive: true, force: true })
  const publicZip = path.join(OUTPUT, 'doyamarke-ui-demos-public.zip')
  const internalZip = path.join(OUTPUT, 'doyamarke-ui-demos-internal-review.zip')
  await rm(publicZip, { force: true })
  await rm(internalZip, { force: true })
  await run('zip', ['-r', '-X', '-q', path.basename(publicZip), 'public', 'contact-sheets/public-overview.png'], { cwd: OUTPUT })
  await run('zip', ['-r', '-X', '-q', path.basename(internalZip), 'internal-review', 'contact-sheets/internal-review-overview.png'], { cwd: OUTPUT })
  const checksumBase = await readFile(path.join(OUTPUT, 'SHA256SUMS.txt'), 'utf8')
  await writeFile(path.join(OUTPUT, 'SHA256SUMS.txt'), checksumBase +
    `${await sha256(publicZip)}  ${path.basename(publicZip)}\n` +
    `${await sha256(internalZip)}  ${path.basename(internalZip)}\n`)

  process.stdout.write(`${qa.status}: ${manifest.counts.services} services, ${manifest.counts.screenshots} screenshots, ${manifest.counts.videos} videos\n`)
}

await main()
