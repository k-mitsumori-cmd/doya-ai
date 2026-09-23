import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { enqueueInterviewProjectStoragePurge } from '@/lib/interview/storage-purge-queue'
import { preserveInterviewTranscriptionUsageBeforeDelete } from '@/lib/interview/transcription-budget'

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
      const [eligibleCount, withStorageCount] = await Promise.all([
        prisma.interviewProject.count({ where: eligible }),
        prisma.interviewProject.count({ where: { ...eligible, materials: { some: { filePath: { not: null } } } } }),
      ])
      return NextResponse.json({ success: true, dryRun: true, eligibleCount, withStorageCount })
    }

    if (process.env.INTERVIEW_RETENTION_DELETE_ENABLED !== '1' || req.nextUrl.searchParams.get('execute') !== '1') {
      return NextResponse.json(
        { success: false, error: '保存期間による削除は有効化されていません', code: 'RETENTION_DELETE_NOT_ENABLED' },
        { status: 409 }
      )
    }

    // 実行許可後も少数ずつ処理し、各削除とストレージ再試行記録を原子的に確定する。
    const expiredProjects = await prisma.interviewProject.findMany({
      where: eligible,
      orderBy: { updatedAt: 'asc' },
      take: 10,
      select: { id: true },
    })

    if (expiredProjects.length === 0) {
      return NextResponse.json({
        success: true,
        message: '削除対象のプロジェクトはありません',
        deletedCount: 0,
      })
    }

    let deletedCount = 0, skippedCount = 0, failedCount = 0
    for (const candidate of expiredProjects) {
      try {
        const deleted = await prisma.$transaction(async tx => {
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('interview-project-lifecycle'), hashtext(${candidate.id}))`
          const project = await tx.interviewProject.findUnique({
            where: { id: candidate.id },
            select: { id: true, userId: true, guestId: true, updatedAt: true },
          })
          if (!project || project.updatedAt >= thirtyDaysAgo) return false
          if (await tx.interviewMaterial.count({ where: { projectId: candidate.id, status: 'PROCESSING' } })) return false
          await preserveInterviewTranscriptionUsageBeforeDelete(tx, project)
          await enqueueInterviewProjectStoragePurge(tx, project)
          const result = await tx.interviewProject.deleteMany({ where: { id: candidate.id, ...eligible } })
          if (!result.count) throw new Error('Project changed during cleanup')
          return true
        })
        if (deleted) deletedCount++
        else skippedCount++
      } catch {
        failedCount++
      }
    }

    console.warn('[interview-cleanup] result', { deletedCount, skippedCount, failedCount })

    return NextResponse.json({
      success: failedCount === 0,
      deletedCount, skippedCount, failedCount,
    }, { status: failedCount ? 503 : 200 })
  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json(
      { success: false, error: 'クリーンアップ処理中にエラーが発生しました' },
      { status: 500 }
    )
  }
}
