// 常時確認（system-watch）を手元から本番に向けて「試しに」回す。状態を書かず、Slack にも送らない。
// 使い方: AIO_ENV_FILE=/path/to/.env.local npx tsx scripts/system-watch-dry.ts
// 注意: 手元の .env.local のキーが本番と違うと、外部サービスの確認が手元だけ失敗することがある。
// ⚠️ 本番 DB を読む（読むだけ）。2026-10-26 にユーザーが許可した（Obsidian のドヤAI_03）。作成・変更・削除はしない。
import { loadEnv } from './_env'
loadEnv()

async function main() {
  const { freeChecks } = await import('../src/lib/system-watch/checks')
  const { runWatch } = await import('../src/lib/system-watch/run')
  const { prisma } = await import('../src/lib/prisma')
  const report = await runWatch('free', freeChecks(), { dry: true })
  for (const r of report.results) console.log(`${r.ok ? 'OK' : 'NG'}\t${r.ms}ms\t${r.area}\t${r.label}\t${r.ok ? r.detail ?? '' : `${r.status ?? ''} ${r.error ?? ''}`}`)
  console.log(`\n${report.total}件中 失敗 ${report.failed.length}件`)
  await prisma.$disconnect()
}
main()
