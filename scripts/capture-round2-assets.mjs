import puppeteer from 'puppeteer-core'
import sharp from 'sharp'
import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const SERVICES = [
  ['seo', '#334155'],
  ['interview', '#ff1e72'],
  ['persona', '#009bff'],
  ['doyalist', '#00b981'],
  ['doyaslide', '#009bff'],
  ['cunning', '#00e0ff'],
  ['promane', '#009bff'],
]
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = path.join(ROOT, 'reference/generated-assets/2026-08-20-round2')

async function webpUnder(input, output, width, height, maxBytes, startQuality = 82) {
  for (let quality = startQuality; quality >= 44; quality -= 4) {
    const data = await sharp(input).resize(width, height, { fit: 'fill' }).webp({ quality, effort: 6 }).toBuffer()
    if (data.length <= maxBytes || quality === 46) {
      await fs.writeFile(output, data)
      return { bytes: data.length, quality }
    }
  }
}

function backdrop(accent) {
  return Buffer.from(`<svg width="3200" height="2000" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f8fbff"/><stop offset="1" stop-color="#edf5ff"/></linearGradient>
      <radialGradient id="a"><stop stop-color="#0066ff" stop-opacity=".22"/><stop offset="1" stop-color="#0066ff" stop-opacity="0"/></radialGradient>
      <radialGradient id="b"><stop stop-color="${accent}" stop-opacity=".20"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="3200" height="2000" fill="url(#bg)"/>
    <circle cx="400" cy="260" r="820" fill="url(#a)"/><circle cx="2820" cy="1680" r="900" fill="url(#b)"/>
    <path d="M0 1720 C800 1480 1260 1960 2050 1690 S2860 1450 3200 1620 V2000 H0Z" fill="#0066ff" fill-opacity=".045"/>
  </svg>`)
}

async function paddedShot(png, output) {
  const image = sharp(png)
  const meta = await image.metadata()
  const scale = Math.min(1160 / (meta.width || 1), 680 / (meta.height || 1))
  const width = Math.max(1, Math.round((meta.width || 1) * scale))
  const height = Math.max(1, Math.round((meta.height || 1) * scale))
  const card = await image.resize(width, height).png().toBuffer()
  let quality = 76
  while (quality >= 42) {
    const data = await sharp({ create: { width: 1280, height: 800, channels: 4, background: '#f5f8fc' } })
      .composite([{ input: card, left: Math.round((1280 - width) / 2), top: Math.round((800 - height) / 2) }])
      .webp({ quality, effort: 6 }).toBuffer()
    if (data.length <= 80 * 1024 || quality === 44) {
      await fs.writeFile(output, data)
      return data.length
    }
    quality -= 4
  }
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 2 })
  for (const [service, accent] of SERVICES) {
    const rawDir = path.join(OUT, service)
    const publicDir = path.join(ROOT, 'public', service)
    const shotsDir = path.join(publicDir, 'shots')
    await fs.mkdir(rawDir, { recursive: true })
    await fs.mkdir(shotsDir, { recursive: true })
    const response = await page.goto(`http://localhost:3017/${service}`, { waitUntil: 'networkidle0', timeout: 120000 })
    if (!response?.ok()) throw new Error(`${service}: HTTP ${response?.status()}`)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForSelector('[data-asset-shot]', { timeout: 30000 })

    const shotNames = ['input', 'process', 'output']
    for (let i = 0; i < shotNames.length; i++) {
      const handles = await page.$$(`[data-asset-shot="${shotNames[i]}"]`)
      const inner = handles.at(-1)
      if (!inner) throw new Error(`${service}: missing ${shotNames[i]} mock`)
      const windowHandle = await inner.evaluateHandle((node) => node.parentElement?.parentElement || node)
      const png = await windowHandle.asElement().screenshot({ type: 'png' })
      await fs.writeFile(path.join(rawDir, `shot-${i + 1}-${shotNames[i]}.png`), png)
      await paddedShot(png, path.join(shotsDir, `${i + 1}-${shotNames[i]}.webp`))
    }

    const heroInner = (await page.$$('[data-asset-shot]'))[0]
    const heroWindow = await heroInner.evaluateHandle((node) => node.parentElement?.parentElement || node)
    const heroPng = await heroWindow.asElement().screenshot({ type: 'png' })
    await fs.writeFile(path.join(rawDir, 'hero-window.png'), heroPng)
    const meta = await sharp(heroPng).metadata()
    const targetW = 2350
    const targetH = Math.round(targetW * (meta.height || 1) / (meta.width || 1))
    const resized = await sharp(heroPng).resize(targetW, targetH).png().toBuffer()
    const master = await sharp(backdrop(accent)).composite([{ input: resized, left: Math.round((3200 - targetW) / 2), top: Math.round((2000 - targetH) / 2) }]).png().toBuffer()
    await fs.writeFile(path.join(rawDir, 'hero-master-3200x2000.png'), master)
    await sharp(master).webp({ quality: 84, effort: 6 }).toFile(path.join(publicDir, 'hero@2x.webp'))
    await webpUnder(master, path.join(publicDir, 'hero.webp'), 1600, 1000, 300 * 1024, 82)
    await webpUnder(master, path.join(publicDir, 'card.webp'), 800, 500, 120 * 1024, 80)
    await webpUnder(master, path.join(publicDir, 'og-bg.webp'), 1200, 630, 220 * 1024, 80)
    process.stdout.write(`${service} captured\n`)
  }
} finally {
  await browser.close()
}
