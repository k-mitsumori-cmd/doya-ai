// ============================================
// ワイヤーフレーム生成ジョブのステータス確認API
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { getWireframeJob } from '@/lib/lp-site/wireframe-job-storage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60 // ステータス確認は短時間で完了

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobIdが必要です' },
        { status: 400 }
      )
    }

    // ジョブを取得
    const job = getWireframeJob(jobId)

    if (!job) {
      return NextResponse.json(
        { error: 'ワイヤーフレーム生成ジョブが見つかりません' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      wireframes: job.wireframes,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    })
  } catch (error: any) {
    console.error('[LP-SITE] ワイヤーフレーム生成ジョブステータス取得エラー:', error)
    return NextResponse.json(
      {
        error: 'ワイヤーフレーム生成ジョブステータスの取得に失敗しました',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

