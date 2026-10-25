// 本番 DB を「読むだけ」で点検する手動スクリプト（作成・更新・削除・送信はしない）。
// 使い方: AIO_ENV_FILE=/path/to/.env.local npx tsx scripts/health-check-readonly.ts
// 出力: 項目ごとに OK / NG / 確認不可 と根拠を JSON で出す。秘密の値（Webhook URL 等）は出さない。
import { loadEnv } from './_env'
loadEnv()
import { PrismaClient } from '@prisma/client'

type Item = { item: string; result: 'OK' | 'NG' | '確認不可'; evidence: unknown }
const prisma = new PrismaClient()
const items: Item[] = []
const HOUR = 3_600_000

async function check(item: string, fn: () => Promise<Omit<Item, 'item'>>) {
  try {
    items.push({ item, ...(await fn()) })
  } catch (e) {
    items.push({ item, result: '確認不可', evidence: e instanceof Error ? e.message.slice(0, 300) : String(e) })
  }
}

async function main() {
  await check('DB の接続', async () => {
    const t = Date.now()
    await prisma.$queryRaw`SELECT 1`
    return { result: 'OK', evidence: { 往復ms: Date.now() - t } }
  })

  await check('Stripe Webhook の処理（直近7日）', async () => {
    const since = new Date(Date.now() - 7 * 24 * HOUR)
    const byStatus = await prisma.stripeWebhookEvent.groupBy({ by: ['status'], where: { lastReceivedAt: { gte: since } }, _count: true })
    const failed = await prisma.stripeWebhookEvent.findMany({ where: { status: 'failed', lastReceivedAt: { gte: since } }, select: { id: true, type: true, attempts: true, lastReceivedAt: true }, take: 20 })
    const stuck = await prisma.stripeWebhookEvent.findMany({ where: { status: 'processing', lastReceivedAt: { lt: new Date(Date.now() - HOUR) } }, select: { id: true, type: true, lastReceivedAt: true }, take: 20 })
    const last = await prisma.stripeWebhookEvent.findFirst({ orderBy: { lastReceivedAt: 'desc' }, select: { type: true, status: true, lastReceivedAt: true } })
    return { result: failed.length || stuck.length ? 'NG' : 'OK', evidence: { 状態別: byStatus.map(r => ({ status: r.status, 件数: r._count })), 失敗: failed, '処理中のまま1時間超': stuck, 最後の受信: last } }
  })

  await check('Stripe Webhook の運営通知の再送待ち', async () => {
    const pending = await prisma.stripeWebhookNotification.findMany({ where: { status: { in: ['pending', 'sending'] }, createdAt: { lt: new Date(Date.now() - HOUR) } }, select: { eventId: true, eventType: true, status: true, attempts: true, createdAt: true }, take: 20 })
    return { result: pending.length ? 'NG' : 'OK', evidence: { '1時間以上送れていない通知': pending } }
  })

  await check('ドヤパワーの台帳（残高の写しと付与の残りの合計）', async () => {
    const now = new Date()
    const accounts = await prisma.doyaPowerAccount.findMany({ select: { id: true, balance: true, grants: { select: { remaining: true, expiresAt: true } } } })
    const mismatch = accounts
      .map(a => ({ accountId: a.id, 写し: a.balance, 付与の残り合計: a.grants.filter(g => !g.expiresAt || g.expiresAt > now).reduce((s, g) => s + g.remaining, 0) }))
      .filter(a => a.写し !== a.付与の残り合計)
    const negative = await prisma.doyaPowerGrant.count({ where: { remaining: { lt: 0 } } })
    const overGranted = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM doya_power_grants WHERE remaining > amount`
    const tx7 = await prisma.doyaPowerTransaction.groupBy({ by: ['type'], where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * HOUR) } }, _count: true })
    const bad = mismatch.length > 0 || negative > 0 || Number(overGranted[0]?.n ?? 0) > 0
    return { result: bad ? 'NG' : 'OK', evidence: { 口座数: accounts.length, 写しが合わない口座: mismatch.slice(0, 20), 残りが負の付与: negative, 残りが付与量を超える付与: Number(overGranted[0]?.n ?? 0), '直近7日の増減': tx7.map(r => ({ type: r.type, 件数: r._count })) } }
  })

  await check('Slack 通知の送り先の設定（値は出さない）', async () => {
    const row = await prisma.systemSetting.findUnique({ where: { key: 'slack_webhook' }, select: { value: true } })
    const has = !!row?.value
    return { result: has ? 'OK' : 'NG', evidence: { SystemSetting_slack_webhook: has ? '設定あり' : '未設定', 形式: has ? (row!.value.startsWith('https://hooks.slack.com/') ? 'Slack Incoming Webhook の形' : '想定外の形') : null } }
  })

  await check('運用 cron の最後の完了（ops:v1:done:*）', async () => {
    const rows = await prisma.systemSetting.findMany({ where: { key: { startsWith: 'ops:v1:done:' } }, select: { key: true, value: true } })
    const latest: Record<string, string> = {}
    for (const r of rows) {
      const mode = r.key.replace('ops:v1:done:', '').replace(/^job:/, '').split(':')[0]
      try {
        const at = JSON.parse(r.value).at as string
        if (at && (!latest[mode] || at > latest[mode])) latest[mode] = at
      } catch { /* 壊れた値は数えない */ }
    }
    const expectHours: Record<string, number> = { watch: 1, reviews: 6, daily: 26, cost: 26, travel: 26, weekly: 8 * 24 }
    const late = Object.entries(expectHours).filter(([m, h]) => !latest[m] || Date.now() - Date.parse(latest[m]) > h * HOUR).map(([m]) => m)
    return { result: late.length ? 'NG' : 'OK', evidence: { 最後の完了: latest, 予定より遅れている: late } }
  })

  await check('運用 cron のロックの取り残し', async () => {
    const locks = await prisma.systemSetting.findMany({ where: { key: { startsWith: 'ops:v1:lock:' } }, select: { key: true, value: true } })
    const stale = locks.filter(l => Number(l.value) < Date.now()).map(l => ({ key: l.key, 期限: new Date(Number(l.value)).toISOString() }))
    return { result: stale.length ? 'NG' : 'OK', evidence: { ロック数: locks.length, 期限切れのまま残っている: stale } }
  })

  await check('外形監視の状態（ops:v1:health:*）', async () => {
    const rows = await prisma.systemSetting.findMany({ where: { key: { startsWith: 'ops:v1:health:' } }, select: { key: true, value: true } })
    const states = rows.map(r => ({ key: r.key.replace('ops:v1:health:', ''), ...JSON.parse(r.value) }))
    return { result: states.some(s => !s.ok) ? 'NG' : 'OK', evidence: states }
  })

  await check('日報の送信の受信記録（ops:v1:receipt:*）', async () => {
    const rows = await prisma.systemSetting.findMany({ where: { key: { startsWith: 'ops:v1:receipt:' } }, select: { key: true, value: true } })
    const today = new Date(Date.now() + 9 * HOUR).toISOString().slice(0, 10)
    const states = rows.map(r => ({ report: r.key.replace('ops:v1:receipt:', ''), ...JSON.parse(r.value) }))
    const armed = await prisma.systemSetting.findUnique({ where: { key: 'ops:v1:watch-enabled' }, select: { value: true } })
    return { result: states.some(s => s.day !== today) ? 'NG' : 'OK', evidence: { 今日: today, 見張りの有効化: armed?.value ?? null, 記録: states } }
  })

  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), items }, null, 2))
}

main().finally(() => prisma.$disconnect())
