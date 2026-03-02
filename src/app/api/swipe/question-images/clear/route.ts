import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * 質問用画像をDBから削除するAPI（管理用）
 * - 既存の画像は一旦使わない方針のため、全削除 or カテゴリ削除を提供
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

