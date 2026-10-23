export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getHrContext, hasMinRole } from '@/lib/hr/access'
import { getOrgPlan, getOrgPlanLimits, hrJstMonthStart } from '@/lib/hr/billing'
import { HrMemberRole } from '@/lib/hr/types'

const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }

export async function GET() {
  try {
    const ctx = await getHrContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
    }

    // 組織オーナーの契約プランを基準に使用量を返す。
    // ⚠️ 4つの読み取りは互いに依存しないので同時に流す（以前は直列で、DB の往復が最大6回つながっていた）
    const [plan, employeeCount, memberCount, org] = await Promise.all([
      getOrgPlan(ctx.organizationId),
      prisma.hrEmployee.count({ where: { organizationId: ctx.organizationId, status: 'ACTIVE' } }),
      prisma.hrOrganizationMember.count({ where: { organizationId: ctx.organizationId, status: 'ACTIVE' } }),
      // AI使用量（月次）
      prisma.hrOrganization.findUnique({
        where: { id: ctx.organizationId },
        select: { aiUsageCount: true, aiUsageResetAt: true },
      }),
    ])
    const limits = getOrgPlanLimits(plan)

    // 月次リセット判定
    const aiUsageCount = org?.aiUsageResetAt &&
      hrJstMonthStart(org.aiUsageResetAt).getTime() === hrJstMonthStart().getTime()
      ? org.aiUsageCount : 0

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
    }, { headers: privateHeaders })
  } catch {
    return NextResponse.json({ error: '使用状況を取得できませんでした。再読み込みしてください。' }, { status: 503, headers: privateHeaders })
  }
}
