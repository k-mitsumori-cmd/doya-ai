// ゆるせん App Store 日次レポートのローカル実送信テスト。
// Slack webhook はテスト用に inline 指定（本番は Vercel env で設定）。
import { loadEnv } from './_env'

async function main() {
  loadEnv()
  // Webhook はコマンド実行時の env で渡す（秘密情報をリポジトリに埋めない）:
  //   SLACK_YURUSEN_APPSTORE_WEBHOOK_URL=... npx tsx scripts/test-yurusen-appstore.ts
  if (!process.env.SLACK_YURUSEN_APPSTORE_WEBHOOK_URL) {
    throw new Error('SLACK_YURUSEN_APPSTORE_WEBHOOK_URL を env で指定してください')
  }
  const { sendYurusenAppStoreReport } = await import('../src/lib/yurusen-appstore-report')
  const r = await sendYurusenAppStoreReport()
  console.log('RESULT', JSON.stringify(r))
}

main().catch((e) => {
  console.error('ERR', e?.message || e)
  process.exit(1)
})
