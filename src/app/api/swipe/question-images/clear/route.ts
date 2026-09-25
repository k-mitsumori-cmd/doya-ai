import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import prisma from '@/lib/prisma'

/**
 * 質問用画像をDBから削除するAPI（管理用）
 * - 既存の画像は一旦使わない方針のため、全削除 or カテゴリ削除を提供
 */
export async function POST(req: NextRequest) {
  try {
    const denied = await requireAdmin()
    if (denied) return denied

    const body = await req.json().catch(() => ({}))
    const category = typeof body?.category === 'string' && body.category.trim() ? body.category.trim() : null

    const result = await prisma.swipeQuestionImage.deleteMany({
      where: category ? { category } : undefined,
    })

    return NextResponse.json({
      success: true,
      deleted: result.count,
      category: category ?? 'ALL',
    })
  } catch (error: any) {
    console.error('[question-images/clear] error:', error)
    return NextResponse.json(
      { error: '画像の削除に失敗しました。' },
      { status: 503 }
    )
  }
}
