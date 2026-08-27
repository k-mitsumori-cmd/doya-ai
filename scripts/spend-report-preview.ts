/**
 * 消費レポートを**送らずに**組み立てて見る。
 *
 *   npx tsx scripts/spend-report-preview.ts          # 見るだけ
 *   npx tsx scripts/spend-report-preview.ts --send   # Slack へ送る
 *
 * 予算の判断材料なので、**鍵が無いところが「取得できず」と正直に出るか**、
 * 0円と取り違えていないかを、送る前にここで確かめる。
 * テーブル名を決め打ちして両方 404 になり「取得できず」とだけ出ていたことが
 * あるので、数字が 0 のときは**本当に 0 なのか**を疑うこと。
 */
import { loadEnv } from './_env'
loadEnv()

async function main() {
  const { buildSpendReport, formatSpendReport, sendSpendReport } = await import('../src/lib/spend-report')

  if (process.argv.includes('--send')) {
    await sendSpendReport()
    console.log('Slack へ送りました')
    process.exit(0)
  }

  const report = await buildSpendReport()
  console.log(formatSpendReport(report))
  console.log('\n--- 取得できなかったもの ---')
  const missing = [...report.costs, ...report.monthCosts].filter((c) => !c.money)
  if (missing.length === 0 && report.errors.length === 0) {
    console.log('  なし')
  } else {
    for (const c of missing) console.log(`  ${c.label}: ${c.note ?? '理由不明'}`)
    for (const e of report.errors) console.log(`  ${e}`)
  }
  process.exit(0)
}
main()
