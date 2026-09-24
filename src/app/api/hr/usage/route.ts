export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getHrContext, hasMinRole } from '@/lib/hr/access'
import { getOrgPlan, getOrgPlanLimits } from '@/lib/hr/billing'
import { HrMemberRole } from '@/lib/hr/types'

export async function GET() {
  try {
    const ctx = await getHrContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 組織オーナーの契約プランを基準に使用量を返す。
    const plan = await getOrgPlan(ctx.organizationId)
    const limits = getOrgPlanLimits(plan)

    const employeeCount = await prisma.hrEmployee.count({
      where: { organizationId: ctx.organizationId, status: 'ACTIVE' },
    })

    const memberCount = await prisma.hrOrganizationMember.count({
      where: { organizationId: ctx.organizationId, status: 'ACTIVE' },
    })

    // AI使用量（月次）
    const org = await prisma.hrOrganization.findUnique({
      where: { id: ctx.organizationId },
      select: { aiUsageCount: true, aiUsageResetAt: true },
    })

    // 月次リセット判定
    let aiUsageCount = org?.aiUsageCount ?? 0
    if (org?.aiUsageResetAt) {
      const now = new Date()
      const resetAt = new Date(org.aiUsageResetAt)
      const needsReset =
        now.getFullYear() !== resetAt.getFullYear() ||
        now.getMonth() !== resetAt.getMonth()
      if (needsReset) {
        aiUsageCount = 0
      }
    }

    return NextResponse.json({
      plan: plan.toLowerCase(),
      planLabel: plan === 'FREE' ? 'Free' : plan === 'STARTER' ? 'Starter' : plan === 'LIGHT' ? 'Light' : plan === 'PRO' || plan === 'BUNDLE' ? 'Pro' : plan === 'ENTERPRISE' ? 'Enterprise' : plan,
      employeeCount,
      employeeLimit: limits.maxEmployees === -1 ? 999 : limits.maxEmployees,
      memberCount,
      memberLimit: limits.maxMembers === -1 ? 999 : limits.maxMembers,
      aiUsageCount,
      aiUsageLimit: limits.maxAiUsage === -1 ? 999 : limits.maxAiUsage,
      organizationId: ctx.organizationId,
      canManageBilling: ctx.role === HrMemberRole.OWNER,
      canManageEmployees: hasMinRole(ctx.role, HrMemberRole.ADMIN),
      hasLinkedEmployee: Boolean(ctx.employeeId),
    })
  } catch {
    return NextResponse.json({ error: '使用状況を取得できませんでした。再読み込みしてください。' }, { status: 503 })
  }
}
