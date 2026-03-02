import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createRenderJob, renderVideo, failRenderJob } from '@/lib/movie/render'
import { getGuestIdFromRequest } from '@/lib/movie/access'
import type { CompositionConfig } from '@/lib/movie/types'

export const maxDuration = 300 // Vercel Pro: 最大300秒

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const guestId = getGuestIdFromRequest(req)

    let userId: string | null = null
    if (session?.user?.email) {
      const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
      userId = user?.id ?? null
    }

    const body = await req.json()
    const { projectId, format = 'mp4', bgmUrl } = body

    // プロジェクト取得・権限確認
    const project = await prisma.movieProject.findUnique({
      where: { id: projectId },
      include: { scenes: { orderBy: { order: 'asc' } } },
    })

    if (!project) return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })

    const isOwner = (userId && project.userId === userId) || (guestId && project.guestId === guestId)
    if (!isOwner) return NextResponse.json({ error: 'アクセス権がありません' }, { status: 403 })

    // レンダリングJobを作成
    const job = await createRenderJob(projectId, format)

    // プロジェクトのstatusをrenderingに更新
    await prisma.movieProject.update({ where: { id: projectId }, data: { status: 'rendering' } })

    // 非同期でレンダリング実行（レスポンスはJobIDを即座に返す）
    const config: CompositionConfig = {
      projectId,
      scenes: project.scenes.map(s => ({
        id: s.id,
        order: s.order,
        duration: s.duration,
        bgType: s.bgType as 'image' | 'video' | 'color' | 'gradient',
        bgValue: s.bgValue ?? undefined,
        bgAnimation: (s.bgAnimation ?? 'none') as 'ken-burns' | 'zoom-in' | 'none',
        texts: (Array.isArray(s.texts) ? s.texts : []) as any[],
        narrationText: s.narrationText ?? undefined,
        narrationUrl: s.narrationUrl ?? undefined,
        transition: s.transition as 'fade' | 'slide' | 'wipe' | 'zoom' | 'none',
      })),
      aspectRatio: project.aspectRatio as '16:9' | '9:16' | '1:1' | '4:5',
      totalDuration: project.duration,
      fps: 30,
      ...(bgmUrl && { bgmUrl }),
    }

    // バックグラウンド実行（awaitしない）
    renderVideo(job.id, config, userId ?? guestId ?? 'guest', format).catch(async (err) => {
      console.error('[renderVideo]', err)
      await failRenderJob(job.id, String(err))
      await prisma.movieProject.update({ where: { id: projectId }, data: { status: 'failed' } })
    })

    return NextResponse.json({ jobId: job.id, status: 'queued' })
  } catch (error) {
    console.error('[POST /api/movie/render]', error)
    return NextResponse.json({ error: 'レンダリング開始に失敗しました' }, { status: 500 })
  }
}
