import { parsePromaneExpense, PromaneExpenseInputError } from '@/lib/promane/time-input'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/promane/expenses
 * Body: { workspaceSlug, projectId, category, amount, description, date }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'ログインセッションが切れています' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { workspaceSlug, projectId } = body || {}

    if (typeof workspaceSlug !== 'string' || !workspaceSlug.trim() || workspaceSlug.length > 200) {
      return NextResponse.json({ error: 'workspaceSlug と projectId は必須です' }, { status: 400 })
    }

    const validated = parsePromaneExpense(body)

    // WS所属確認 + IDOR防止
    const workspace = await prisma.promaneWorkspace.findFirst({
      where: { slug: workspaceSlug, members: { some: { userId, isActive: true, role: { in: ['owner', 'admin', 'member'] } } } },
      select: { id: true },
    })
    if (!workspace) return NextResponse.json({ error: 'ワークスペースにアクセスできません' }, { status: 403 })

    const project = await prisma.promaneProject.findFirst({
      where: { id: projectId, workspaceId: workspace.id },
      select: { id: true },
    })
    if (!project) return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })

    const expense = await prisma.promaneExpense.create({
      data: validated,
    })

    return NextResponse.json({ success: true, expense })
  } catch (e: any) {
    if (!(e instanceof PromaneExpenseInputError)) console.error('[promane/expenses][POST] failed')
    return NextResponse.json(
      { error: e instanceof PromaneExpenseInputError ? e.message : '経費の追加に失敗しました。時間をおいて再試行してください。' },
      { status: e instanceof PromaneExpenseInputError ? 400 : 500 }
    )
  }
}

/**
 * DELETE /api/promane/expenses?workspaceSlug=...&id=...&projectId=...
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) return NextResponse.json({ error: 'ログインセッションが切れています' }, { status: 401 })

    const workspaceSlug = req.nextUrl.searchParams.get('workspaceSlug')
    const id = req.nextUrl.searchParams.get('id')
    if (!workspaceSlug || !id) return NextResponse.json({ error: 'workspaceSlug と id は必須' }, { status: 400 })

    const workspace = await prisma.promaneWorkspace.findFirst({
      where: { slug: workspaceSlug, members: { some: { userId, isActive: true, role: { in: ['owner', 'admin', 'member'] } } } },
      select: { id: true },
    })
    if (!workspace) return NextResponse.json({ error: 'アクセス権なし' }, { status: 403 })

    const existing = await prisma.promaneExpense.findFirst({
      where: { id, project: { workspaceId: workspace.id } },
      select: { id: true },
    })
    if (!existing) return NextResponse.json({ error: '経費が見つかりません' }, { status: 404 })

    await prisma.promaneExpense.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[promane/expenses][DELETE] failed')
    return NextResponse.json({ error: '削除に失敗しました。時間をおいて再試行してください。' }, { status: 500 })
  }
}
