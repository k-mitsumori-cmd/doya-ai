import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jstStartOfMonthUtc } from '@/lib/plan-limit'
import { sfaOwnerPlanTier } from './limits'

const PENDING = 'SFA_AI_PENDING'
const COMPLETE = 'SFA_AI_COMPLETE'
const STALE_PENDING_MS = 15 * 60 * 1000 // API の最大実行時間 5 分を超えた予約だけを回収

export type SfaAiReservation = { id: string } | { limit: number; used: number; upgradeAvailable: boolean }

/** 同一組織の2種類のAI APIは同じ月次枠を消費する。予約を先に保存してからプロバイダを呼ぶ。 */
export async function reserveSfaAiUsage(organizationId: string, actorUserId: string, action: 'score' | 'next-action'): Promise<SfaAiReservation> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const tier = await sfaOwnerPlanTier(tx, organizationId)
        const limit = tier === 'FREE' || tier === 'GUEST' ? 20 : tier === 'LIGHT' ? 300 : null
        const orgFilter = { path: ['organizationId'], equals: organizationId }
        await tx.generation.deleteMany({
          where: { serviceId: 'sfa', outputType: PENDING, createdAt: { lt: new Date(Date.now() - STALE_PENDING_MS) }, metadata: orgFilter },
        })
        if (limit !== null) {
          const used = await tx.generation.count({
            where: {
              serviceId: 'sfa',
              outputType: { in: [PENDING, COMPLETE] },
              createdAt: { gte: jstStartOfMonthUtc() },
              metadata: orgFilter,
            },
          })
          if (used >= limit) return { limit, used, upgradeAvailable: true }
        }
        const reservation = await tx.generation.create({
          data: {
            userId: actorUserId,
            serviceId: 'sfa',
            input: {},
            output: '',
            outputType: PENDING,
            metadata: { organizationId, action },
          },
          select: { id: true },
        })
        return { id: reservation.id }
      }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 30000 })
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2034' || attempt === 4) throw error
    }
  }
  throw new Error('SFA AI reservation retry exhausted')
}

export async function completeSfaAiUsage(id: string): Promise<void> {
  const result = await prisma.generation.updateMany({ where: { id, serviceId: 'sfa', outputType: PENDING }, data: { outputType: COMPLETE } })
  if (result.count !== 1) throw new Error('SFA AI reservation was not settled')
}

export async function releaseSfaAiUsage(id: string): Promise<void> {
  await prisma.generation.deleteMany({ where: { id, serviceId: 'sfa', outputType: PENDING } })
}

export function sfaAiLimitResponse(quota: Extract<SfaAiReservation, { limit: number }>, canManageBilling: boolean) {
  return NextResponse.json({
    error: `今月のAI実行上限（${quota.limit}回）に達しました。プロプランで枠を広げられます。`,
    code: 'SFA_AI_LIMIT_REACHED',
    limitReached: true,
    canManageBilling,
    used: quota.used,
    limit: quota.limit,
    upgradeUrl: '/sfa/pricing',
  }, { status: 402 })
}
