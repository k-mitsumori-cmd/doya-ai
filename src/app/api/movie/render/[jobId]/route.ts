import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getRenderJob } from '@/lib/movie/render'
import { getGuestIdFromRequest } from '@/lib/movie/access'

// GET /api/movie/render/[jobId] - レンダリング進捗ポーリング
export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params
    const job = await getRenderJob(jobId)

    if (!job) return NextResponse.json({ error: 'ジョブが見つかりません' }, { status: 404 })

    // 所有権確認
    const session = await getServerSession(authOptions)
    const guestId = getGuestIdFromRequest(req)
    let userId: string | null = null
    if (session?.user?.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      })
      userId = user?.id ?? null
    }

    const project = await prisma.movieProject.findUnique({
      where: { id: job.projectId },
      select: { userId: true, guestId: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    const isOwner =
      (userId && project.userId === userId) ||
      (guestId && project.guestId === guestId)
    if (!isOwner) {
      return NextResponse.json({ error: 'アクセス権がありません' }, { status: 403 })
    }

    return NextResponse.json({
      id: job.id,
      projectId: job.projectId,
      status: job.status,
      progress: job.progress,
      outputUrl: job.outputUrl,
      format: job.format,
      error: job.error,
      startedAt: job.startedAt?.toISOString() ?? null,
      completedAt: job.completedAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
    })
  } catch (error) {
    console.error('[GET /api/movie/render/[jobId]]', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
