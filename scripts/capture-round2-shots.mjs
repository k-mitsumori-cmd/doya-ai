import puppeteer from 'puppeteer-core'
import sharp from 'sharp'
import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const ROUTES = {
  banner: '/banner/landing', hr: '/hr', kintai: '/kintai', sfa: '/sfa', shodan: '/shodan', aio: '/aio',
  mensetsu: '/mensetsu', quote: '/quote', aishodan: '/aishodan', adimage: '/adimage', seo: '/seo',
  interview: '/interview', persona: '/persona', doyalist: '/doyalist', doyaslide: '/doyaslide', cunning: '/cunning', promane: '/promane',
}
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

async function saveShot(png, output) {
  const meta = await sharp(png).metadata()
  const scale = Math.min(1160 / (meta.width || 1), 680 / (meta.height || 1))
  const width = Math.round((meta.width || 1) * scale)
  const height = Math.round((meta.height || 1) * scale)
  const card = await sharp(png).resize(width, height).png().toBuffer()
  for (let quality = 76; quality >= 44; quality -= 4) {
    const data = await sharp({ create: { width: 1280, height: 800, channels: 4, background: '#f5f8fc' } })
      .composite([{ input: card, left: Math.round((1280 - width) / 2), top: Math.round((800 - height) / 2) }])
      .webp({ quality, effort: 6 }).toBuffer()
    if (data.length <= 80 * 1024 || quality === 44) { await fs.writeFile(output, data); return }
  }
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 2 })
  for (const [service, route] of Object.entries(ROUTES)) {
    const response = await page.goto(`http://localhost:3017${route}`, { waitUntil: 'networkidle0', timeout: 120000 })
    if (!response?.ok()) throw new Error(`${service}: HTTP ${response?.status()}`)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForSelector('[data-mock-window]', { timeout: 30000 })
    const windows = await page.$$('[data-mock-window]')
    if (windows.length < 3) throw new Error(`${service}: only ${windows.length} mock windows`)
    const outputDir = path.join(ROOT, 'public', service, 'shots')
    await fs.mkdir(outputDir, { recursive: true })
    for (let i = 0; i < 3; i++) {
      const png = await windows[i].screenshot({ type: 'png' })
      await saveShot(png, path.join(outputDir, `${i + 1}-${['input','process','output'][i]}.webp`))
    }
    process.stdout.write(`${service}: 3 shots\n`)
  }
} finally {
  await browser.close()
}
