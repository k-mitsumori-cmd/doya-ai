// ドヤAIO 実スキャン検証スクリプト（DB/認証を介さず executeScan を直接実行）
// 実行: npx tsx scripts/aio-scan-test.ts
// .env.local を import より先に読み込む（動的importで env を確実に効かせる）
import { loadEnv } from './_env'

async function main() {
  loadEnv()
  const { executeScan } = await import('../src/lib/aio/scan')
  const { availableEngines } = await import('../src/lib/aio/types')

  const brand = {
    brandName: 'ドヤマーケ',
    brandUrl: 'https://doya-ai.surisuta.jp',
    aliases: ['ドヤマーケAI', 'DoyaMarke'],
    competitors: ['競合サービスA', '競合サービスB', '競合サービスC'],
    category: 'マーケティングAI SaaS',
  }
  const prompts = [
    { id: 'p1', text: 'マーケティングを効率化できるおすすめAIサービスは？' },
    { id: 'p2', text: 'SEO記事やバナーをAIで作れるサービスは？' },
    { id: 'p3', text: '中小企業向けのマーケティングAIツールでおすすめは？' },
    { id: 'p4', text: 'AIでSNS運用を自動化できるサービスは？' },
    { id: 'p5', text: 'コンテンツ制作を一括でこなせるAI SaaSは？' },
    { id: 'p6', text: '信頼できるマーケティングAIサービスはどれ？' },
  ]
  const engines = availableEngines()
  const repetitions = Number(process.env.AIO_REPS || 5)

  console.log('エンジン:', engines.join(', '))
  console.log(`ラン数見込み: ${prompts.length} prompts × ${engines.length} engines × ${repetitions} = ${prompts.length * engines.length * repetitions}`)
  console.log('スキャン中… (数分かかります)\n')

  const t0 = Date.now()
  const out = await executeScan(brand, prompts, engines, repetitions)
  const sec = Math.round((Date.now() - t0) / 1000)
  const s = out.summary

  console.log('========== 結果 ==========')
  console.log(`所要: ${sec}秒 / 総ラン ${s.totalRuns}`)
  console.log(`\n■ ブランド認知度（言及率）: ${s.awarenessPct}%  (${s.brandRuns}/${s.totalRuns})`)
  console.log('  エンジン別:', s.perEngine.map((e) => `${e.engine} ${e.awarenessPct}%`).join(' / '))
  console.log(`\n■ Share of Voice: 自社 ${s.shareOfVoice}%`)
  s.sov.slice(0, 10).forEach((v, i) => console.log(`  ${i + 1}. ${v.brand}${v.isOwn ? ' ★自社' : ''}  ${v.pct}% (${v.mentions})`))
  console.log(`\n■ 感情: ポジ ${s.sentiment.positive}% / ニュートラル ${s.sentiment.neutral}% / ネガ ${s.sentiment.negative}%`)
  console.log(`\n■ 自社ドメイン引用率: ${s.ownCitationPct}%`)
  console.log('■ 上位引用ドメイン:')
  s.citations.slice(0, 10).forEach((c) => console.log(`  ${c.domain}${c.isOwn ? ' ★自社' : ''}  ${c.count} [${c.channel}]`))
  console.log('\n■ プロンプト別 言及頻度:')
  s.promptBreakdown.forEach((p) => {
    console.log(`  「${p.text}」`)
    console.log('    ' + p.perEngine.map((e) => `${e.engine} ${e.mentioned}/${e.total}`).join(' / '))
  })
  console.log('\n■ 改善アクション:')
  out.recommendations.forEach((r, i) => console.log(`  ${i + 1}. [${r.priority}] ${r.title}\n     ${r.detail}`))
  console.log('\n==========================')
}

main().catch((e) => { console.error('FAILED:', e?.message || e); process.exit(1) })
