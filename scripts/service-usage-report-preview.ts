// 日次/週次/月次レポートの「サービス利用」「初回利用」セクションを
// Slackに送らずにコンソールへ出して確認する。
// 実行: npx tsx scripts/service-usage-report-preview.ts [日数]
//
// レポート本体と同じ関数を呼ぶので、本番データに対して集計クエリが
// 通ることの検証も兼ねる。読み取りのみ。
import { loadEnv } from './_env'

async function main() {
  loadEnv()
  const days = Number(process.argv[2] || 30)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const { prisma } = await import('../src/lib/prisma')
  const { getServiceUsageStats, formatServiceUsageLines, formatFirstUseLines } =
    await import('../src/lib/notifications')

  const stats = await getServiceUsageStats(since)
  const total = stats.reduce((sum, s) => sum + s.count, 0)

  console.log(`\n*⚡ サービス利用（過去${days}日）*`)
  console.log(`- 合計: ${total}件 / ${stats.length}サービス`)
  console.log(formatServiceUsageLines(stats).join('\n'))

  console.log(`\n*🌱 初回利用（そのサービスを初めて使った人）*`)
  console.log((await formatFirstUseLines(since)).join('\n'))

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
