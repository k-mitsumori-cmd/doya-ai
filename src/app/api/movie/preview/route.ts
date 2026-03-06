import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getGuestIdFromRequest } from '@/lib/movie/access'
import type { SceneData } from '@/lib/movie/types'

// POST /api/movie/preview - プレビュー用データ保存（シーン＋プロジェクト状態更新）
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { projectId, scenes } = body as { projectId: string; scenes: SceneData[] }

    if (!projectId) {
      return NextResponse.json({ error: 'projectIdが必要です' }, { status: 400 })
    }

    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json({ error: 'scenesが必要です（空でない配列）' }, { status: 400 })
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

    // シーンをDBに保存（既存を削除して再作成）
    await prisma.movieScene.deleteMany({ where: { projectId } })
    await prisma.movieScene.createMany({
      data: scenes.map((s, i) => ({
        projectId,
        order: s.order ?? i,
        duration: s.duration,
        bgType: s.bgType,
        bgValue: s.bgValue,
        bgAnimation: s.bgAnimation,
        texts: s.texts as never,
        narrationText: s.narrationText,
        transition: s.transition,
        metadata: s.metadata as never,
      })),
    })

    // プロジェクトのステータスを editing に更新
    // プレビューサムネイル情報を最初のシーンから生成してJSON保存
    const firstScene = scenes[0]
    const thumbnailInfo = {
      bgType: firstScene.bgType,
      bgValue: firstScene.bgValue,
      mainText: firstScene.texts?.[0]?.content ?? '',
      sceneCount: scenes.length,
      totalDuration: scenes.reduce((sum, s) => sum + s.duration, 0),
      updatedAt: new Date().toISOString(),
    }

    await prisma.movieProject.update({
      where: { id: projectId },
      data: {
        status: project.status === 'draft' || project.status === 'planning' ? 'editing' : project.status,
        duration: Math.round(scenes.reduce((sum, s) => sum + s.duration, 0)),
        thumbnailUrl: JSON.stringify(thumbnailInfo),
      },
    })

    return NextResponse.json({
      success: true,
      sceneCount: scenes.length,
      totalDuration: scenes.reduce((sum, s) => sum + s.duration, 0),
      thumbnail: thumbnailInfo,
    })
  } catch (error) {
    console.error('[POST /api/movie/preview]', error)
    return NextResponse.json({ error: 'プレビュー保存に失敗しました' }, { status: 500 })
  }
}
