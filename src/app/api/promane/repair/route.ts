export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/promane/repair?workspaceSlug=...
 * 既存の不正データを修復:
 *  - 経費の負値 → 0
 *  - プロジェクト契約金額の負値 → 0
 *  - 時間記録の負値 → 0
 *  - メンバー時給の負値 → 0
 *  - タスクの逆転日付 → dueDate=null
 *  - プロジェクトの逆転日付 → endDate=null
 * owner/admin のみ実行可能
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }
    const workspaceSlug = req.nextUrl.searchParams.get('workspaceSlug')
    if (!workspaceSlug) {
      return NextResponse.json({ error: 'workspaceSlug は必須です' }, { status: 400 })
    }

    const workspace = await prisma.promaneWorkspace.findFirst({
      where: { slug: workspaceSlug, members: { some: { userId, isActive: true } } },
      select: { id: true },
    })
    if (!workspace) {
      return NextResponse.json({ error: 'アクセス権がありません' }, { status: 403 })
    }

    // owner/admin チェック
    const member = await prisma.promaneMember.findFirst({
      where: { workspaceId: workspace.id, userId, isActive: true },
      select: { role: true },
    })
    if (!member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json({ error: 'データ修復は owner/admin のみ実行可能です' }, { status: 403 })
    }

    let totalFixed = 0

    // 1) 経費の負値を 0 にクランプ
    const badExpenses = await prisma.promaneExpense.updateMany({
      where: { project: { workspaceId: workspace.id }, amount: { lt: 0 } },
      data: { amount: 0 },
    })
    totalFixed += badExpenses.count

    // 2) 契約金額の負値を 0 にクランプ
    const badProjects = await prisma.promaneProject.updateMany({
      where: { workspaceId: workspace.id, contractAmount: { lt: 0 } },
      data: { contractAmount: 0 },
    })
    totalFixed += badProjects.count

    // 3) 時間記録の負値を 0 に
    const badTimeEntries = await prisma.promaneTimeEntry.updateMany({
      where: { member: { workspaceId: workspace.id }, duration: { lt: 0 } },
      data: { duration: 0 },
    })
    totalFixed += badTimeEntries.count

    // 4) メンバー時給の負値を 0 に
    const badRates = await prisma.promaneMember.updateMany({
      where: { workspaceId: workspace.id, hourlyRate: { lt: 0 } },
      data: { hourlyRate: 0 },
    })
    totalFixed += badRates.count

    // 5) タスクの逆転日付: dueDate を null にする
    const allTasks = await prisma.promaneTask.findMany({
      where: {
        project: { workspaceId: workspace.id },
        startDate: { not: null },
        dueDate: { not: null },
      },
      select: { id: true, startDate: true, dueDate: true },
    })
    const reverseTasks = allTasks.filter((t) => t.startDate && t.dueDate && t.dueDate < t.startDate)
    if (reverseTasks.length > 0) {
      await prisma.$transaction(
        reverseTasks.map((t) =>
          prisma.promaneTask.update({ where: { id: t.id }, data: { dueDate: null } })
        )
      )
      totalFixed += reverseTasks.length
    }

    // 6) プロジェクトの逆転日付
    const allProjects = await prisma.promaneProject.findMany({
      where: {
        workspaceId: workspace.id,
        startDate: { not: null },
        endDate: { not: null },
      },
      select: { id: true, startDate: true, endDate: true },
    })
    const reverseProjects = allProjects.filter((p) => p.startDate && p.endDate && p.endDate < p.startDate)
    if (reverseProjects.length > 0) {
      await prisma.$transaction(
        reverseProjects.map((p) =>
          prisma.promaneProject.update({ where: { id: p.id }, data: { endDate: null } })
        )
      )
      totalFixed += reverseProjects.length
    }

    return NextResponse.json({
      success: true,
      totalFixed,
      details: {
        negativeExpenses: badExpenses.count,
        negativeContracts: badProjects.count,
        negativeTimeEntries: badTimeEntries.count,
        negativeRates: badRates.count,
        reverseTaskDates: reverseTasks.length,
        reverseProjectDates: reverseProjects.length,
      },
    })
  } catch (e: any) {
    console.error('[promane/repair]', e)
    return NextResponse.json(
      { error: e?.message || 'データ修復に失敗しました' },
      { status: 500 }
    )
  }
}
