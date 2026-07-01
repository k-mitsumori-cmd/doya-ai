// ドリップ配信レポートの動作確認用スクリプト
//   実行: npx tsx scripts/test-drip-report.ts [morning|evening]
// 実DBに接続して集計し、SLACK_DRIP_WEBHOOK_URL 宛にテスト投稿する。
import { loadEnv } from './_env'
loadEnv()

async function main() {
  const slot = (process.argv[2] === 'evening' ? 'evening' : 'morning') as 'morning' | 'evening'
  const { sendDripReport } = await import('../src/lib/notifications')
  console.log(`[test] sending drip report (slot=${slot}) ...`)
  await sendDripReport(slot)
  console.log('[test] done ✅ Slackを確認してください')
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('[test] error:', e)
  process.exit(1)
})
