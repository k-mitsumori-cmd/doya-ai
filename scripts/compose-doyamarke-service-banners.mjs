import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const PROJECT = process.cwd()
const ROOT = path.join(PROJECT, 'reference/generated-assets/2026-08-24-doyamarke-service-banners')
const SPECS = path.join(ROOT, 'specs')
const MASCOTS = path.join(ROOT, 'mascots')
const CLEAN = path.join(ROOT, 'mascots-clean')
const OUT = path.join(ROOT, 'images')
const WIDTH = 1600
const HEIGHT = 900

const layouts = {
  seo:       { copyX: 72,  copyY: 34, ui: [700, 142, 820, 512], mascot: [610, 554, 350, 320] },
  doyalist:  { copyX: 72,  copyY: 34, ui: [735, 126, 790, 494], mascot: [615, 540, 360, 320] },
  hr:        { copyX: 960, copyY: 34, ui: [54, 168, 820, 512], mascot: [650, 590, 280, 270] },
  kintai:    { copyX: 72,  copyY: 34, ui: [660, 160, 790, 494], mascot: [1250, 520, 300, 310] },
  promane:   { copyX: 72,  copyY: 34, ui: [760, 104, 750, 469], secondary: [650, 402, 560, 350, 'shots/2-process.webp'], mascot: [1100, 506, 380, 350] },
  doyaslide: { copyX: 72,  copyY: 18, ui: [625, 282, 890, 556], mascot: [410, 520, 300, 330] },
  cunning:   { copyX: 72,  copyY: 34, ui: [700, 142, 820, 512], mascot: [1230, 500, 320, 340] },
  sfa:       { copyX: 72,  copyY: 18, ui: [550, 300, 980, 612], mascot: [1230, 52, 310, 320] },
  shodan:    { copyX: 72,  copyY: 34, ui: [780, 98, 730, 456], secondary: [665, 392, 585, 366, 'shots/2-process.webp'], mascot: [1190, 498, 330, 340] },
  aio:       { copyX: 72,  copyY: 18, ui: [665, 252, 850, 531], secondary: [455, 470, 550, 344, 'shots/3-output.webp'], mascot: [320, 610, 280, 260] },
  adimage:   { copyX: 72,  copyY: 34, ui: [730, 112, 800, 500], mascot: [1150, 510, 380, 350] },
  interview: { copyX: 960, copyY: 34, ui: [54, 166, 820, 512], mascot: [635, 570, 280, 300] },
  persona:   { copyX: 72,  copyY: 34, ui: [700, 128, 810, 506], mascot: [1160, 530, 360, 310] },
  mensetsu:  { copyX: 72,  copyY: 24, ui: [780, 120, 730, 456], mascot: [560, 520, 340, 350] },
  quote:     { copyX: 72,  copyY: 34, ui: [750, 118, 760, 475], mascot: [630, 525, 340, 340] },
}

const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

function hexRgb(hex) {
  const value = hex.replace('#', '')
  return { r: parseInt(value.slice(0, 2), 16), g: parseInt(value.slice(2, 4), 16), b: parseInt(value.slice(4, 6), 16) }
}

function alphaHex(hex, alpha) {
  const { r, g, b } = hexRgb(hex)
  return `rgba(${r},${g},${b},${alpha})`
}

