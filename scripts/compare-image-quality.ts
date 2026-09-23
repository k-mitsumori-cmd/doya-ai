// ============================================
// gpt-image-2 の quality=medium / high を1枚ずつ出して比べる
// ============================================
// ⚠️ 従量課金APIを叩く。実行前に見込み額の承認を得ること（~/.claude/CLAUDE.md）。
//    2026-08-27 実行分: 1024x1024 / medium 1枚 + high 1枚 = 約 $0.21 で承認済み。
//
//   npx tsx scripts/compare-image-quality.ts
import fs from 'fs'
import path from 'path'
import { loadEnv } from './_env'
import { generateImageWithFallback } from '../src/lib/image-generator'

loadEnv()

const OUT = path.resolve(__dirname, '../reference/generated-assets/2026-08-27-image-quality-compare')

// 文字の描画品質が quality の差が最も出る部分なので、日本語コピーを焼き込む
const PROMPT = [
  'Japanese web display banner, square 1:1.',
  'Concept: クラウド勤怠管理サービスの広告。朝のオフィス、木目のデスク、',
  'ノートPCに打刻画面。自然光。落ち着いた青と白。',
  '',
  'Render these Japanese phrases exactly once, fully legible, baked into the image:',
  '  見出し: 「勤怠管理を、シンプルに。」',
  '  サブ: 「打刻から集計まで、この一画面で」',
  '  CTA: 「無料ではじめる」',
  '',
  'Typography: Japanese Gothic ExtraBold for the headline, strong size contrast,',
  'real optical spacing. Do not stretch or condense the glyphs.',
  'Avoid: gibberish characters, doubled text, generic AI stock look, neon gradients.',
].join('\n')

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const results: Record<string, unknown>[] = []

  // ⚠️ 1枚ずつ try で囲む。2枚目(high)で失敗したときに、
  //    すでに課金して取得済みの1枚目(medium)の計測結果まで捨てないため。
  const failures: string[] = []
  for (const quality of ['medium', 'high'] as const) {
    const t0 = Date.now()
    console.log(`\n--- quality=${quality} 生成中 ---`)
    try {
      const r = await generateImageWithFallback({
        prompt: PROMPT,
        size: '1024x1024',
        quality,
      })
      const elapsed = Math.round((Date.now() - t0) / 1000)
      const file = path.join(OUT, `${quality}.png`)
      const buf = Buffer.from(r.base64, 'base64')
      fs.writeFileSync(file, buf)

      const info = {
        quality,
        model: r.model,
        fallbackUsed: r.fallbackUsed,
        seconds: elapsed,
        bytes: buf.length,
        file,
      }
      results.push(info)
      console.log(`  model=${r.model} fallback=${r.fallbackUsed} ${elapsed}秒 ${(buf.length / 1024).toFixed(0)}KB`)
      // ⚠️ フォールバックが起きた回は gpt-image-2 の計測ではない。
      //    nano-banana は quality を無視し、タイムアウトも別値なので、
      //    この秒数を quality の比較に使ってはいけない。
      if (r.fallbackUsed) {
        console.log('  ⚠️ フォールバックが発生したため、この回は quality の比較に使えません')
      }
      if (r.primaryError) console.log(`  ⚠️ primaryError: ${String(r.primaryError).slice(0, 200)}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      failures.push(`${quality}: ${msg}`)
      console.log(`  ✗ ${quality} 失敗: ${msg.slice(0, 160)}`)
    }
  }

  if (failures.length) {
    console.log('\n失敗:', failures.join(' / '))
  }

  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ results, failures }, null, 2))
  console.log('\n出力先:', OUT)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
