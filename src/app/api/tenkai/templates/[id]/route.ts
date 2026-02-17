// ============================================
// GET / PUT / DELETE /api/tenkai/templates/[id]
// ============================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

async function resolveId(ctx: Ctx): Promise<string> {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  return p.id
}

/**
 * GET — テンプレート詳細
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id
    const id = await resolveId(ctx)

    const template = await prisma.tenkaiTemplate.findUnique({
      where: { id },
    })

    if (!template) {
      return NextResponse.json({ error: 'テンプレートが見つかりません' }, { status: 404 })
    }

    // システムテンプレートは誰でも閲覧可、カスタムは所有者のみ
    if (!template.isSystem && template.userId !== userId) {
      return NextResponse.json({ error: 'テンプレートが見つかりません' }, { status: 404 })
    }

    return NextResponse.json({ template })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'エラーが発生しました'
    console.error('[tenkai] template detail error:', message)
    return NextResponse.json(
      { error: message || 'テンプレートの取得に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * PUT — テンプレート更新
 */
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id
    const id = await resolveId(ctx)

    const existing = await prisma.tenkaiTemplate.findUnique({
      where: { id },
      select: { userId: true, isSystem: true },
    })

    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: 'テンプレートが見つかりません' }, { status: 404 })
    }

    if (existing.isSystem) {
      return NextResponse.json(
        { error: 'システムテンプレートは編集できません' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { name, description, promptOverride, structureHint } = body

    const data: Record<string, unknown> = {}
    if (name !== undefined) {
      const trimmed = typeof name === 'string' ? name.trim() : ''
      if (!trimmed) return NextResponse.json({ error: '名前は空にできません' }, { status: 400 })
      data.name = trimmed
    }
    if (description !== undefined) data.description = description
    if (promptOverride !== undefined) data.promptOverride = promptOverride
    if (structureHint !== undefined) data.structureHint = structureHint

    const updated = await prisma.tenkaiTemplate.update({
      where: { id },
      data,
    })

    return NextResponse.json({ template: updated })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'エラーが発生しました'
    console.error('[tenkai] template update error:', message)
    return NextResponse.json(
      { error: message || 'テンプレートの更新に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * DELETE — テンプレート削除
 */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id
    const id = await resolveId(ctx)

    const existing = await prisma.tenkaiTemplate.findUnique({
      where: { id },
      select: { userId: true, isSystem: true },
    })

    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: 'テンプレートが見つかりません' }, { status: 404 })
    }

    if (existing.isSystem) {
      return NextResponse.json(
        { error: 'システムテンプレートは削除できません' },
        { status: 403 }
      )
    }

    await prisma.tenkaiTemplate.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'エラーが発生しました'
    console.error('[tenkai] template delete error:', message)
    return NextResponse.json(
      { error: message || 'テンプレートの削除に失敗しました' },
      { status: 500 }
    )
  }
}
