import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { postPlainToSlack } from '@/lib/notifications'

const KEY_PREFIX = 'billing-report-delivery:v1:'
const LEASE_MS = 6 * 60_000 // billing-audit Cron の最大実行時間 (5分) より長くする
const KEY_PATTERN = /^\d{4}-\d{2}-\d{2}:(daily|weekly|monthly)$/

type DeliveryState =
  | { status: 'pending' }
  | { status: 'sending'; token: string; leaseUntil: number }
  | { status: 'sent'; sentAt: string }

function parseState(value: string): DeliveryState {
  const state: unknown = JSON.parse(value)
  if (!state || typeof state !== 'object' || !('status' in state)) throw new Error('Billing report delivery state is invalid')
  const entry = state as Record<string, unknown>
  if (entry.status === 'pending') return { status: 'pending' }
  if (entry.status === 'sending' && typeof entry.token === 'string' &&
    Number.isSafeInteger(entry.leaseUntil) && Number(entry.leaseUntil) > 0) {
    return { status: 'sending', token: entry.token, leaseUntil: Number(entry.leaseUntil) }
  }
  if (entry.status === 'sent' && typeof entry.sentAt === 'string' && Number.isFinite(Date.parse(entry.sentAt))) {
    return { status: 'sent', sentAt: entry.sentAt }
  }
  throw new Error('Billing report delivery state is invalid')
}

/** 同じJST日付・種別の定期レポートを、再実行時に重複送信しない。 */
export async function deliverBillingReport(
  reportKey: string,
  message: string,
  db: Pick<PrismaClient, 'systemSetting'> = prisma,
  send: (text: string) => Promise<void> = postPlainToSlack,
): Promise<'sent' | 'already_sent'> {
  if (!KEY_PATTERN.test(reportKey)) throw new Error('Billing report key is invalid')
  const key = KEY_PREFIX + reportKey
  try {
    await db.systemSetting.create({ data: { key, value: JSON.stringify({ status: 'pending' }) } })
  } catch (error: any) {
    if (error?.code !== 'P2002') throw error
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await db.systemSetting.findUnique({ where: { key } })
    if (!row) throw new Error('Billing report delivery record is missing')
    const state = parseState(row.value)
    if (state.status === 'sent') return 'already_sent'
    const now = Date.now()
    if (state.status === 'sending' && state.leaseUntil > now) {
      throw new Error('Billing report delivery is already in progress')
    }

    const token = randomUUID()
    const sending = JSON.stringify({ status: 'sending', token, leaseUntil: now + LEASE_MS })
    const claimed = await db.systemSetting.updateMany({
      where: { key, value: row.value },
      data: { value: sending },
    })
    if (claimed.count !== 1) continue

    try {
      await send(message)
    } catch (error) {
      await db.systemSetting.updateMany({
        where: { key, value: sending },
        data: { value: JSON.stringify({ status: 'pending' }) },
      }).catch(() => {})
      throw error
    }

    const recorded = await db.systemSetting.updateMany({
      where: { key, value: sending },
      data: { value: JSON.stringify({ status: 'sent', sentAt: new Date().toISOString() }) },
    })
    if (recorded.count !== 1) throw new Error('Billing report delivery receipt could not be recorded')
    return 'sent'
  }
  throw new Error('Billing report delivery claim did not advance')
}
