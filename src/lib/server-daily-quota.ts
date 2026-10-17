import { createHmac, randomUUID } from 'node:crypto'
import { prisma } from './prisma'

// ============================================
// サーバー側で数える「1日あたりの回数上限」
// ============================================
// Cookie や Origin のようにクライアントが書き換えられる値ではなく、
// 接続元 IP（ハッシュ化）やログイン中のユーザー ID で数えるための共通処理。
// 既存の SystemSetting テーブルを使うので、スキーマの変更は要らない。
// ⚠️ 生の IP は保存しない。鍵付きハッシュの先頭だけをキーに使う。
// ⚠️ 日付は JST で区切る。古い日付のキーは、ときどき消す。

const PREFIX = 'rl:v1:'

/** JST の日付（YYYYMMDD） */
export function jstDayKey(now = Date.now()): string {
  return new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, '')
}

/** Vercel が付ける接続元 IP を優先して取る。取れなければ unknown。 */
export function clientIp(headers: Headers): string {
  const vercel = headers.get('x-vercel-forwarded-for')
  const forwarded = headers.get('x-forwarded-for')
  const realIp = headers.get('x-real-ip')
  const raw = (vercel || forwarded || realIp || '').split(',')[0].trim()
  return raw || 'unknown'
}

function hashSecret(): string {
  return process.env.RATE_LIMIT_SECRET || process.env.NEXTAUTH_SECRET
    || (process.env.NODE_ENV === 'production' ? '' : 'rate-limit-dev-secret')
}

/** 識別子（IP やユーザー ID）を、キーに使える短い鍵付きハッシュにする。 */
export function quotaSubject(value: string): string {
  const secret = hashSecret()
  if (!secret) throw new Error('RATE_LIMIT_SECRET or NEXTAUTH_SECRET is required')
  return createHmac('sha256', secret).update(value).digest('base64url').slice(0, 22)
}

export function dailyQuotaKey(scope: string, subject: string, day = jstDayKey()): string {
  if (!/^[a-z0-9-]{1,40}$/.test(scope)) throw new Error('invalid quota scope')
  return `${PREFIX}${scope}:${day}:${subject}`
}

export type DailyQuotaResult = 'allowed' | 'limited' | 'unavailable'

/**
 * 1回分を原子的に消費する。上限に達していれば消費せずに limited を返す。
 * DB が使えないときは unavailable を返す（呼び出し側で安全側に倒す）。
 */
export async function consumeDailyQuota(scope: string, subject: string, limit: number): Promise<DailyQuotaResult> {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('invalid quota limit')
  const key = dailyQuotaKey(scope, subject)
  try {
    const rows = await prisma.$queryRaw<Array<{ value: string }>>`
      INSERT INTO "SystemSetting" ("id", "key", "value")
      VALUES (${randomUUID()}, ${key}, '1')
      ON CONFLICT ("key") DO UPDATE SET "value" = (("SystemSetting"."value")::int + 1)::text
      WHERE ("SystemSetting"."value")::int < ${limit}
      RETURNING "value"
    `
    if (Math.random() < 0.01) void purgeOldDailyQuotas().catch(() => {})
    return rows.length ? 'allowed' : 'limited'
  } catch {
    console.warn('[daily-quota] shared counter unavailable')
    return 'unavailable'
  }
}

/** 前日より古いキーを消す（キーが増え続けないようにする）。 */
export async function purgeOldDailyQuotas(today = jstDayKey()): Promise<number> {
  return prisma.$executeRaw`
    DELETE FROM "SystemSetting"
    WHERE "key" LIKE 'rl:v1:%' AND split_part("key", ':', 4) < ${today}
  `
}
