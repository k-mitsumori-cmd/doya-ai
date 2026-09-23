// ============================================
// ドヤスライド 1枚を medium で出し、所要時間を実測する
// ============================================
// ⚠️ 従量課金APIを叩く。実行前に見込み額の承認を得ること（~/.claude/CLAUDE.md）。
//    2026-08-27 実行分: 1536x1024 / medium / 1枚 = 約 $0.06 で承認済み。
//    目的は constants.ts の SEC_PER_WAVE（ETA表示用）を high 前提から実測値へ直すこと。
// ⚠️ このスクリプトは直列1枚しか測らない。SEC_PER_WAVE は「並列4本の1波」の秒数なので、
//    ここで出た値をそのまま入れると過小見積りになる（本番は同時4本でAPI側が遅くなる）。
//    正しく合わせるなら --parallel 4 で回すこと（4枚＝約 $0.24。要承認）。
//
//   npx tsx scripts/measure-doyaslide-medium.ts
import fs from 'fs'
import path from 'path'
import { loadEnv } from './_env'
import { generateImageWithFallback } from '../src/lib/image-generator'
import { buildImagePrompt } from '../src/lib/doyaslide/prompts'

loadEnv()

const OUT = path.resolve(__dirname, '../reference/generated-assets/2026-08-27-doyaslide-medium-check')

const pIdx = process.argv.indexOf('--parallel')
const PARALLEL = pIdx > -1 ? Math.max(1, Math.min(4, Number(process.argv[pIdx + 1]) || 1)) : 1

async function main() {
  fs.mkdirSync(OUT, { recursive: true })

  // 本番と同じプロンプト組み立てを通す（文字量の多い本文ページ＝一番重い条件）
  const prompt = buildImagePrompt({
    slide: {
      role: '本文',
      headline: '属人化した見積もりを、3日から30分へ',
      subText: '相場データと過去案件を突き合わせ、根拠つきの金額を自動で出す',
      visualPrompt: '見積書とダッシュボードを並べた図解。左に手作業の煩雑さ、右に自動化後のすっきりした画面。',
    },
    themeColor: '#0066ff',
    stylePreset: 'corporate',
    hasLogo: false,
    logoPosition: 'top-right',
    pageNumber: 3,
    docType: 'sales',
    aspectRatio: 'wide',
  })

  console.log(`gpt-image-2 / 1536x1024 / quality=medium / ${PARALLEL}枚（同時${PARALLEL}本）`)
  const t0 = Date.now()
  // ⚠️ Promise.all にしないこと。1枚でも失敗すると全体が reject し、
  //    すでに課金して取得済みの他の枚数の計測結果まで捨てることになる。
  //    （compare-image-quality.ts でも同じ理由で1枚ずつ捕まえている）
  const settled = await Promise.allSettled(
    Array.from({ length: PARALLEL }, async (_, i) => {
      const s0 = Date.now()
      const r = await generateImageWithFallback({ prompt, size: '1536x1024', quality: 'medium' })
      const sec = Math.round((Date.now() - s0) / 1000)
      const buf = Buffer.from(r.base64, 'base64')
      const file = path.join(OUT, PARALLEL === 1 ? 'slide-medium.png' : `slide-medium-${i + 1}.png`)
      fs.writeFileSync(file, buf)
      console.log(`  ✓ ${i + 1}/${PARALLEL} ${sec}秒 / ${Math.round(buf.length / 1024)}KB / model=${r.model}${r.fallbackUsed ? ' ※フォールバック' : ''}`)
      return { model: r.model, fallbackUsed: r.fallbackUsed, seconds: sec, kb: Math.round(buf.length / 1024), file }
    })
  )
  const results = settled
    .filter((x): x is PromiseFulfilledResult<any> => x.status === 'fulfilled')
    .map((x) => x.value)
  const failures = settled
    .filter((x): x is PromiseRejectedResult => x.status === 'rejected')
    .map((x) => (x.reason instanceof Error ? x.reason.message : String(x.reason)))
  failures.forEach((f, i) => console.log(`  ✗ 失敗 ${i + 1}: ${f.slice(0, 160)}`))

  if (results.length === 0) {
    console.error('\n全枚数が失敗しました。計測値は出せません。')
    process.exit(1)
  }
  // SEC_PER_WAVE に入れるのは個々の秒数ではなく「1波が終わるまで」＝全体の経過時間
  const waveSec = Math.round((Date.now() - t0) / 1000)

  // ⚠️ 1枚でもフォールバックが起きたら、この計測は SEC_PER_WAVE に使えない。
  //    generateImageWithFallback は 4xx/5xx で nano-banana に切り替わるが、
  //    そちらは quality を無視し、タイムアウトも別値(DOYA_FALLBACK_TIMEOUT_MS)。
  //    gpt-image-2 の所要時間として採用すると、本番のETAが実態とずれる。
  const fellBack = results.filter((r) => r.fallbackUsed)
  // ⚠️ 1枚でも欠けたら「1波の所要時間」にならない。SEC_PER_WAVE には使えない
  const usable = fellBack.length === 0 && failures.length === 0

  const info = {
    quality: 'medium',
    size: '1536x1024',
    parallel: PARALLEL,
    waveSeconds: waveSec,
    usableAsSecPerWave: usable,
    fallbackCount: fellBack.length,
    failures,
    results,
  }
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(info, null, 2))

  if (usable) {
    console.log(`\n1波(${PARALLEL}枚)の所要: ${waveSec}秒 → SEC_PER_WAVE の候補値`)
  } else {
    console.log(
      `\n⚠️ 採用不可: フォールバック${fellBack.length}枚 / 失敗${failures.length}枚`
    )
    console.log('   gpt-image-2 の計測になっていないため、SEC_PER_WAVE には使えません。')
    console.log(`   （参考値としての所要: ${waveSec}秒）`)
  }
  console.log(`  → ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
