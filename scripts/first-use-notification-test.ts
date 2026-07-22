// 初回利用のSlack通知（Block Kit）の表示確認スクリプト
// 実行: npx tsx scripts/first-use-notification-test.ts [serviceId]
//
// 実際の notifyFirstServiceUse() をそのまま呼ぶため、本番のSlackチャンネルに
// 1通投稿される。実イベントと紛らわしくないよう「送信テスト」と明示して送る。
// DBへの書き込みは行わない（この関数は読み取り＋投稿のみ）。
import { loadEnv } from './_env'

async function main() {
  loadEnv()
  const serviceId = process.argv[2] || 'seo'

  const { prisma } = await import('../src/lib/prisma')
  const { notifyFirstServiceUse } = await import('../src/lib/service-usage')

  // 直近に作られたユーザーを1人選んで、実データの見え方を確認する
  const user = await prisma.user.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, email: true },
  })
  if (!user) {
    console.error('ユーザーが1人もいません')
    process.exit(1)
  }

  console.log(`送信: serviceId=${serviceId} user=${user.name || user.email}`)
  await notifyFirstServiceUse({
    userId: user.id,
    serviceId,
    action: '送信テスト（実際の利用ではありません）',
    summary: 'Block Kit の表示確認',
  })
  console.log('送信しました。Slackの表示を確認してください。')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
