import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * 30日経過したプロジェクトとその関連データを削除するクリーンアップAPI
 * Vercel Cron や外部スケジューラから定期的に呼び出す
 * Authorization: Bearer <CRON_SECRET> で保護
 */
export async function POST(req: NextRequest) {
  try {
    // 認証チェック（Vercel Cronまたはシークレットトークン）
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      return NextResponse.json({ success: false, error: 'CRON_SECRETが未設定です' }, { status: 503 })
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: '認証エラー' }, { status: 401 })
    }

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // 30日以上前のプロジェクトを検索
    const expiredProjects = await prisma.interviewProject.findMany({
      where: { createdAt: { lt: thirtyDaysAgo } },
      select: { id: true, title: true, createdAt: true },
    })

    if (expiredProjects.length === 0) {
      return NextResponse.json({
        success: true,
        message: '削除対象のプロジェクトはありません',
        deletedCount: 0,
      })
    }

    const projectIds = expiredProjects.map((p) => p.id)

    // カスケード削除（InterviewProject に onDelete: Cascade が設定されている関連テーブル）
    // InterviewMaterial, InterviewTranscription, InterviewDraft, InterviewReview
    const result = await prisma.interviewProject.deleteMany({
      where: { id: { in: projectIds } },
    })

    console.log(`[interview-cleanup] Deleted ${result.count} projects older than 30 days`)

    return NextResponse.json({
      success: true,
      message: `${result.count}件のプロジェクトを削除しました`,
      deletedCount: result.count,
    })
  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'クリーンアップ処理中にエラーが発生しました' },
      { status: 500 }
    )
  }
}
