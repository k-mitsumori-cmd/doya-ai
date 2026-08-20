import { loadEnvConfig } from '@next/env'
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { generateImageWithFallback } from '../src/lib/image-generator'

loadEnvConfig(process.cwd())
const ROOT = process.cwd()
const OUT = path.join(ROOT, 'public/banner-samples')
const ARCHIVE = path.join(ROOT, 'reference/generated-assets/2026-08-20-round3/banner-samples')

const categories: Record<string, string> = {
  'cat-telecom': 'telecommunications and mobile connectivity, a sleek smartphone with flowing network signals and connected nodes',
  'cat-marketing': 'digital marketing, an analytics dashboard motif, campaign cards, target rings, and rising chart shapes',
  'cat-ec': 'e-commerce, a premium product box, shopping bag, product cards, and a clean purchase-flow composition',
  'cat-recruit': 'recruiting, two East Asian Japanese or Korean professionals in a bright modern office with profile-card shapes',
  'cat-beauty': 'beauty and cosmetics, a premium skincare bottle, soft reflective surfaces, water droplets, and elegant studio styling',
  'cat-food': 'food and dining, an appetizing plated meal in a modern Japanese cafe setting with editorial food photography',
  'cat-realestate': 'real estate, a refined modern Japanese apartment exterior and bright interior cutaway with architectural geometry',
  'cat-education': 'education, an East Asian Japanese or Korean learner at a desk with tablet, notebook, and structured learning cards',
  'cat-finance': 'finance and investment, secure abstract financial charts, coins, card shapes, and a calm trustworthy composition',
  'cat-health': 'health and wellness, an East Asian Japanese or Korean healthcare professional with clean health-data shapes and fresh daylight',
  'cat-it': 'B2B software and technology, a polished SaaS dashboard floating above connected data modules and cloud infrastructure',
  'cat-other': 'professional business services, a versatile modern workspace with abstract service cards and collaborative tools',
}

const purposes: Record<string, string> = {
  'purpose-sns_ad': 'a high-impact social media feed advertisement with one bold central product visual, strong focal hierarchy, and a clear empty CTA block',
  'purpose-youtube': 'a YouTube video thumbnail composition with a surprised East Asian Japanese or Korean presenter, a product screen, dramatic light, and bold empty headline space',
  'purpose-display': 'a clean display advertisement with a product cutout, compact benefit modules, strong contrast, and an empty CTA shape',
  'purpose-webinar': 'a professional webinar announcement with an East Asian Japanese or Korean speaker portrait, event-card geometry, date placeholders, and calm authority',
  'purpose-lp_hero': 'a premium landing-page hero with product UI mockup on the right and generous empty copy space on the left',
  'purpose-email': 'an email newsletter header with a product announcement scene, compact visual hierarchy, and a clean centered empty title area',
  'purpose-campaign': 'a limited campaign promotion with a gift box, energetic ribbons, confetti shapes, and a prominent empty offer badge',
}

const sizeNames = ['1080x1080','1200x628','1080x1920','1280x720','1920x1080','300x250','728x90','320x50','1920x600','1200x800','600x200','600x300']

async function writeWebp(input: Buffer, output: string) {
  const fitted = await sharp(input).resize(1200, 628, { fit: 'cover', position: 'attention' }).toBuffer()
  for (let quality = 76; quality >= 38; quality -= 4) {
    const webp = await sharp(fitted).webp({ quality, effort: 6 }).toBuffer()
    if (webp.length <= 80 * 1024 || quality === 38) {
      await fs.writeFile(output, webp)
      return webp.length
    }
  }
  return 0
}

