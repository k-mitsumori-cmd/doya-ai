import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import archiver from 'archiver'
import { createWriteStream } from 'node:fs'

import type { GeneratedLogoProject, LogoMode, LogoPatternId } from './types'

/**
 * Vercel環境では /tmp のみ書き込み可能なので、デフォルトを /tmp に変更
 */
function outputBaseDir(): string {
  return process.env.DOYA_LOGO_OUTPUT_DIR?.trim() || '/tmp/doya-logo-outputs'
}

function ensureLeadingHash(hex: string): string {
  if (!hex) return '#FFFFFF'
  return hex.startsWith('#') ? hex : `#${hex}`
}

function bgForMode(mode: LogoMode, primaryHex: string): string {
  if (mode === 'dark') return '#0B0F1A'
  if (mode === 'invert') return ensureLeadingHash(primaryHex)
  return '#FFFFFF'
}

export function injectBackground(svg: string, bgHex: string): string {
  const bg = ensureLeadingHash(bgHex)
  return svg.replace(/<svg([^>]*)>/, `<svg$1><rect width="100%" height="100%" fill="${bg}"/>`)
}

async function writeText(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, content, 'utf8')
}

async function writeJson(filePath: string, obj: unknown) {
  await writeText(filePath, JSON.stringify(obj, null, 2))
}

async function renderPng(svg: string, outPath: string) {
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(outPath)
}

async function renderJpeg(svgWithBg: string, outPath: string) {
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await sharp(Buffer.from(svgWithBg)).jpeg({ quality: 92, mozjpeg: true }).toFile(outPath)
}

export type ExportResult = {
  serviceDir: string
  zipPath: string
}

export async function exportProjectToDisk(project: GeneratedLogoProject): Promise<ExportResult> {
  const base = outputBaseDir()
  const serviceDir = path.join(base, project.meta.serviceSlug)
  const kitDir = path.join(serviceDir, 'kit')

  // 既存のディレクトリがあれば削除してクリーンに
  try {
    await fs.rm(serviceDir, { recursive: true, force: true })
  } catch {
    // ignore
  }

  await fs.mkdir(kitDir, { recursive: true })

  // meta + docs
  await writeJson(path.join(serviceDir, 'meta.json'), project.meta)
  await writeText(path.join(kitDir, 'guideline.md'), project.guidelineMarkdown)
  await writeText(path.join(kitDir, 'palette.md'), project.paletteMarkdown)
  await writeJson(
    path.join(kitDir, 'palette.json'),
    project.patterns.reduce((acc, p) => {
      acc[p.id] = p.palette
      return acc
    }, {} as Record<LogoPatternId, unknown>)
  )

  // per-pattern docs + assets
  for (const pattern of project.patterns) {
    const pDir = path.join(kitDir, `pattern-${pattern.id.toLowerCase()}`)
    await writeText(path.join(pDir, 'reasons.md'), pattern.reasons)
    await writeText(path.join(pDir, 'growth-story.md'), pattern.growthStory)
    await writeText(path.join(pDir, 'one-liner.txt'), pattern.oneLiner + '\n')
    await writeText(path.join(pDir, 'trademark-note.md'), pattern.trademarkNote)

    const logoDir = path.join(pDir, 'logos')

    for (const logo of pattern.logos) {
      const svgPath = path.join(logoDir, logo.svg.filename)
      const figmaSvgPath = path.join(logoDir, logo.figmaSvg.filename)
      const pngPath = path.join(logoDir, logo.png.filename)
      const jpgPath = path.join(logoDir, logo.jpeg.filename)

      await writeText(svgPath, logo.svg.content)
      await writeText(figmaSvgPath, logo.figmaSvg.content)

      // PNG: transparent background
      await renderPng(logo.svg.content, pngPath)

      // JPEG: background explicitly injected
      const bg = bgForMode(logo.mode, pattern.palette.primary.hex)
      const jpgSvg = injectBackground(logo.svg.content, bg)
      await renderJpeg(jpgSvg, jpgPath)
    }
  }

  // mockups (simple sample)
  const mockDir = path.join(kitDir, 'mockups')
  await fs.mkdir(mockDir, { recursive: true })
  const a = project.patterns.find((p) => p.id === 'A')
  const heroSvg = a?.logos.find((l) => l.layout === 'horizontal' && l.mode === 'default')?.svg.content || ''
  if (heroSvg) {
    const slide = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">`,
      `<rect width="1600" height="900" fill="#FFFFFF"/>`,
      `<rect x="80" y="70" width="1440" height="760" rx="24" fill="#F3F4F6"/>`,
      `<text x="120" y="190" font-family="system-ui, -apple-system, Noto Sans JP, sans-serif" font-size="44" fill="#111827" font-weight="700">提案資料サンプル</text>`,
      `<g transform="translate(120,240) scale(0.85)">`,
      injectBackground(heroSvg, '#F3F4F6'),
      `</g>`,
      `<text x="120" y="720" font-family="system-ui, -apple-system, Noto Sans JP, sans-serif" font-size="28" fill="#374151">ロゴは余白を大きめに、ヘッダー/表紙で安定して使えます。</text>`,
      `</svg>`,
    ].join('')
    await writeText(path.join(mockDir, `${project.meta.serviceSlug}-slide.svg`), slide)
  }

  // zip kit dir using archiver (Vercel compatible)
  const zipPath = path.join(serviceDir, `${project.meta.serviceSlug}-logo-kit.zip`)
  await createZipArchiver(kitDir, zipPath)

  return { serviceDir, zipPath }
}

/**
 * archiver を使った ZIP 生成（Vercel 環境対応）
 */
async function createZipArchiver(sourceDir: string, zipPath: string): Promise<void> {
  await fs.mkdir(path.dirname(zipPath), { recursive: true })

  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', () => resolve())
    output.on('error', reject)
    archive.on('error', reject)

    archive.pipe(output)
    archive.directory(sourceDir, false)
    archive.finalize()
  })
}
