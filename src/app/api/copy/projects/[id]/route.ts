// ============================================
// GET/PUT/DELETE /api/copy/projects/[id]
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - プロジェクト詳細（コピー一覧含む）
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    const project = await prisma.copyProject.findUnique({
      where: { id: params.id },
      include: {
        copies: {
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { copies: true } },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    // ユーザーのプロジェクトかゲストのプロジェクトのみアクセス許可
    if (project.userId && project.userId !== userId) {
      return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 })
    }

    return NextResponse.json({ project })
  } catch (error: any) {
    console.error('Copy projects [id] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - プロジェクト更新
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

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

    const body = await req.json()
    const { name, status, regulations, copyItemId, isFavorite } = body

    // コピーアイテムのお気に入り更新
    if (copyItemId !== undefined && isFavorite !== undefined) {
      // copyItemが当該プロジェクトに属することを確認
      const copyItem = await prisma.copyItem.findUnique({
        where: { id: copyItemId },
        select: { projectId: true },
      })
      if (!copyItem || copyItem.projectId !== params.id) {
        return NextResponse.json({ error: 'コピーが見つかりません' }, { status: 404 })
      }
      await prisma.copyItem.update({
        where: { id: copyItemId },
        data: { isFavorite },
      })
      return NextResponse.json({ success: true })
    }

    const updated = await prisma.copyProject.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(status !== undefined && { status }),
        ...(regulations !== undefined && { regulations }),
      },
    })

    return NextResponse.json({ success: true, project: updated })
  } catch (error: any) {
    console.error('Copy projects [id] PUT error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - プロジェクト削除
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

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

    await prisma.copyProject.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Copy projects [id] DELETE error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