async function cleanMascot(id) {
  const src = path.join(MASCOTS, `${id}.png`)
  const dst = path.join(CLEAN, `${id}.png`)
  const metadata = await sharp(src).metadata()
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const pixels = info.width * info.height
  let transparent = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] < 16) transparent++

  if (!metadata.hasAlpha || transparent / pixels < 0.03) {
    const corner = [0, info.width - 1, (info.height - 1) * info.width, info.height * info.width - 1]
      .map((p) => [data[p * 4], data[p * 4 + 1], data[p * 4 + 2]])
    const brightness = corner.reduce((sum, rgb) => sum + Math.max(...rgb), 0) / corner.length
    const darkMode = brightness < 100
    const isBackground = (p) => {
      const i = p * 4
      if (data[i + 3] < 16) return true
      const r = data[i], g = data[i + 1], b = data[i + 2]
      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      const chroma = max - min
      return darkMode ? (max < 82 && chroma < 36) : (min > 186 && chroma < 40)
    }
    const seen = new Uint8Array(pixels)
    const queue = new Int32Array(pixels)
    let head = 0, tail = 0
    const enqueue = (p) => {
      if (!seen[p] && isBackground(p)) { seen[p] = 1; queue[tail++] = p }
    }
    for (let x = 0; x < info.width; x++) { enqueue(x); enqueue((info.height - 1) * info.width + x) }
    for (let y = 0; y < info.height; y++) { enqueue(y * info.width); enqueue(y * info.width + info.width - 1) }
    while (head < tail) {
      const p = queue[head++]
      const x = p % info.width, y = Math.floor(p / info.width)
      if (x > 0) enqueue(p - 1)
      if (x + 1 < info.width) enqueue(p + 1)
      if (y > 0) enqueue(p - info.width)
      if (y + 1 < info.height) enqueue(p + info.width)
    }
    for (let p = 0; p < pixels; p++) if (seen[p]) data[p * 4 + 3] = 0
  }

  await sharp(data, { raw: info }).png().trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } }).toFile(dst)
  return dst
}

function backgroundSvg(accent, id) {
  const dots = Array.from({ length: 28 }, (_, i) => {
    const x = 1180 + (i % 7) * 48
    const y = 60 + Math.floor(i / 7) * 48
    return `<circle cx="${x}" cy="${y}" r="3.5" fill="${accent}" opacity="0.18"/>`
  }).join('')
  return Buffer.from(`<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff"/><stop offset="0.58" stop-color="#f8fafc"/><stop offset="1" stop-color="${accent}" stop-opacity="0.10"/>
      </linearGradient>
      <linearGradient id="band" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${accent}" stop-opacity="0.12"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></linearGradient>
    </defs>
    <rect width="1600" height="900" fill="url(#bg)"/>
    <path d="M0 760 C320 670 540 840 860 760 C1140 690 1340 720 1600 630 L1600 900 L0 900Z" fill="url(#band)"/>
    <circle cx="1490" cy="40" r="250" fill="${accent}" opacity="0.055"/>
    <circle cx="70" cy="870" r="210" fill="${accent}" opacity="0.04"/>
    ${dots}
    <text x="1515" y="855" text-anchor="end" font-family="Arial, sans-serif" font-size="14" font-weight="700" letter-spacing="2.5" fill="#64748b">DOYA MARKE AI · ${esc(id.toUpperCase())}</text>
  </svg>`)
}

function frameSvg(x, y, w, h, accent) {
  return Buffer.from(`<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="s" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="22" stdDeviation="22" flood-color="#0f172a" flood-opacity="0.14"/></filter></defs>
    <rect x="${x - 10}" y="${y - 10}" width="${w + 20}" height="${h + 20}" rx="30" fill="#fff" stroke="${alphaHex(accent, 0.22)}" stroke-width="2" filter="url(#s)"/>
  </svg>`)
}

