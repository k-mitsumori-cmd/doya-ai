export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getUserPromaneLimits,
  countUserProjects,
  countUserWorkspaces,
  remaining,
} from '@/lib/promane/limits'

/**
 * GET /api/promane/usage
 * プロマネのプラン・利用状況を返す
 * ドヤAI 共通形式（doyalist/usage と同じレスポンス構造）
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const [user, limits, projectsUsed, workspacesUsed] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true, stripeCurrentPeriodEnd: true },
      }),
      getUserPromaneLimits(userId),
      countUserProjects(userId),
      countUserWorkspaces(userId),
    ])

    return NextResponse.json({
      success: true,
      plan: {
        raw: user?.plan || 'FREE',
        tier: limits.tier,
        periodEnd: user?.stripeCurrentPeriodEnd || null,
      },
      limits: {
        maxProjects: limits.maxProjects,
        maxMembersPerWorkspace: limits.maxMembersPerWorkspace,
        maxWorkspaces: limits.maxWorkspaces,
      },
      usage: {
        projects: projectsUsed,
        workspaces: workspacesUsed,
      },
      remaining: {
        projects: remaining(projectsUsed, limits.maxProjects),
        workspaces: remaining(workspacesUsed, limits.maxWorkspaces),
      },
    })
  } catch (e: any) {
    console.error('[promane/usage][GET]', e)
    return NextResponse.json(
      { error: e?.message || '利用状況の取得に失敗しました' },
      { status: 500 }
    )
  }
}
