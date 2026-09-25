import type { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { tierFrom, type PlanTier } from '@/lib/plan-utils'

type Tx = Prisma.TransactionClient
type Resource = 'members' | 'accounts' | 'deals'
type Requested = Partial<Record<Resource, number>>

const LIMITS = {
  FREE: { members: 3, accounts: 50, deals: 50 },
  LIGHT: { members: 10, accounts: 1000, deals: 1000 },
  PRO: { members: 50, accounts: null, deals: null },
  ENTERPRISE: { members: null, accounts: null, deals: null },
} as const

export type SfaQuotaExceeded = { resource: Resource; used: number; limit: number; upgradeAvailable: boolean }

export function sfaQuotaResponse(limit: SfaQuotaExceeded, canManageBilling = false) {
  const label = { members: 'メンバー', accounts: '取引先', deals: '商談' }[limit.resource]
  return NextResponse.json({
    error: `${label}の上限（${limit.limit}${limit.resource === 'members' ? '名' : '件'}）に達しました。${limit.upgradeAvailable ? 'プロプランで枠を広げられます。' : '追加をご希望の場合はお問い合わせください。'}`,
    code: 'SFA_LIMIT_REACHED',
    limitReached: true,
    canManageBilling,
    resource: limit.resource,
    used: limit.used,
    limit: limit.limit,
    ...(limit.upgradeAvailable ? { upgradeUrl: '/sfa/pricing' } : {}),
  }, { status: 402 })
}

/** SFA は組織の資源を使うため、操作したメンバーではなく組織オーナーの契約で判定する。 */
export async function sfaOwnerPlanTier(tx: Tx, organizationId: string): Promise<PlanTier> {
  const owner = await tx.sfaMember.findFirst({
    where: { organizationId, role: 'owner', status: 'ACTIVE', userId: { not: null } },
    orderBy: { createdAt: 'asc' },
    select: { userId: true },
  })
  const user = owner?.userId
    ? await tx.user.findUnique({ where: { id: owner.userId }, select: { plan: true } })
    : null
  // 認証済みの組織オーナーにプラン行が無い場合は無料枠。GUEST と表示・案内しない。
  return tierFrom(user?.plan ?? 'FREE')
}

export async function checkSfaQuota(
  tx: Tx,
  organizationId: string,
  requested: Requested,
  options: { countPendingInvites?: boolean } = {}
): Promise<SfaQuotaExceeded | null> {
  const tier = await sfaOwnerPlanTier(tx, organizationId)
  const limits = LIMITS[tier === 'GUEST' ? 'FREE' : tier]
  for (const resource of ['members', 'accounts', 'deals'] as const) {
    const increment = requested[resource] ?? 0
    const limit = limits[resource]
    if (increment < 1 || limit === null) continue
    const used = resource === 'members'
      ? await tx.sfaMember.count({
          where: {
            organizationId,
            OR: options.countPendingInvites
              ? [{ status: 'ACTIVE' }, { status: 'PENDING', createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) } }]
              : [{ status: 'ACTIVE' }],
          },
        })
      : resource === 'accounts'
        ? await tx.sfaAccount.count({ where: { organizationId, isActive: true } })
        : await tx.sfaDeal.count({ where: { organizationId, isActive: true } })
    if (used + increment > limit) return { resource, used, limit, upgradeAvailable: tier === 'FREE' || tier === 'GUEST' || tier === 'LIGHT' }
  }
  return null
}

/** 件数確認と作成を Serializable で一体化し、同時リクエストによる上限超過を防ぐ。 */
export async function withSfaAdmission<T>(
  organizationId: string,
  requested: Requested,
  create: (tx: Tx) => Promise<T>,
  options: { countPendingInvites?: boolean } = {}
): Promise<{ created: T; limit?: never } | { created?: never; limit: SfaQuotaExceeded }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const limit = await checkSfaQuota(tx, organizationId, requested, options)
        if (limit) return { limit }
        return { created: await create(tx) }
      }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 30000 })
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2034' || attempt === 4) throw error
    }
  }
  throw new Error('SFA admission retry exhausted')
}
