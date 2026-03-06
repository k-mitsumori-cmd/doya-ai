// ============================================
// DELETE /api/copy/projects/[id]/items/[itemId]
// ============================================
// コピーアイテムを個別に削除する

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id

    // プロジェクトの所有権確認
    const project = await prisma.copyProject.findUnique({
      where: { id: params.id },
      select: { userId: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    if (project.userId && project.userId !== userId) {
      return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 })
    }

    // コピーアイテムが該当プロジェクトに属するか確認
    const copyItem = await prisma.copyItem.findUnique({
      where: { id: params.itemId },
      select: { projectId: true },
    })

    if (!copyItem) {
      return NextResponse.json({ error: 'コピーが見つかりません' }, { status: 404 })
    }

    if (copyItem.projectId !== params.id) {
      return NextResponse.json({ error: 'コピーが指定されたプロジェクトに属していません' }, { status: 400 })
    }

    // 削除実行
    await prisma.copyItem.delete({ where: { id: params.itemId } })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Copy item DELETE error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
