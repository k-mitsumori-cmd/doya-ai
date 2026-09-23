// ============================================
// 広告画像AI: 選んだ作風が実際に効いているかを確かめる
// ============================================
// ⚠️ 従量課金APIを叩く。実行前に見込み額の承認を得ること（~/.claude/CLAUDE.md）。
//    2026-09-01 実行分: 1152x2048 / medium / 4枚 = 約 $0.24 で承認済み。
//
//   npx tsx scripts/check-adimage-style.ts
//
// 同じコピー・同じサイズで、参考にする作風だけを変えて出力し、
// 作風が絵に反映されるかを見比べる。
import fs from 'fs'
import path from 'path'
import { loadEnv } from './_env'
import { buildImagePrompt } from '../src/lib/adimage/prompt'
import { findPlacement } from '../src/lib/adimage/placements'
import { generateImageWithFallback } from '../src/lib/image-generator'

loadEnv()

const OUT = path.resolve(__dirname, '../reference/generated-assets/2026-09-01-adimage-style-check')

const brand = {
  name: '株式会社スリスタ',
  industry: 'AI SaaS',
  colors: ['#0066ff', '#ff1e72'],
  description: 'URLを貼るだけで媒体別サイズの広告画像が揃うAIサービス',
} as any

const copy = {
  headline: '広告画像を、10分で。',
  sub: 'URLを貼るだけで媒体別サイズが揃う',
  cta: '無料ではじめる',
} as any

/** 作風の指定。null は「作風を選ばなかった場合」 */
const CASES: Array<{ id: string; label: string; style: string | null }> = [
  { id: '0-none', label: '作風なし（従来）', style: null },
  {
    id: '1-editorial',
    label: '構造化: 雑誌風エディトリアル',
    style:
      '作風: independent Japanese magazine editorial; tactile paper, real print grain, asymmetrical hierarchy\n避けること: generic AI advertising look; porcelain stock-model face; rounded CTA pill; neon gradient blob; glossy 3D icon',
  },
  {
    id: '2-minimal',
    label: '平文由来: 明るくミニマル',
    style:
      '作風: 明るい色調で余白を大きく取り、黄色と黒のコントラストが効いた太字見出しを1点だけ置く。装飾を削ぎ落としたミニマルで清潔感のある構成。',
  },
  {
    id: '3-darktech',
    label: '平文由来: 暗い青のテック調',
    style:
      '作風: 暗い青系のグラデーションを背景に、白い文字を中央に置き、緑のアクセントで一点だけ強調する。余白を効かせたモダンで落ち着いたテック調。',
  },
]

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const placement = findPlacement('meta.story')
  if (!placement) throw new Error('placement が見つかりません')

  const results: Record<string, unknown>[] = []
  for (const c of CASES) {
    const prompt = buildImagePrompt({
      brand,
      copy,
      tone: '信頼感のある明るいトーン',
      placement,
      composition: 'hero-center' as any,
      designRefPrompt: c.style || undefined,
    })
    fs.writeFileSync(path.join(OUT, `${c.id}.prompt.txt`), prompt)

    const t0 = Date.now()
    try {
      const r = await generateImageWithFallback({
        prompt,
        size: `${placement.genW}x${placement.genH}` as any,
        quality: 'medium',
      })
      const sec = Math.round((Date.now() - t0) / 1000)
      const buf = Buffer.from(r.base64, 'base64')
      fs.writeFileSync(path.join(OUT, `${c.id}.png`), buf)
      console.log(`  ✓ ${c.id} ${c.label} — ${sec}秒 / ${Math.round(buf.length / 1024)}KB / ${r.model}${r.fallbackUsed ? ' ※フォールバック' : ''}`)
      results.push({ id: c.id, label: c.label, seconds: sec, model: r.model, fallbackUsed: r.fallbackUsed })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.log(`  ✗ ${c.id} 失敗: ${msg.slice(0, 160)}`)
      results.push({ id: c.id, label: c.label, error: msg })
    }
  }

  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(results, null, 2))
  console.log('\n出力先:', OUT)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
