import { parsePromaneExpense, PromaneExpenseInputError } from '@/lib/promane/time-input'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function retryExpenseTransaction<T>(commit: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await commit() }
    catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2034')) throw error
      if (attempt === 2) throw new Error('同時に経費が変更されました')
    }
  }
  throw new Error('経費を保存できませんでした')
}

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

    const result = await retryExpenseTransaction(() => prisma.$transaction(async tx => {
      const workspace = await tx.promaneWorkspace.findFirst({
        where: { slug: workspaceSlug, members: { some: { userId, isActive: true, role: { in: ['owner', 'admin', 'member'] } } } },
        select: { id: true },
      })
      if (!workspace) return { status: 403 as const, error: 'ワークスペースにアクセスできません' }
      const project = await tx.promaneProject.findFirst({
        where: { id: projectId, workspaceId: workspace.id },
        select: { id: true },
      })
      if (!project) return { status: 404 as const, error: 'プロジェクトが見つかりません' }
      const expense = await tx.promaneExpense.create({ data: validated })
      return { status: 200 as const, expense }
    }, { isolationLevel: 'Serializable' }))
    if (result.status !== 200) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ success: true, expense: result.expense })
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

    const result = await retryExpenseTransaction(() => prisma.$transaction(async tx => {
      const workspace = await tx.promaneWorkspace.findFirst({
        where: { slug: workspaceSlug, members: { some: { userId, isActive: true, role: { in: ['owner', 'admin', 'member'] } } } },
        select: { id: true },
      })
      if (!workspace) return { status: 403 as const, error: 'アクセス権なし' }
      const deleted = await tx.promaneExpense.deleteMany({
        where: { id, project: { workspaceId: workspace.id } },
      })
      if (deleted.count !== 1) return { status: 404 as const, error: '経費が見つかりません' }
      return { status: 200 as const }
    }, { isolationLevel: 'Serializable' }))
    if (result.status !== 200) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[promane/expenses][DELETE] failed')
    return NextResponse.json({ error: '削除に失敗しました。時間をおいて再試行してください。' }, { status: 500 })
  }
}