async function generateSample(name: string, subject: string, accent: string) {
  const prompt = `Create a polished production banner design sample for a Japanese B2B SaaS banner generator. Theme: ${subject}. Use #0066ff as the dominant brand color and ${accent} as the only vivid accent, supported by white and deep navy neutrals. Make the composition unmistakably look like a finished advertising banner, with clear visual hierarchy, intentional negative space where HTML text could later be placed, and premium commercial art direction. Do not render any readable text, letters, numbers, logos, brand marks, watermarks, UI labels, or pseudo-language. If people appear, they must have clearly East Asian Japanese or Korean facial features. Landscape 1200:628 composition, safe margins, no border, no device-frame mockup around the whole image.`
  const result = await generateImageWithFallback({ prompt, size: '1200x624', quality: 'medium' })
  const raw = Buffer.from(result.base64, 'base64')
  await fs.writeFile(path.join(ARCHIVE, `${name}-master.${result.mimeType.includes('webp') ? 'webp' : 'png'}`), raw)
  const bytes = await writeWebp(raw, path.join(OUT, `${name}.webp`))
  process.stdout.write(`${name}: ${result.model}, ${bytes} bytes\n`)
}

async function generateSizeDiagram(dimensions: string) {
  const [w, h] = dimensions.split('x').map(Number)
  const maxW = 760
  const maxH = 390
  const scale = Math.min(maxW / w, maxH / h)
  const rw = Math.max(64, Math.round(w * scale))
  const rh = Math.max(24, Math.round(h * scale))
  const x = Math.round((1200 - rw) / 2)
  const y = Math.round((628 - rh) / 2)
  const svg = `<svg width="1200" height="628" viewBox="0 0 1200 628" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#eef6ff"/><stop offset="1" stop-color="#dffbff"/></linearGradient><linearGradient id="panel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0066ff"/><stop offset="1" stop-color="#00e0ff"/></linearGradient><filter id="shadow"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#003c99" flood-opacity=".22"/></filter></defs>
    <rect width="1200" height="628" rx="44" fill="url(#bg)"/>
    <circle cx="1050" cy="80" r="180" fill="#0066ff" opacity=".08"/><circle cx="125" cy="560" r="210" fill="#00e0ff" opacity=".12"/>
    <rect x="${x}" y="${y}" width="${rw}" height="${rh}" rx="${Math.min(28, Math.round(rh / 5))}" fill="white" stroke="url(#panel)" stroke-width="8" filter="url(#shadow)"/>
    <rect x="${x + Math.min(24, rw * .08)}" y="${y + Math.min(24, rh * .15)}" width="${Math.max(12, rw * .32)}" height="${Math.max(4, Math.min(18, rh * .12))}" rx="9" fill="#0066ff" opacity=".85"/>
    <rect x="${x + Math.min(24, rw * .08)}" y="${y + Math.min(52, rh * .45)}" width="${Math.max(10, rw * .2)}" height="${Math.max(3, Math.min(10, rh * .08))}" rx="5" fill="#00e0ff" opacity=".8"/>
  </svg>`
  const bytes = await writeWebp(Buffer.from(svg), path.join(OUT, `size-${dimensions}.webp`))
  process.stdout.write(`size-${dimensions}: code, ${bytes} bytes\n`)
}

async function runPool(entries: Array<[string,string,string]>, concurrency = 2) {
  let cursor = 0
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < entries.length) {
      const entry = entries[cursor++]
      await generateSample(...entry)
    }
  }))
}

async function main() {
  await fs.mkdir(OUT, { recursive: true })
  await fs.mkdir(ARCHIVE, { recursive: true })
  const entries: Array<[string,string,string]> = [
    ...Object.entries(categories).map(([name, subject], i) => [name, subject, ['#00e0ff','#ffd400','#ff1e72','#009bff'][i % 4]] as [string,string,string]),
    ...Object.entries(purposes).map(([name, subject], i) => [name, subject, ['#ff1e72','#ffd400','#00e0ff','#009bff'][i % 4]] as [string,string,string]),
  ]
  const only = process.argv.slice(2)
  const selected = only.length ? entries.filter(([name]) => only.includes(name)) : entries
  await runPool(selected)
  if (!only.length) for (const dimensions of sizeNames) await generateSizeDiagram(dimensions)
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