async function roundedImage(src, w, h) {
  const base = await sharp(src).resize({ width: w, height: h, fit: 'cover', position: 'center' }).png().toBuffer()
  const mask = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="22" fill="white"/></svg>`)
  return sharp(base).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
}

function textSvg(spec, layout) {
  const accent = spec.service.primary_color
  const x = layout.copyX, y = layout.copyY
  const isRight = x > 800
  const copyW = isRight ? 560 : 600
  const firstLength = [...spec.banner.headline[0]].length
  const secondLength = [...spec.banner.headline[1]].length
  const headlineSize = Math.min(62, Math.floor((copyW - 12) / firstLength))
  const secondSize = Math.min(70, Math.floor((copyW - 12) / secondLength))
  const supportY = y + 312
  const chipsY = y + 408
  const chipMarkup = spec.banner.feature_chips.map((label, i) => {
    const width = Math.min(copyW - 12, 52 + [...label].length * 19)
    const cy = chipsY + i * 47
    return `<rect x="${x}" y="${cy}" width="${width}" height="36" rx="18" fill="#fff" stroke="${accent}" stroke-opacity="0.24"/><circle cx="${x + 18}" cy="${cy + 18}" r="5" fill="${accent}"/><text x="${x + 32}" y="${cy + 24}" font-family="Hiragino Sans, Hiragino Kaku Gothic ProN, sans-serif" font-size="17" font-weight="600" fill="#334155">${esc(label)}</text>`
  }).join('')
  const buttonY = chipsY + 157
  return Buffer.from(`<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <text x="${x}" y="${y + 158}" font-family="Hiragino Sans, Hiragino Kaku Gothic ProN, sans-serif" font-size="${headlineSize}" font-weight="800" letter-spacing="-1.8" fill="#0f172a">${esc(spec.banner.headline[0])}</text>
    <text x="${x}" y="${y + 236}" font-family="Hiragino Sans, Hiragino Kaku Gothic ProN, sans-serif" font-size="${secondSize}" font-weight="800" letter-spacing="-1.8" fill="${accent}">${esc(spec.banner.headline[1])}</text>
    <text x="${x}" y="${supportY}" font-family="Hiragino Sans, Hiragino Kaku Gothic ProN, sans-serif" font-size="22" font-weight="500" fill="#475569">${esc(spec.banner.support_copy[0])}</text>
    <text x="${x}" y="${supportY + 34}" font-family="Hiragino Sans, Hiragino Kaku Gothic ProN, sans-serif" font-size="22" font-weight="500" fill="#475569">${esc(spec.banner.support_copy[1])}</text>
    ${chipMarkup}
    <rect x="${x}" y="${buttonY}" width="220" height="58" rx="14" fill="${accent}"/>
    <text x="${x + 110}" y="${buttonY + 38}" text-anchor="middle" font-family="Hiragino Sans, Hiragino Kaku Gothic ProN, sans-serif" font-size="20" font-weight="700" fill="#fff">${esc(spec.banner.cta)}  →</text>
  </svg>`)
}

async function fitLogo(src, maxW = 245, maxH = 105) {
  return sharp(src).resize({ width: maxW, height: maxH, fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer()
}

async function render(id) {
  const spec = JSON.parse(await fs.readFile(path.join(SPECS, `${id}.json`), 'utf8'))
  const l = layouts[id]
  if (!l) throw new Error(`No layout for ${id}`)
  const accent = spec.service.primary_color
  const [ux, uy, uw, uh] = l.ui
  const screenshot = path.join(PROJECT, spec.research.official_screenshot_reference)
  const logo = path.join(PROJECT, spec.research.official_logo_reference)
  const mascotPath = await cleanMascot(id)
  const mainUi = await roundedImage(screenshot, uw, uh)
  const mascot = await sharp(mascotPath).resize({
    width: l.mascot[2], height: l.mascot[3], fit: 'contain',
    background: { r: 255, g: 255, b: 255, alpha: 0 },
  }).png().toBuffer()
  const logoImage = await fitLogo(logo)
  const composites = [
    { input: backgroundSvg(accent, id), left: 0, top: 0 },
    { input: frameSvg(ux, uy, uw, uh, accent), left: 0, top: 0 },
    { input: mainUi, left: ux, top: uy },
  ]

  if (l.secondary) {
    const [sx, sy, sw, sh, rel] = l.secondary
    const second = await roundedImage(path.join(PROJECT, 'public', id, rel), sw, sh)
    composites.push({ input: frameSvg(sx, sy, sw, sh, accent), left: 0, top: 0 }, { input: second, left: sx, top: sy })
  }
  composites.push(
    { input: textSvg(spec, l), left: 0, top: 0 },
    { input: logoImage, left: l.copyX, top: l.copyY + 6 },
    { input: mascot, left: l.mascot[0], top: l.mascot[1] },
  )

  await sharp({ create: { width: WIDTH, height: HEIGHT, channels: 4, background: '#ffffff' } })
    .composite(composites)
    .png({ compressionLevel: 9, palette: false })
    .toFile(path.join(OUT, `${id}.png`))
  console.log(`rendered ${id}`)
}

await fs.mkdir(CLEAN, { recursive: true })
await fs.mkdir(OUT, { recursive: true })
const requested = process.argv.slice(2)
const ids = requested.length ? requested : Object.keys(layouts)
for (const id of ids) await render(id)
