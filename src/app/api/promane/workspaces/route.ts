export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/promane/workspaces
 * 自分が所属する全ワークスペースと役割・プロジェクト数を返す
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const memberships = await prisma.promaneMember.findMany({
      where: { userId, isActive: true },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            _count: { select: { projects: true, members: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // 各ワークスペースで自分が担当する未完了タスク数も取得
    const myTaskCounts = await prisma.promaneTask.groupBy({
      by: ['projectId'],
      where: {
        assigneeId: { in: memberships.map((m) => m.id) },
        status: { not: 'done' },
      },
      _count: { id: true },
    })

    // projectId → workspaceId map
    const projectIds = myTaskCounts.map((g) => g.projectId)
    const projectToWs = await prisma.promaneProject.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, workspaceId: true },
    })
    const wsTaskCountMap = new Map<string, number>()
    for (const tc of myTaskCounts) {
      const ws = projectToWs.find((p) => p.id === tc.projectId)?.workspaceId
      if (ws) wsTaskCountMap.set(ws, (wsTaskCountMap.get(ws) || 0) + tc._count.id)
    }

    const result = memberships.map((m) => ({
      workspaceId: m.workspace.id,
      workspaceName: m.workspace.name,
      workspaceSlug: m.workspace.slug,
      role: m.role,
      displayName: m.displayName,
      projectCount: m.workspace._count.projects,
      memberCount: m.workspace._count.members,
      myActiveTasks: wsTaskCountMap.get(m.workspace.id) || 0,
    }))

    return NextResponse.json({ success: true, workspaces: result })
  } catch (e: any) {
    console.error('[promane/workspaces][GET]', e)
    return NextResponse.json({ error: e?.message || 'ワークスペース取得に失敗しました' }, { status: 500 })
  }
}
