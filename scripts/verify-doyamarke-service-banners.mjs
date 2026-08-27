import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import sharp from 'sharp'

const PROJECT = process.cwd()
const ROOT = path.join(PROJECT, 'reference/generated-assets/2026-08-24-doyamarke-service-banners')
const manifest = JSON.parse(await fs.readFile(path.join(ROOT, 'manifest.json'), 'utf8'))
const checks = []
const files = []

const check = (ok, label, details = '') => {
  checks.push({ ok: Boolean(ok), label, details })
  if (!ok) console.error(`FAIL ${label}: ${details}`)
}

check(manifest.count === 15, 'manifest count', String(manifest.count))
check(manifest.items.length === 15, 'manifest item length', String(manifest.items.length))

for (const item of manifest.items) {
  const specPath = path.join(ROOT, item.spec)
  const imagePath = path.join(ROOT, 'images', `${item.id}.png`)
  const mascotPath = path.join(ROOT, 'mascots-clean', `${item.id}.png`)
  const logoPath = path.join(PROJECT, item.logo)
  const screenshotPath = path.join(PROJECT, item.screenshot)
  const spec = JSON.parse(await fs.readFile(specPath, 'utf8'))
  const meta = await sharp(imagePath).metadata()
  const mascotMeta = await sharp(mascotPath).metadata()
  const buffer = await fs.readFile(imagePath)
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex')

  check(meta.format === 'png', `${item.id} format`, meta.format)
  check(meta.width === 1600 && meta.height === 900, `${item.id} dimensions`, `${meta.width}x${meta.height}`)
  check(spec.banner.aspect_ratio === '16:9', `${item.id} spec aspect`, spec.banner.aspect_ratio)
  check(spec.service.official_url === item.official_url, `${item.id} official URL`, spec.service.official_url)
  check(spec.product_ui.do_not_invent_features === true, `${item.id} no invented features`, String(spec.product_ui.do_not_invent_features))
  check(mascotMeta.format === 'png' && mascotMeta.hasAlpha === true, `${item.id} mascot alpha`, `${mascotMeta.format}/${mascotMeta.hasAlpha}`)
  await fs.access(logoPath)
  await fs.access(screenshotPath)
  files.push({ id: item.id, filename: `${item.id}.png`, width: meta.width, height: meta.height, bytes: buffer.length, sha256 })
}

const passed = checks.filter((x) => x.ok).length
const failed = checks.length - passed
const result = {
  verified_at: '2026-08-24T00:00:00+09:00',
  scope: '15 final banner PNGs, 15 JSON specs, official logo/UI path existence, cleaned generated mascot PNGs',
  passed,
  failed,
  checks,
  files,
  visual_review: {
    status: 'passed after targeted corrections',
    reviewed: ['all 15 banners via contact sheet', 'seo full-size', 'hr full-size', 'sfa full-size', 'interview full-size', 'persona full-size', 'promane full-size', 'shodan full-size', 'aio full-size', 'mensetsu full-size'],
    corrected: ['seo headline overflow', 'seo mascot padding', 'hr mascot/CTA overlap', 'interview mascot/CTA overlap', 'aio mascot/CTA overlap', 'persona excess secondary UI'],
  },
}

await fs.writeFile(path.join(ROOT, 'qa', 'verification.json'), `${JSON.stringify(result, null, 2)}\n`)
const csv = ['id,filename,width,height,bytes,sha256', ...files.map((f) => `${f.id},${f.filename},${f.width},${f.height},${f.bytes},${f.sha256}`)].join('\n')
await fs.writeFile(path.join(ROOT, 'qa', 'file-manifest.csv'), `${csv}\n`)
console.log(JSON.stringify({ passed, failed, files: files.length }))
if (failed) process.exitCode = 1
