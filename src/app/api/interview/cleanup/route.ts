import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * 最終更新から30日経過したプロジェクトとその関連データを削除するクリーンアップAPI
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

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const eligible = { updatedAt: { lt: thirtyDaysAgo } }

    // 運用前の件数確認。データや識別子は返さず、削除処理もしない。
    if (req.nextUrl.searchParams.get('dryRun') === '1') {
      const eligibleCount = await prisma.interviewProject.count({ where: eligible })
      return NextResponse.json({ success: true, dryRun: true, eligibleCount })
    }

    // 1回の実行で大量に削除せず、古いものから少数ずつ処理する。
    const expiredProjects = await prisma.interviewProject.findMany({
      where: eligible,
      orderBy: { updatedAt: 'asc' },
      take: 100,
      select: { id: true, materials: { where: { filePath: { not: null } }, select: { id: true }, take: 1 } },
    })

    if (expiredProjects.length === 0) {
      return NextResponse.json({
        success: true,
        message: '削除対象のプロジェクトはありません',
        deletedCount: 0,
      })
    }

    // DBのCASCADEだけではSupabase Storageのオブジェクトが残る。
    // 耐久的な再試行キューが入るまで、添付ファイルを含む一括削除を拒否する。
    if (expiredProjects.some(project => project.materials.length > 0)) {
      return NextResponse.json(
        { success: false, error: '添付ファイル付きプロジェクトの自動削除は安全確認中です', code: 'STORAGE_PURGE_REQUIRED' },
        { status: 409 }
      )
    }

    const projectIds = expiredProjects.map((p) => p.id)

    // カスケード削除（InterviewProject に onDelete: Cascade が設定されている関連テーブル）
    // InterviewMaterial, InterviewTranscription, InterviewDraft, InterviewReview
    const result = await prisma.interviewProject.deleteMany({
      // 一覧取得後に編集されたプロジェクトは削除しない。
      where: { id: { in: projectIds }, ...eligible },
    })

    console.log(`[interview-cleanup] Deleted ${result.count} projects inactive for 30 days`)

    return NextResponse.json({
      success: true,
      message: `${result.count}件のプロジェクトを削除しました`,
      deletedCount: result.count,
    })
  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json(
      { success: false, error: 'クリーンアップ処理中にエラーが発生しました' },
      { status: 500 }
    )
  }
}
