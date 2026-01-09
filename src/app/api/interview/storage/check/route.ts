import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ストレージ使用状況をチェック
export async function GET(request: NextRequest) {
  try {
    // すべての素材のファイルサイズを合計
    const materials = await prisma.interviewMaterial.findMany({
      select: {
        fileSize: true,
      },
    })

    const totalSize = materials.reduce((sum, material) => {
      return sum + (material.fileSize || 0)
    }, 0)

    // Hobbyプランの制限（1GB = 1024 * 1024 * 1024 bytes）
    const HOBBY_PLAN_LIMIT = 1024 * 1024 * 1024
    const usagePercent = (totalSize / HOBBY_PLAN_LIMIT) * 100
    const remainingBytes = Math.max(0, HOBBY_PLAN_LIMIT - totalSize)

    return NextResponse.json({
      totalSize,
      limit: HOBBY_PLAN_LIMIT,
      remainingBytes,
      usagePercent: Math.round(usagePercent * 100) / 100,
      isNearLimit: usagePercent > 80,
      isOverLimit: totalSize >= HOBBY_PLAN_LIMIT,
      materialCount: materials.length,
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

