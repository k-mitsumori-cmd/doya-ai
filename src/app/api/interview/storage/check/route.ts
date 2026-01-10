import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getGCSUsage } from '@/lib/gcs'

// ストレージ使用状況をチェック
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    // データベースから素材のファイルサイズを合計
    const materials = await prisma.interviewMaterial.findMany({
      select: {
        fileSize: true,
      },
    })

    const dbTotalSize = materials.reduce((sum, material) => {
      return sum + (material.fileSize || 0)
    }, 0)

    // GCSから実際の使用状況を取得（オプション）
    let gcsUsage: { totalSize: number; fileCount: number } | null = null
    try {
      gcsUsage = await getGCSUsage()
    } catch (error) {
      console.warn('[INTERVIEW] Failed to get GCS usage, using database values:', error)
    }

    // GCSの実際の使用量を使用（取得できた場合）、なければデータベースの値を使用
    const totalSize = gcsUsage?.totalSize || dbTotalSize
    const fileCount = gcsUsage?.fileCount || materials.length

    // Google Cloud Storageの制限（実質的に非常に大きい - 5TB）
    // ただし、コストを考慮して警告レベルを設定
    const GCS_LIMIT = 5 * 1024 * 1024 * 1024 * 1024 // 5TB
    const WARNING_THRESHOLD = 1 * 1024 * 1024 * 1024 * 1024 // 1TB（警告レベル）
    const CRITICAL_THRESHOLD = 4 * 1024 * 1024 * 1024 * 1024 // 4TB（危険レベル）

    const usagePercent = (totalSize / GCS_LIMIT) * 100
    const remainingBytes = Math.max(0, GCS_LIMIT - totalSize)
    const isNearLimit = totalSize > WARNING_THRESHOLD
    const isOverLimit = totalSize > CRITICAL_THRESHOLD

    // 3ヶ月経過したプロジェクトの数を確認
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    
    const oldProjectsCount = await prisma.interviewProject.count({
      where: {
        createdAt: {
          lt: threeMonthsAgo,
        },
      },
    })

    return NextResponse.json({
      totalSize,
      limit: GCS_LIMIT,
      remainingBytes,
      usagePercent: Math.round(usagePercent * 10000) / 100, // 小数点以下2桁
      isNearLimit,
      isOverLimit,
      materialCount: fileCount,
      oldProjectsCount, // 3ヶ月経過したプロジェクト数
      nextCleanup: '毎日午前2時（JST）に自動実行',
      note: 'Google Cloud Storageの容量制限は5TBです。3ヶ月経過したプロジェクトは自動的に削除されます。',
      costEstimate: {
        monthlyStorage: (totalSize / 1024 / 1024 / 1024) * 0.020, // $0.020/GB
        unit: 'USD',
      },
    })
  } catch (error) {
    console.error('[INTERVIEW] Storage check error:', error)
    return NextResponse.json(
      {
        error: 'ストレージ使用状況の取得に失敗しました',
        details: error instanceof Error ? error.message : '不明なエラー',
      },
      { status: 500 }
    )
  }
}

