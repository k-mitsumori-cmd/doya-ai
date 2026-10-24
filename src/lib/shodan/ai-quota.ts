import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { SHODAN_AI_MONTHLY_LIMIT } from './types'

// 提案資料・スライド生成の AI 呼び出し回数を、組織ごと・JST の月ごとに数える。
// スキーマを増やさず、スライドの排他と同じ SystemSetting を使う。
// 予約（reserve）→ 失敗した分だけ戻す（refund）。

export function shodanAiLimitFor(plan: string): number {
  return plan.toUpperCase() === 'ENTERPRISE' ? SHODAN_AI_MONTHLY_LIMIT.ENTERPRISE : SHODAN_AI_MONTHLY_LIMIT.PRO
}

export function shodanAiQuotaKey(organizationId: string, now = Date.now()): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(organizationId)) throw new Error('Invalid organization ID')
  const jstMonth = new Date(now + 9 * 3_600_000).toISOString().slice(0, 7)
  return `shodan-ai-quota:v1:${organizationId}:${jstMonth}`
}

export type ShodanAiReserve = { ok: true; used: number; key: string } | { ok: false; used: number; limit: number }

export async function reserveShodanAi(organizationId: string, units: number, limit: number, db: PrismaClient = prisma, now = Date.now()): Promise<ShodanAiReserve> {
  if (!Number.isInteger(units) || units < 1) throw new Error('Invalid units')
  const key = shodanAiQuotaKey(organizationId, now)
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`
    const row = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
    const used = row ? Number(row.value) : 0
    if (!Number.isSafeInteger(used) || used < 0) throw new Error('Shodan AI quota invalid')
    if (used + units > limit) return { ok: false, used, limit } as const
    await tx.systemSetting.upsert({ where: { key }, create: { key, value: String(used + units) }, update: { value: String(used + units) } })
    return { ok: true, used: used + units, key } as const
  }, { timeout: 15_000 })
}

/**
 * AI を呼ぶ前に失敗した分だけ戻す。予約したときのキー（月）をそのまま使うので、
 * 月をまたいでも別の月の数を減らさない。戻せなくても呼び出し元の応答は変えない。
 */
export async function refundShodanAi(key: string, units: number, db: PrismaClient = prisma): Promise<void> {
  if (!Number.isInteger(units) || units < 1 || !/^shodan-ai-quota:v1:[A-Za-z0-9_-]{1,128}:\d{4}-\d{2}$/.test(key)) return
  try {
    await db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`
      const row = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
      if (!row) return
      const used = Number(row.value)
      if (!Number.isSafeInteger(used)) return
      await tx.systemSetting.update({ where: { key }, data: { value: String(Math.max(0, used - units)) } })
    }, { timeout: 15_000 })
  } catch { console.error('[shodan/ai-quota] refund failed') }
}

export function shodanAiLimitResponse(limit: number, canManageBilling: boolean) {
  return {
    error: `今月の提案資料・スライドの生成上限（${limit}回）に達しました。来月1日に枠が戻ります。${canManageBilling ? '追加をご希望の場合はお問い合わせよりご相談ください。' : '追加の枠は組織オーナーにご相談ください。'}`,
    code: 'LIMIT',
    canManageBilling,
    ...(canManageBilling ? { contactUrl: 'https://doyamarke.surisuta.jp/contact' } : {}),
  }
}
