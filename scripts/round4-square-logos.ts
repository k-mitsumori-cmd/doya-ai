// 正方形ロゴ（banner / seo / interview / persona）を 2016x864 の横長構図へ再構成する。
// 絵柄は既存ロゴを参照画像として渡し、白クマ・配色・太アウトラインを保つ。
// ⚠️ 透過が要るので background: 'transparent' を明示する（既定は不透過）。
import { loadEnv } from './_env'
loadEnv()

import { generateImageWithFallback } from '@/lib/image-generator'
import sharp from 'sharp'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

const OUT = 'reference/generated-assets/2026-08-20-round4/square-to-wide'
const LEGACY = 'reference/generated-assets/2026-08-20-round4/legacy-logos'

const TARGETS = [
  { id: 'banner', label: 'ドヤバナーAI', motif: 'banner variations floating around the bear' },
  { id: 'seo', label: 'ドヤ記事作成', motif: 'a long-form article draft and search ranking bars' },
  { id: 'interview', label: 'ドヤインタビュー', motif: 'a microphone and a transcript panel' },
  { id: 'persona', label: 'ドヤペルソナAI', motif: 'persona cards with portraits and attribute chips' },
]

function prompt(t: (typeof TARGETS)[number]) {
  return [
    'Use case: logo-brand. Recompose the supplied square logo into a WIDE horizontal lockup.',
    'Keep the exact same white polar bear character wearing cyan VR goggles, the same thick navy outline,',
    'the same blue/cyan/white pop-tech palette, and the same sticker-style rounded badge treatment.',
    `Left side: the bear together with ${t.motif}. Right side: the existing Japanese logotype, unchanged.`,
    'Composition: single horizontal badge, aspect ratio about 2.33:1, balanced left art and right logotype,',
    'generous internal padding, nothing cropped at the edges.',
    'Do NOT add any tagline, subtitle, extra sentence, English caption, or new characters.',
    'Transparent background. No drop shadow outside the badge.',
  ].join(' ')
}

async function main() {
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })
  for (const t of TARGETS) {
    const ref = readFileSync(`${LEGACY}/${t.id}-logo.png`)
    process.stdout.write(`${t.id} 生成中... `)
    try {
      const r = await generateImageWithFallback({
        prompt: prompt(t),
        size: '1536x1024',
        quality: 'high',
        background: 'transparent',
        inputImages: [{ base64: ref.toString('base64'), mimeType: 'image/png' }],
      })
      const raw = Buffer.from(r.base64, 'base64')
      writeFileSync(`${OUT}/${t.id}-raw.png`, raw)
      const fitted = await sharp(raw)
        .trim({ threshold: 1 })
        .resize(2016, 864, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ palette: true, colors: 128, quality: 60, effort: 10, dither: 0 })
        .toBuffer()
      writeFileSync(`${OUT}/${t.id}-2016x864.png`, fitted)
      const m = await sharp(fitted).metadata()
      console.log(`OK model=${r.model} fallback=${r.fallbackUsed} -> ${m.width}x${m.height} ${(fitted.length / 1024).toFixed(0)}KB alpha=${m.hasAlpha}`)
    } catch (e: any) {
      console.log(`FAILED: ${(e?.message || String(e)).slice(0, 160)}`)
    }
  }
  console.log(`\n出力先: ${OUT}（採否は目視で判断。public への配置はまだ行わない）`)
}

main().catch((e) => { console.error(e); process.exit(1) })
