import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getRenderJob } from '@/lib/movie/render'
import { getGuestIdFromRequest } from '@/lib/movie/access'

// GET /api/movie/render/[jobId]/download
export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params
    const job = await getRenderJob(jobId)

    if (!job) {
      return NextResponse.json({ error: 'ジョブが見つかりません' }, { status: 404 })
    }

    // 所有権確認: プロジェクトのオーナーかどうかチェック
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

    // レンダリング完了チェック
    if (job.status !== 'completed') {
      return NextResponse.json(
        {
          error: 'レンダリングが完了していません',
          status: job.status,
          progress: job.progress,
        },
        { status: 400 }
      )
    }

    if (!job.outputUrl) {
      return NextResponse.json({ error: '動画URLが見つかりません' }, { status: 404 })
    }

    // outputUrl からファイルを取得してストリームで返す
    const fileResponse = await fetch(job.outputUrl)
    if (!fileResponse.ok) {
      console.error(
        '[GET /api/movie/render/[jobId]/download] Failed to fetch output file:',
        fileResponse.status,
        fileResponse.statusText
      )
      return NextResponse.json({ error: '動画ファイルの取得に失敗しました' }, { status: 502 })
    }

    const contentType =
      job.format === 'gif' ? 'image/gif' : 'video/mp4'
    const extension = job.format === 'gif' ? 'gif' : 'mp4'
    const fileName = `doya-movie-${job.projectId.slice(0, 8)}.${extension}`

    const fileBuffer = await fileResponse.arrayBuffer()

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(fileBuffer.byteLength),
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.error('[GET /api/movie/render/[jobId]/download]', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
