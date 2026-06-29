export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function GET(req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const id = p.id

  try {
    // DoyalistTemplate に公開(isPublic)概念は無く、一覧も userId 所有のみを返すため、取得も所有者に限定する
    const template = await prisma.doyalistTemplate.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!template) {
      return NextResponse.json({ error: 'テンプレートが見つかりません' }, { status: 404 })
    }

    return NextResponse.json(template)
  } catch (error) {
    console.error('Template get error:', error)
    return NextResponse.json({ error: 'テンプレートの取得に失敗しました' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const id = p.id

  try {
    // Verify ownership
    const existing = await prisma.doyalistTemplate.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'テンプレートが見つからないか、編集権限がありません' }, { status: 404 })
    }

    const { title, description, criteria } = await req.json()

    const updateData: Record<string, any> = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (criteria !== undefined) {
      if (typeof criteria !== 'object') {
        return NextResponse.json({ error: '条件（criteria）は有効なオブジェクトである必要があります' }, { status: 400 })
      }
      updateData.criteria = criteria
    }

    const template = await prisma.doyalistTemplate.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(template)
  } catch (error) {
    console.error('Template update error:', error)
    return NextResponse.json({ error: 'テンプレートの更新に失敗しました' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const id = p.id

  try {
    // Verify ownership
    const existing = await prisma.doyalistTemplate.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'テンプレートが見つからないか、削除権限がありません' }, { status: 404 })
    }

    await prisma.doyalistTemplate.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Template delete error:', error)
    return NextResponse.json({ error: 'テンプレートの削除に失敗しました' }, { status: 500 })
  }
}
