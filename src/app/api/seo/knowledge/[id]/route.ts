import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await ensureSeoSchema()
    const session = await getServerSession(authOptions)
    const userId = String((session?.user as any)?.id || '')
    if (!userId) {
      return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
    }

    const id = ctx.params.id
    const item = await (prisma as any).seoKnowledgeItem.findUnique({ where: { id } })
    if (!item) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    if (String(item.userId || '') !== userId) {
      return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 })
    }

    await (prisma as any).seoKnowledgeItem.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || '不明なエラー' },
      { status: 500 }
    )
  }
}


