import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const outputRoot = path.join(root, 'reference/generated-assets/2026-09-01-doyamarke-real-usage-focus-recordings')
const config = JSON.parse(await readFile(path.join(root, 'scripts/recordings/doyamarke-services.json'), 'utf8'))
const outDir = path.join(outputRoot, 'contact-sheets')
await mkdir(outDir, { recursive: true })

for (const tier of ['public', 'internal-review']) {
  const services = config.services.filter(service => service.tier === tier)
  const cols = tier === 'public' ? 3 : 2
  const tileW = 560
  const tileH = 365
  const gap = 24
  const margin = 36
  const header = 92
  const rows = Math.ceil(services.length / cols)
  const width = margin * 2 + cols * tileW + (cols - 1) * gap
  const height = header + margin + rows * tileH + (rows - 1) * gap + margin
  const base = sharp({ create: { width, height, channels: 3, background: '#eef2ff' } })
  const composites = [{
    input: Buffer.from(`<svg width="${width}" height="${header}" xmlns="http://www.w3.org/2000/svg"><text x="${margin}" y="62" font-family="Hiragino Sans,Noto Sans JP,sans-serif" font-size="38" font-weight="700" fill="#0f172a">ドヤマーケ 実操作動画 ${tier === 'public' ? '公開13サービス' : '内部確認4サービス'}</text></svg>`),
    left: 0,
    top: 0
  }]
  for (let index = 0; index < services.length; index += 1) {
    const service = services[index]
    const framePath = path.join(outputRoot, service.tier, service.id, 'qa', 'focus.jpg')
    const frame = await sharp(framePath).resize(520, 293, { fit: 'cover' }).jpeg({ quality: 88 }).toBuffer()
    const card = await sharp({ create: { width: tileW, height: tileH, channels: 3, background: '#ffffff' } })
      .composite([
        { input: frame, left: 20, top: 18 },
        { input: Buffer.from(`<svg width="${tileW}" height="54" xmlns="http://www.w3.org/2000/svg"><text x="20" y="38" font-family="Hiragino Sans,Noto Sans JP,sans-serif" font-size="24" font-weight="700" fill="#0f172a">${service.order}. ${service.name}</text></svg>`), left: 0, top: 310 }
      ])
      .jpeg({ quality: 92 })
      .toBuffer()
    composites.push({ input: card, left: margin + (index % cols) * (tileW + gap), top: header + margin + Math.floor(index / cols) * (tileH + gap) })
  }
  await base.composite(composites).jpeg({ quality: 90 }).toFile(path.join(outDir, `${tier}-focus-overview.jpg`))
}

process.stdout.write(`${outDir}\n`)
