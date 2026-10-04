export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function retryWorkspaceTransaction<T>(commit: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await commit() }
    catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2034')) throw error
      if (attempt === 2) throw new Error('同時にワークスペースが変更されました')
    }
  }
  throw new Error('ワークスペースを更新できませんでした')
}

type Ctx = { params: Promise<{ id: string }> }

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

    const p = await ctx.params
    const { id } = p

    const body = await req.json().catch(() => ({}))
    const { name, slug } = body || {}

    const updateData: { name?: string; slug?: string } = {}

    if (name !== undefined) {
      if (typeof name !== 'string') return NextResponse.json({ error: 'ワークスペース名の形式が不正です' }, { status: 400 })
      const trimmed = name.trim()
      if (!trimmed) return NextResponse.json({ error: 'ワークスペース名は必須です' }, { status: 400 })
      if (trimmed.length > 100) return NextResponse.json({ error: 'ワークスペース名は100文字以内' }, { status: 400 })
      updateData.name = trimmed
    }

    if (slug !== undefined) {
      if (typeof slug !== 'string') return NextResponse.json({ error: 'スラッグの形式が不正です' }, { status: 400 })
      const trimmed = slug.trim().toLowerCase()
      if (!trimmed) return NextResponse.json({ error: 'スラッグは必須です' }, { status: 400 })
      if (!/^[a-z0-9][a-z0-9-]{2,49}$/.test(trimmed)) {
        return NextResponse.json({ error: 'スラッグは半角英数字とハイフン、3〜50文字' }, { status: 400 })
      }
      updateData.slug = trimmed
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '変更項目がありません' }, { status: 400 })
    }

    const result = await retryWorkspaceTransaction(() => prisma.$transaction(async tx => {
      const member = await tx.promaneMember.findFirst({
        where: { workspaceId: id, userId, isActive: true, role: { in: ['owner', 'admin'] } },
        select: { id: true },
      })
      if (!member) return { status: 403 as const, error: 'ワークスペース設定の編集権限がありません' }
      if (updateData.slug) {
        const existing = await tx.promaneWorkspace.findFirst({
          where: { slug: updateData.slug, NOT: { id } }, select: { id: true },
        })
        if (existing) return { status: 409 as const, error: 'このスラッグは既に使われています' }
      }
      const updated = await tx.promaneWorkspace.update({
        where: { id }, data: updateData, select: { id: true, name: true, slug: true },
      })
      return { status: 200 as const, workspace: updated }
    }, { isolationLevel: 'Serializable' }))
    if (result.status !== 200) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ success: true, workspace: result.workspace })
  } catch (e: any) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
      return NextResponse.json({ error: 'このスラッグは既に使われています' }, { status: 409 })
    }
    console.error('[promane/workspaces/id][PATCH]')
    return NextResponse.json(
      { error: '設定の更新に失敗しました' },
      { status: 500 }
    )
  }
}
