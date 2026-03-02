import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getGuestIdFromRequest } from '@/lib/movie/access'
import type { SceneData } from '@/lib/movie/types'

// POST /api/movie/preview - プレビュー用データ取得（シーン保存）
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { projectId, scenes } = body as { projectId: string; scenes: SceneData[] }

    if (!projectId || !scenes) {
      return NextResponse.json({ error: 'projectIdとscenesが必要です' }, { status: 400 })
    }

    // 所有権確認
    const session = await getServerSession(authOptions)
    const guestId = getGuestIdFromRequest(req)
    let userId: string | null = null
    if (session?.user?.email) {
      const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
      userId = user?.id ?? null
    }
    const project = await prisma.movieProject.findUnique({ where: { id: projectId } })
    if (!project) return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    const isOwner = (userId && project.userId === userId) || (guestId && project.guestId === guestId)
    if (!isOwner) return NextResponse.json({ error: 'アクセス権がありません' }, { status: 403 })

    // シーンをDBに保存
    await prisma.movieScene.deleteMany({ where: { projectId } })
    await prisma.movieScene.createMany({
      data: scenes.map(s => ({
        projectId,
        order: s.order,
        duration: s.duration,
        bgType: s.bgType,
        bgValue: s.bgValue,
        bgAnimation: s.bgAnimation,
        texts: s.texts as never,
        narrationText: s.narrationText,
        transition: s.transition,
      })),
    })

    return NextResponse.json({ success: true, sceneCount: scenes.length })
  } catch (error) {
    console.error('[POST /api/movie/preview]', error)
    return NextResponse.json({ error: 'プレビュー保存に失敗しました' }, { status: 500 })
  }
}
