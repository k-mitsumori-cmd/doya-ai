// ============================================
// 広告画像AI: 参照画像を渡すと見た目が寄るかを確かめる
// ============================================
// ⚠️ 従量課金APIを叩く。実行前に見込み額の承認を得ること（~/.claude/CLAUDE.md）。
//    2026-09-02 実行分: ストーリーズ相当 / medium / 2枚 = 約 $0.12 で承認済み。
//
//   npx tsx scripts/check-adimage-refimage.ts
//
// 同じテンプレート・同じコピーで
//   A) 作風の文章だけ渡す（従来）
//   B) 参照画像も渡す（今回の実装）
// を出力し、選んだテンプレートと並べて見比べる。
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { loadEnv } from './_env'
import { buildImagePrompt } from '../src/lib/adimage/prompt'
import { findPlacement } from '../src/lib/adimage/placements'
import { generateImageWithFallback } from '../src/lib/image-generator'

loadEnv()

const OUT = path.resolve(__dirname, '../reference/generated-assets/2026-09-02-adimage-refimage')
const TEMPLATE_URL =
  'https://chiuvaoxgbtppyfccuvi.supabase.co/storage/v1/object/public/banner-templates/legacy-2026-08-24/new-copywriter-001.webp'

// 実際に使われていたブランド・コピー（DBの最新コンセプトから）
const brand = {
  name: 'キャリーミー',
  industry: '人材紹介・マッチングサービス',
  colors: ['#0066ff'],
  description:
    'ビジネス界におけるプロ契約のマッチングサービス。週1からの案件やCXO案件まで幅広く対応。',
} as any

const copy = {
  headline: '週1から月50万円',
  sub: 'あなたのスキルが報酬に変わる',
  cta: '登録する',
} as any

/** テンプレートから抽出済みの作風（本番と同じ文言） */
const STYLE =
  '作風: 柔らかなグレーを基調とした落ち着いた色調に赤のアクセントを効かせ、手描き風の太い文字と整然とした縦組みテキストを組み合わせた構成で、自然光による温かみのある質感と余白を活かしたドキュメンタリー的な雰囲気を表現したスタイル。'

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const placement = findPlacement('meta.story')
  if (!placement) throw new Error('placement が見つかりません')

  // 参照画像を取得して縮小（本番と同じ処理）
  const res = await fetch(TEMPLATE_URL)
  if (!res.ok) throw new Error(`参照画像が取れません: ${res.status}`)
  const refBuf = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(path.join(OUT, 'template.png'), await sharp(refBuf).png().toBuffer())
  const small = await sharp(refBuf)
    .resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer()
  const refImage = { mimeType: 'image/png', base64: small.toString('base64') }

  const cases: Array<{ id: string; label: string; withImage: boolean }> = [
    { id: 'D-composition', label: 'D 構図も指定（今回）', withImage: false },
  ]

  for (const c of cases) {
    const prompt = buildImagePrompt({
      brand,
      copy,
      tone: '洗練されたシルバー×深紺、上質感',
      placement,
      composition: 'photo-overlay' as any,
      designRefPrompt: STYLE,
      hasRefImage: c.withImage,
    })
    fs.writeFileSync(path.join(OUT, `${c.id}.prompt.txt`), prompt)

    const t0 = Date.now()
    try {
      const r = await generateImageWithFallback({
        prompt,
        size: `${placement.genW}x${placement.genH}` as any,
        quality: 'medium',
        ...(c.withImage ? { inputImages: [refImage], aspectRatio: 'portrait (vertical)' } : {}),
      })
      const sec = Math.round((Date.now() - t0) / 1000)
      const raw = Buffer.from(r.base64, 'base64')
      const meta = await sharp(raw).metadata()
      // 本番と同じ後処理（比率が違えば contain で収める）
      const srcRatio = (meta.width || 1) / (meta.height || 1)
      const dstRatio = placement.genW / placement.genH
      const diff = Math.abs(srcRatio - dstRatio) / dstRatio
      let out: Buffer
      if (diff < 0.05) {
        out = await sharp(raw).resize(placement.genW, placement.genH, { fit: 'fill' }).png().toBuffer()
      } else {
        let bg = { r: 255, g: 255, b: 255, alpha: 1 }
        try {
          const { dominant } = await sharp(raw).stats()
          if (dominant) bg = { r: dominant.r, g: dominant.g, b: dominant.b, alpha: 1 }
        } catch {
          /* 白のまま */
        }
        out = await sharp(raw)
          .resize(placement.genW, placement.genH, { fit: 'contain', background: bg })
          .png()
          .toBuffer()
      }
      fs.writeFileSync(path.join(OUT, `${c.id}.png`), out)
      console.log(
        `  ✓ ${c.label} — ${sec}秒 / 戻り ${meta.width}x${meta.height} → ${placement.genW}x${placement.genH}` +
          ` / 比率差 ${(diff * 100).toFixed(1)}% / ${r.model}${r.fallbackUsed ? ' ※フォールバック' : ''}`
      )
    } catch (e) {
      console.log(`  ✗ ${c.label} 失敗: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200))
    }
  }
  console.log('\n出力先:', OUT)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
