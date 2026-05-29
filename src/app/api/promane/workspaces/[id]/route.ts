export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

/**
 * PATCH /api/promane/workspaces/[id]
 * ワークスペース設定の更新 (owner/admin限定)
 * Body: { name?: string, slug?: string }
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const p = 'then' in ctx.params ? await ctx.params : ctx.params
    const { id } = p

    // 権限確認: owner/admin のみ
    const member = await prisma.promaneMember.findFirst({
      where: { workspaceId: id, userId, isActive: true },
      select: { role: true },
    })
    if (!member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json({ error: 'ワークスペース設定の編集権限がありません' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const { name, slug } = body || {}

    const updateData: { name?: string; slug?: string } = {}

    if (name !== undefined) {
      const trimmed = String(name).trim()
      if (!trimmed) return NextResponse.json({ error: 'ワークスペース名は必須です' }, { status: 400 })
      if (trimmed.length > 100) return NextResponse.json({ error: 'ワークスペース名は100文字以内' }, { status: 400 })
      updateData.name = trimmed
    }

    if (slug !== undefined) {
      const trimmed = String(slug).trim().toLowerCase()
      if (!trimmed) return NextResponse.json({ error: 'スラッグは必須です' }, { status: 400 })
      if (!/^[a-z0-9][a-z0-9-]{2,49}$/.test(trimmed)) {
        return NextResponse.json({ error: 'スラッグは半角英数字とハイフン、3〜50文字' }, { status: 400 })
      }
      // 重複チェック
      const existing = await prisma.promaneWorkspace.findFirst({
        where: { slug: trimmed, NOT: { id } },
        select: { id: true },
      })
      if (existing) {
        return NextResponse.json({ error: 'このスラッグは既に使われています' }, { status: 409 })
      }
      updateData.slug = trimmed
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '変更項目がありません' }, { status: 400 })
    }

    const updated = await prisma.promaneWorkspace.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, slug: true },
    })

    return NextResponse.json({ success: true, workspace: updated })
  } catch (e: any) {
    console.error('[promane/workspaces/id][PATCH]', e)
    return NextResponse.json(
      { error: e?.message || '設定の更新に失敗しました' },
      { status: 500 }
    )
  }
}
