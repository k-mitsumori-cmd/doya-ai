export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function validateAmount(v: number | undefined | null, field: string): number {
  if (v == null || v === 0) return 0
  if (!Number.isFinite(v)) throw new Error(`${field}は数値で入力してください`)
  if (v < 0) throw new Error(`${field}は 0以上の値を入力してください`)
  if (v > 9_999_999_999) throw new Error(`${field}が大きすぎます`)
  return Math.floor(v)
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
    const { workspaceSlug, projectId, category, amount, description, date } = body || {}

    if (!workspaceSlug || !projectId) {
      return NextResponse.json({ error: 'workspaceSlug と projectId は必須です' }, { status: 400 })
    }

    // WS所属確認 + IDOR防止
    const workspace = await prisma.promaneWorkspace.findFirst({
      where: { slug: workspaceSlug, members: { some: { userId, isActive: true } } },
      select: { id: true },
    })
    if (!workspace) return NextResponse.json({ error: 'ワークスペースにアクセスできません' }, { status: 403 })

    const project = await prisma.promaneProject.findFirst({
      where: { id: projectId, workspaceId: workspace.id },
      select: { id: true },
    })
    if (!project) return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })

    const validatedAmount = validateAmount(amount, '金額')

    const expense = await prisma.promaneExpense.create({
      data: {
        projectId,
        category: category || 'other',
        amount: validatedAmount,
        description: String(description || '').slice(0, 500),
        date: date ? new Date(date) : new Date(),
      },
    })

    return NextResponse.json({ success: true, expense })
  } catch (e: any) {
    console.error('[promane/expenses][POST]', e)
    return NextResponse.json(
      { error: e?.message || '経費の追加に失敗しました' },
      { status: e?.message?.includes('0以上') || e?.message?.includes('必須') ? 400 : 500 }
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
      where: { slug: workspaceSlug, members: { some: { userId, isActive: true } } },
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
    console.error('[promane/expenses][DELETE]', e)
    return NextResponse.json({ error: e?.message || '削除に失敗しました' }, { status: 500 })
  }
}
