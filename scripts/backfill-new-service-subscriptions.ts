/** 新サービス公開時の既存有料ユーザー補完。既定は読み取りのみ。通知・Stripe変更なし。 */
import { Prisma, PrismaClient } from '@prisma/client'
import { loadEnv } from './_env'

async function main() {
  const args = process.argv.slice(2)
  if (args.some(arg => !/^--service=[a-z][a-z0-9-]*$/.test(arg) && arg !== '--apply' && !/^--expected-missing=\d+$/.test(arg))) throw new Error('Invalid arguments')
  if (new Set(args.map(arg => arg.split('=')[0])).size !== args.length) throw new Error('Duplicate arguments')
  const serviceId = args.find(arg => arg.startsWith('--service='))?.slice(10)
  const apply = args.includes('--apply')
  const expectedRaw = args.find(arg => arg.startsWith('--expected-missing='))?.slice(19)
  const expected = expectedRaw === undefined ? undefined : Number(expectedRaw)
  if (!serviceId || (expected !== undefined && (!Number.isSafeInteger(expected) || expected < 0 || expected > 1000)) || (apply && expected === undefined)) throw new Error('Use --service=<id>; --apply also requires --expected-missing=<reviewed count>')
  if (!process.env.DATABASE_URL) loadEnv()
  const { ALL_SERVICE_IDS } = await import('../src/lib/stripe')
  // --service=all は読み取りだけ。全サービスの不足の数を出し、書き込みは1サービスずつ --apply で行う
  if (serviceId === 'all' && apply) throw new Error('--service=all is read-only; apply one service at a time')
  if (serviceId !== 'all' && !(ALL_SERVICE_IDS as readonly string[]).includes(serviceId)) throw new Error('Unknown billing service')
  const url = new URL(process.env.DATABASE_URL || '')
  url.searchParams.set('connection_limit', '1')
  url.searchParams.set('pgbouncer', 'true')
  url.searchParams.set('connect_timeout', '30')
  const db = new PrismaClient({ log: [], datasources: { db: { url: url.toString() } } })
  if (serviceId === 'all') {
    try {
      const missingByService: Record<string, number> = {}
      for (const id of ALL_SERVICE_IDS) {
        const count = await db.user.count({ where: { plan: { in: ['LIGHT', 'PRO', 'BUNDLE', 'ENTERPRISE'] }, serviceSubscriptions: { none: { serviceId: id } } } })
        if (count > 0) missingByService[id] = count
      }
      console.log(JSON.stringify({ checkedAt: new Date().toISOString(), mode: 'read-only', serviceId: 'all', missingByService,
        next: 'Run --service=<id> (read-only) and then --service=<id> --apply --expected-missing=<count> for each service above.' }))
    } finally { await db.$disconnect() }
    return
  }
  const where = { plan: { in: ['LIGHT', 'PRO', 'BUNDLE', 'ENTERPRISE'] }, serviceSubscriptions: { none: { serviceId } } }
  const select = { id: true, plan: true, stripeSubscriptionId: true, stripePriceId: true, stripeCurrentPeriodEnd: true } as const
  try {
    // An explicit ceiling prevents an unexpectedly broad operation from becoming an unattended bulk write.
    const review = await db.user.findMany({ where, select, orderBy: { id: 'asc' }, take: 1001 })
    if (review.length > 1000 || (expected !== undefined && review.length !== expected)) throw new Error('Missing count differs from reviewed scope')
    let createdCount = 0
    if (apply && review.length) {
      createdCount = await db.$transaction(async tx => {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id" IN (${Prisma.join(review.map(u => u.id))}) ORDER BY "id" FOR UPDATE`)
        const current = await tx.user.findMany({ where, select, orderBy: { id: 'asc' }, take: 1001 })
        if (current.length !== expected || current.some((u, index) => u.id !== review[index]?.id || u.plan !== review[index]?.plan)) throw new Error('Paid scope changed; review again')
        const created = await tx.userServiceSubscription.createMany({ data: current.map(user => ({
          userId: user.id, serviceId, plan: user.plan === 'BUNDLE' ? 'PRO' : user.plan,
          stripeSubscriptionId: user.stripeSubscriptionId, stripePriceId: user.stripePriceId,
          stripeCurrentPeriodEnd: user.stripeCurrentPeriodEnd,
        })) })
        if (created.count !== current.length) throw new Error('Incomplete backfill')
        return created.count
      }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 30000 })
    }
    const remaining = await db.user.count({ where })
    if (apply && remaining !== 0) throw new Error('Post-write verification requires follow-up')
    console.log(JSON.stringify({ checkedAt: new Date().toISOString(), mode: apply ? 'apply' : 'read-only', serviceId,
      reviewedMissing: review.length, createdCount, remainingMissing: remaining,
      scope: 'Missing rows only; existing plans, counters, users and Stripe contracts are never updated. No outgoing notifications.' }))
  } finally { await db.$disconnect() }
}
main().catch(error => { console.error('Service backfill failed:', (error as { code?: string }).code || error.name); process.exitCode = 1 })
