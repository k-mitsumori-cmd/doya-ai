import { NextRequest, NextResponse } from 'next/server'
import { getRenderJob } from '@/lib/movie/render'

// GET /api/movie/render/[jobId]/download
export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params
    const job = await getRenderJob(jobId)

    if (!job) return NextResponse.json({ error: 'ジョブが見つかりません' }, { status: 404 })
    if (job.status !== 'completed') return NextResponse.json({ error: 'レンダリングが完了していません' }, { status: 400 })
    if (!job.outputUrl) return NextResponse.json({ error: '動画URLが見つかりません' }, { status: 404 })

    return NextResponse.json({ downloadUrl: job.outputUrl, format: job.format })
  } catch (error) {
    console.error('[GET /api/movie/render/[jobId]/download]', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
