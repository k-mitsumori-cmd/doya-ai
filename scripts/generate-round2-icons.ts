import { loadEnvConfig } from '@next/env'
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { generateImageWithFallback } from '../src/lib/image-generator'

loadEnvConfig(process.cwd())

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'reference/generated-assets/2026-08-20-round2')
const SPECS: Record<string, string> = {
  banner: 'a bold landscape image frame with a small sparkle accent',
  seo: 'a bold document page combined with a magnifying glass',
  interview: 'a bold microphone with two compact speech-wave marks',
  persona: 'a bold profile card with one person silhouette and a small target mark',
  hr: 'a bold team of three people with a compact organization node',
  kintai: 'a bold clock face combined with a single check mark',
  doyalist: 'a bold three-row company list with a compact search lens',
  doyaslide: 'a bold presentation screen with two layered slide cards',
  cunning: 'a bold speech bubble with a small open reference book',
  promane: 'a bold kanban board with three columns and one progress arc',
  sfa: 'a bold upward pipeline chart with three connected stages',
  shodan: 'a bold meeting table with two facing speech bubbles',
  aio: 'a bold orbit around a compact AI spark mark',
}

async function removeEdgeBackground(input: Buffer) {
  const image = sharp(input).ensureAlpha().resize(1024, 1024, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })
  if ([data[3], data[data.length - 1]].some((a) => a < 240)) return sharp(data, { raw: info }).png().toBuffer()

  const corners = [0, (info.width - 1) * 4, (info.height - 1) * info.width * 4, (info.width * info.height - 1) * 4]
  const bg = corners.reduce((acc, offset) => [acc[0] + data[offset], acc[1] + data[offset + 1], acc[2] + data[offset + 2]], [0, 0, 0]).map((v) => v / 4)
  const seen = new Uint8Array(info.width * info.height)
  const queue = new Int32Array(info.width * info.height)
  let head = 0
  let tail = 0
  const enqueue = (p: number) => { if (!seen[p]) { seen[p] = 1; queue[tail++] = p } }
  for (let x = 0; x < info.width; x++) { enqueue(x); enqueue((info.height - 1) * info.width + x) }
  for (let y = 0; y < info.height; y++) { enqueue(y * info.width); enqueue(y * info.width + info.width - 1) }
  while (head < tail) {
    const p = queue[head++]
    const o = p * 4
    const distance = Math.hypot(data[o] - bg[0], data[o + 1] - bg[1], data[o + 2] - bg[2])
    if (distance > 46) continue
    data[o + 3] = 0
    const x = p % info.width
    const y = Math.floor(p / info.width)
    if (x) enqueue(p - 1)
    if (x + 1 < info.width) enqueue(p + 1)
    if (y) enqueue(p - info.width)
    if (y + 1 < info.height) enqueue(p + info.width)
  }
  return sharp(data, { raw: info }).png().toBuffer()
}

async function writeSmallPng(master: Buffer, output: string) {
  for (const colours of [256, 128, 96, 64]) {
    const data = await sharp(master).resize(512, 512).png({ compressionLevel: 9, palette: true, colours, effort: 10 }).toBuffer()
    if (data.length <= 80 * 1024 || colours === 64) {
      await fs.writeFile(output, data)
      return data.length
    }
  }
  return 0
}

async function main() {
  const only = process.argv.slice(2)
  const targets = only.length ? only : Object.keys(SPECS)
  for (const id of targets) {
    if (!SPECS[id]) throw new Error(`Unknown service: ${id}`)
    const inputPath = path.join(ROOT, 'public', id, 'logo.png')
    const input = await fs.readFile(inputPath)
    const result = await generateImageWithFallback({
    size: '1024x1024',
    quality: 'high',
    inputImages: [{ mimeType: 'image/png', base64: input.toString('base64') }],
    prompt: `Create one production-ready square app icon derived from the attached official logo. Preserve the exact white bear mascot identity, thick dark navy outline, rounded friendly geometry, and visual weight. Express this service as ${SPECS[id]}. Use #0066ff as the primary color and #00e0ff as the only accent. No words, no letters, no numbers, no Japanese text, no watermark, no border, no mockup, no drop-shadow outside the mark. One centered symbol with generous transparent padding, readable at 16px. Output a clean isolated mark on a genuinely transparent background.`,
    temperature: 0.25,
    })
    const cleaned = await removeEdgeBackground(Buffer.from(result.base64, 'base64'))
    const outDir = path.join(OUT, id)
    await fs.mkdir(outDir, { recursive: true })
    await fs.mkdir(path.join(ROOT, 'public', id), { recursive: true })
    const master = await sharp(cleaned).resize(1024, 1024, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } }).png({ compressionLevel: 9 }).toBuffer()
    await fs.writeFile(path.join(outDir, 'icon-1024.png'), master)
    const bytes = await writeSmallPng(master, path.join(ROOT, 'public', id, 'icon.png'))
    process.stdout.write(`${id}: ${result.model}, ${bytes} bytes\n`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
