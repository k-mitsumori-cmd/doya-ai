export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function retryRepairTransaction<T>(commit: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await commit() }
    catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2034')) throw error
      if (attempt === 2) throw new Error('同時にデータが変更されました')
    }
  }
  throw new Error('データを修復できませんでした')
}

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

    const result = await retryRepairTransaction(() => prisma.$transaction(async tx => {
      const workspace = await tx.promaneWorkspace.findFirst({
        where: { slug: workspaceSlug, members: { some: { userId, isActive: true } } },
        select: { id: true },
      })
      if (!workspace) return { status: 403 as const, error: 'アクセス権がありません' }
      const member = await tx.promaneMember.findFirst({
        where: { workspaceId: workspace.id, userId, isActive: true, role: { in: ['owner', 'admin'] } },
        select: { id: true },
      })
      if (!member) return { status: 403 as const, error: 'データ修復は owner/admin のみ実行可能です' }

      const badExpenses = await tx.promaneExpense.updateMany({
        where: { project: { workspaceId: workspace.id }, amount: { lt: 0 } }, data: { amount: 0 },
      })
      const badProjects = await tx.promaneProject.updateMany({
        where: { workspaceId: workspace.id, contractAmount: { lt: 0 } }, data: { contractAmount: 0 },
      })
      const badTimeEntries = await tx.promaneTimeEntry.updateMany({
        where: { member: { workspaceId: workspace.id }, duration: { lt: 0 } }, data: { duration: 0 },
      })
      const badRates = await tx.promaneMember.updateMany({
        where: { workspaceId: workspace.id, hourlyRate: { lt: 0 } }, data: { hourlyRate: 0 },
      })

      const allTasks = await tx.promaneTask.findMany({
        where: { project: { workspaceId: workspace.id }, startDate: { not: null }, dueDate: { not: null } },
        select: { id: true, startDate: true, dueDate: true },
      })
      let reverseTaskDates = 0
      for (const task of allTasks) {
        if (!task.startDate || !task.dueDate || task.dueDate >= task.startDate) continue
        const updated = await tx.promaneTask.updateMany({
          where: { id: task.id, project: { workspaceId: workspace.id }, startDate: task.startDate, dueDate: task.dueDate },
          data: { dueDate: null },
        })
        reverseTaskDates += updated.count
      }

      const allProjects = await tx.promaneProject.findMany({
        where: { workspaceId: workspace.id, startDate: { not: null }, endDate: { not: null } },
        select: { id: true, startDate: true, endDate: true },
      })
      let reverseProjectDates = 0
      for (const project of allProjects) {
        if (!project.startDate || !project.endDate || project.endDate >= project.startDate) continue
        const updated = await tx.promaneProject.updateMany({
          where: { id: project.id, workspaceId: workspace.id, startDate: project.startDate, endDate: project.endDate },
          data: { endDate: null },
        })
        reverseProjectDates += updated.count
      }

      const details = {
        negativeExpenses: badExpenses.count,
        negativeContracts: badProjects.count,
        negativeTimeEntries: badTimeEntries.count,
        negativeRates: badRates.count,
        reverseTaskDates,
        reverseProjectDates,
      }
      return { status: 200 as const, details, totalFixed: Object.values(details).reduce((sum, count) => sum + count, 0) }
    }, { isolationLevel: 'Serializable', timeout: 20_000 }))
    if (result.status !== 200) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ success: true, totalFixed: result.totalFixed, details: result.details })
  } catch (e: any) {
    console.error('[promane/repair]')
    return NextResponse.json(
      { error: 'データ修復に失敗しました' },
      { status: 500 }
    )
  }
}
