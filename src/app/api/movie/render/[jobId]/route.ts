import { NextRequest, NextResponse } from 'next/server'
import { getRenderJob } from '@/lib/movie/render'

// GET /api/movie/render/[jobId] - レンダリング進捗ポーリング
export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params
    const job = await getRenderJob(jobId)

    if (!job) return NextResponse.json({ error: 'ジョブが見つかりません' }, { status: 404 })

    return NextResponse.json({
      id: job.id,
      projectId: job.projectId,
      status: job.status,
      progress: job.progress,
      outputUrl: job.outputUrl,
      format: job.format,
      error: job.error,
      createdAt: job.createdAt.toISOString(),
    })
  } catch (error) {
    console.error('[GET /api/movie/render/[jobId]]', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
