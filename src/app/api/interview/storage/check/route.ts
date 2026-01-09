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

    // Proプランの制限（実際の制限値はVercelの設定によるが、一般的にProプランでは大幅に増加）
    // 実際の制限値は動的に取得できないため、大きな値に設定（100GB）
    // 実際の制限に達した場合は、Vercel Blob Storageからエラーが返される
    const PRO_PLAN_LIMIT = 100 * 1024 * 1024 * 1024 // 100GB（Proプランでは通常これ以上の容量が利用可能）
    const usagePercent = (totalSize / PRO_PLAN_LIMIT) * 100
    const remainingBytes = Math.max(0, PRO_PLAN_LIMIT - totalSize)

    return NextResponse.json({
      totalSize,
      limit: PRO_PLAN_LIMIT,
      remainingBytes,
      usagePercent: Math.round(usagePercent * 100) / 100,
      isNearLimit: usagePercent > 80, // 80%以上で警告
      isOverLimit: false, // 実際の制限はVercel Blob Storageが判断
      materialCount: materials.length,
      note: '実際の容量制限はVercelのプラン設定によります。容量制限に達した場合は、Vercel Blob Storageからエラーが返されます。',
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

