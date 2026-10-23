// ドヤ展示会の画像生成の上限（枚数・金額）。
// 共通の consumeDailyQuota は1回ずつ数えるので、枚数や円のように「まとめて足す」量は、ここで同じ仕組みを使って数える。
// SystemSetting の1行を原子的に加算するので、Vercel のインスタンスをまたいでも上限を守れる（プロセス内の変数は使わない）。
// ⚠️ キーの形は server-daily-quota.ts と同じ（rl:v1:<scope>:<JSTの日付>:<subject>）。古いキーは共通の purge で消える。
import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { dailyQuotaKey, quotaSubject, type DailyQuotaResult } from '@/lib/server-daily-quota'

/** 1日に使える量のうち amount を原子的に消費する。足すと limit を超えるなら消費せずに limited を返す */
export async function consumeDailyAmount(scope: string, subject: string, amount: number, limit: number): Promise<DailyQuotaResult> {
  if (!Number.isInteger(amount) || amount < 1) throw new Error('invalid quota amount')
  if (!Number.isInteger(limit) || limit < 1) throw new Error('invalid quota limit')
  if (amount > limit) return 'limited'
  const key = dailyQuotaKey(scope, subject)
  try {
    const rows = await prisma.$queryRaw<Array<{ value: string }>>`
      INSERT INTO "SystemSetting" ("id", "key", "value")
      VALUES (${randomUUID()}, ${key}, ${String(amount)})
      ON CONFLICT ("key") DO UPDATE SET "value" = (("SystemSetting"."value")::int + ${amount})::text
      WHERE ("SystemSetting"."value")::int + ${amount} <= ${limit}
      RETURNING "value"
    `
    return rows.length ? 'allowed' : 'limited'
  } catch {
    console.warn('[tenjikai/image-quota] shared counter unavailable')
    return 'unavailable'
  }
}

/** 1人あたり1日の枚数の上限 */
export function perUserDailyImages(): number {
  const n = Number(process.env.TENJIKAI_IMAGEGEN_PER_USER_DAILY ?? 10)
  return Number.isInteger(n) && n > 0 ? n : 10
}

/** サービス全体で1日に使ってよい金額（円） */
export function dailyLimitYen(): number {
  const n = Number(process.env.TENJIKAI_IMAGEGEN_DAILY_LIMIT_YEN ?? 500)
  return Number.isInteger(n) && n > 0 ? n : 500
}

export type ImageQuotaResult = { ok: true; reserved: ReservedImageQuota } | { ok: false; status: 429 | 503; message: string }

/** 消費した分の控え。戻すときに、消費した日のキーをそのまま使う（日付をまたいでも別の日を減らさない） */
export type ReservedImageQuota = { userKey: string; yenKey: string; images: number; costYen: number }

/** 消費した量を戻す。0 より下には減らさない。戻せなくても生成の失敗の応答は変えない（ログだけ残す） */
async function giveBackAmount(key: string, amount: number): Promise<boolean> {
  try {
    await prisma.$executeRaw`
      UPDATE "SystemSetting"
      SET "value" = GREATEST(0, ("value")::int - ${amount})::text
      WHERE "key" = ${key}
    `
    return true
  } catch {
    console.warn('[tenjikai/image-quota] refund failed')
    return false
  }
}

/**
 * 生成に失敗したとき、reserveImageQuota で消費した枚数と金額を戻す。
 * 利用者に画像が渡っていない（失敗の応答を返す）ときだけ呼ぶ。
 */
export async function refundImageQuota(reserved: ReservedImageQuota): Promise<void> {
  await giveBackAmount(reserved.userKey, reserved.images)
  await giveBackAmount(reserved.yenKey, reserved.costYen)
}

/**
 * 生成の前に、1人あたりの枚数とサービス全体の金額を消費する。
 * DB が使えないときは実行しない（課金を伴うため、安全側に倒す）。
 */
export async function reserveImageQuota(userId: string, images: number, costYen: number): Promise<ImageQuotaResult> {
  const userKey = dailyQuotaKey('tenjikai-img-user', quotaSubject(userId))
  const yenKey = dailyQuotaKey('tenjikai-img-yen', 'all')
  const reserved: ReservedImageQuota = { userKey, yenKey, images, costYen }
  const user = await consumeDailyAmount('tenjikai-img-user', quotaSubject(userId), images, perUserDailyImages())
  if (user === 'unavailable') return { ok: false, status: 503, message: '利用状況を確かめられないため、画像を作れません。時間をおいて、もう一度お試しください。' }
  if (user === 'limited') return { ok: false, status: 429, message: `画像は1日${perUserDailyImages()}枚まで作れます。明日もう一度お試しください。` }
  const yen = await consumeDailyAmount('tenjikai-img-yen', 'all', costYen, dailyLimitYen())
  // 金額の消費で失敗したら、先に消費した枚数を戻す（取られっぱなしにしない）
  if (yen === 'unavailable') {
    await giveBackAmount(userKey, images)
    return { ok: false, status: 503, message: '利用状況を確かめられないため、画像を作れません。時間をおいて、もう一度お試しください。' }
  }
  if (yen === 'limited') {
    await giveBackAmount(userKey, images)
    return { ok: false, status: 429, message: '本日の画像生成の上限に達しました。明日もう一度お試しください。' }
  }
  return { ok: true, reserved }
}

/** きょう作れる残りの枚数（表示用）。DB が使えないときは null */
export async function remainingImagesToday(userId: string): Promise<number | null> {
  try {
    const key = dailyQuotaKey('tenjikai-img-user', quotaSubject(userId))
    const row = await prisma.systemSetting.findUnique({ where: { key }, select: { value: true } })
    const used = row ? Number.parseInt(row.value, 10) || 0 : 0
    return Math.max(0, perUserDailyImages() - used)
  } catch {
    console.warn('[tenjikai/image-quota] remaining unavailable')
    return null
  }
}
