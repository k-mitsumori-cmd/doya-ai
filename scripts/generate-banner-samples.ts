// ============================================
// gpt-image-2 でバナー10パターンを出す（品質確認用）
// ============================================
// ⚠️ 従量課金APIを叩く。実行前に見込み額の承認を得ること（~/.claude/CLAUDE.md）。
//    2026-08-27 実行分: 1024x1024 / medium / 10枚 = 約 $0.40 で承認済み。
//
//   npx tsx scripts/generate-banner-samples.ts
//   npx tsx scripts/generate-banner-samples.ts --quality high   # 単価4.3倍・時間2.4倍
import fs from 'fs'
import path from 'path'
import { loadEnv } from './_env'
import { generateImageWithFallback } from '../src/lib/image-generator'

loadEnv()

const qIdx = process.argv.indexOf('--quality')
const RAW_QUALITY = qIdx > -1 ? process.argv[qIdx + 1] : 'medium'
// 課金APIに入る前に弾く。未指定(--quality が最後)や打ち間違いのまま10枚回すと丸ごと無駄になる
if (!['low', 'medium', 'high'].includes(RAW_QUALITY || '')) {
  console.error(`--quality は low / medium / high のいずれか（受け取った値: ${RAW_QUALITY ?? '(未指定)'}）`)
  process.exit(1)
}
const QUALITY = RAW_QUALITY as 'low' | 'medium' | 'high'
const SIZE = '1024x1024'
const OUT = path.resolve(__dirname, `../reference/generated-assets/2026-08-27-banner-samples-${QUALITY}`)
// Storage への往復を避け、手元で見比べるだけの用途なので並列は控えめに
const CONCURRENCY = 3

type Sample = { id: string; genre: string; concept: string; headline: string; sub: string; cta: string }

const SAMPLES: Sample[] = [
  { id: '01-food', genre: '飲食', concept: '夕方の居酒屋カウンター、湯気の立つ串焼きと生ビール、暖色の照明', headline: '一日の終わりに、この一杯。', sub: '17時から19時はハッピーアワー', cta: '席を予約する' },
  { id: '02-beauty', genre: '美容', concept: '朝の斜光、乳白ガラスの美容液ボトル、石の台座、余白の多い構図', headline: '肌に、静かな光を。', sub: '発酵由来の濃密美容液', cta: '詳しく見る' },
  { id: '03-ec-sale', genre: 'ECセール', concept: '大胆な赤と黄、商品を敷き詰めたにぎやかなレイアウト、価格訴求', headline: '今だけ、全品半額。', sub: '8月31日まで・送料無料', cta: 'セール会場へ' },
  { id: '04-saas', genre: 'SaaS', concept: '明るいオフィスのデスク、ノートPCにダッシュボード画面、青と白', headline: '請求書、もう迷わない。', sub: '月末業務を80%短縮', cta: '無料ではじめる' },
  { id: '05-recruit', genre: '採用', concept: '若手社員が作業台で手を動かしている様子、ピンクの帯、ドキュメンタリー調', headline: '私たちと、未来をつくる。', sub: '新卒エンジニア採用', cta: 'エントリーする' },
  { id: '06-medical', genre: '医療', concept: '明るい内科の診察室、医師と患者が向き合う、清潔で落ち着いた配色', headline: '土曜も、診療しています。', sub: '駅から徒歩3分の内科', cta: '診療時間を見る' },
  { id: '07-realestate', genre: '不動産', concept: '陽の入るリビング、木の床とグリーン、広角、生活感のある小物', headline: 'この街で、暮らしを始める。', sub: '駅徒歩5分・2LDK', cta: '内見を申し込む' },
  { id: '08-education', genre: '教育', concept: 'フラットな図解、矢印とステップ、黄色と紺、人物は最小限', headline: '3ヶ月で、実務レベルへ。', sub: '現役エンジニアが伴走', cta: '無料相談を予約' },
  { id: '09-travel', genre: '旅行', concept: '夏の離島、透明な海と白い砂浜、青空、開放感のある引きの構図', headline: '夏は、遠くへ行こう。', sub: '往復航空券つき2泊3日', cta: 'プランを見る' },
  { id: '10-finance', genre: '金融', concept: '落ち着いた木のテーブル、家計簿とスマートフォン、朝の柔らかい光', headline: '家計を、ひとつに。', sub: '無料の資産管理サービス', cta: 'はじめてみる' },
]

function buildPrompt(s: Sample): string {
  return [
    'Japanese web display banner, square 1:1.',
    `Genre: ${s.genre}.`,
    `Concept: ${s.concept}`,
    '',
    'Render these Japanese phrases exactly once each, fully legible, baked into the image:',
    `  見出し: 「${s.headline}」`,
    `  サブ: 「${s.sub}」`,
    `  CTA: 「${s.cta}」`,
    '',
    'Typography: Japanese Gothic ExtraBold for the headline with strong size contrast,',
    'real optical spacing. Do not stretch or condense the glyphs. Keep all text',
    'inside a safe area at least 6% from every edge.',
    'Style: independent Japanese editorial advertising; deliberate asymmetry, generous white space.',
    'Avoid: gibberish or doubled characters, porcelain stock-model faces, neon gradient blobs,',
    'glossy 3D icons, fake logos, generic AI advertising look.',
  ].join('\n')
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  console.log(`gpt-image-2 / ${SIZE} / quality=${QUALITY} / ${SAMPLES.length}枚`)

  const queue = [...SAMPLES]
  const done: Record<string, unknown>[] = []
  const failures: string[] = []

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    for (;;) {
      const s = queue.shift()
      if (!s) return
      const t0 = Date.now()
      try {
        const r = await generateImageWithFallback({ prompt: buildPrompt(s), size: SIZE, quality: QUALITY })
        const buf = Buffer.from(r.base64, 'base64')
        fs.writeFileSync(path.join(OUT, `${s.id}.png`), buf)
        const sec = Math.round((Date.now() - t0) / 1000)
        done.push({ id: s.id, genre: s.genre, model: r.model, fallbackUsed: r.fallbackUsed, seconds: sec, kb: Math.round(buf.length / 1024) })
        console.log(`  ✓ ${s.id} (${s.genre}) ${sec}秒 model=${r.model}${r.fallbackUsed ? ' ※フォールバック' : ''}`)
      } catch (e: any) {
        failures.push(`${s.id}: ${e?.message || e}`)
        console.log(`  ✗ ${s.id} ${String(e?.message || e).slice(0, 120)}`)
      }
    }
  })
  await Promise.all(workers)

  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ quality: QUALITY, size: SIZE, done, failures }, null, 2))
  console.log(`\n完了 ${done.length}/${SAMPLES.length}枚` + (failures.length ? ` / 失敗 ${failures.length}件` : ''))
  failures.forEach((f) => console.log('  ' + f))
  console.log('出力先:', OUT)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
