// ============================================
// POST /api/copy/brushup
// ============================================
// コピーをSSEストリーミングでブラッシュアップ

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { brushupCopy } from '@/lib/copy/gemini'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    const { copyItemId, instruction, productInfo } = await req.json()

    if (!copyItemId || !instruction) {
      return NextResponse.json({ error: 'copyItemIdとinstructionは必須です' }, { status: 400 })
    }

    // コピーアイテム取得
    const copyItem = await prisma.copyItem.findUnique({
      where: { id: copyItemId },
      include: { project: { select: { userId: true } } },
    })

    if (!copyItem) {
      return NextResponse.json({ error: 'コピーが見つかりません' }, { status: 404 })
    }

    if (copyItem.project.userId && copyItem.project.userId !== userId) {
      return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 })
    }

    // ブラッシュアップ実行
    const brushed = await brushupCopy(
      {
        headline: copyItem.headline || '',
        description: copyItem.description || '',
        catchcopy: copyItem.catchcopy || '',
        cta: copyItem.cta || '',
      },
      instruction,
      productInfo || {
        productName: '商品',
        category: 'その他',
        targetAudience: '一般ユーザー',
        mainBenefit: 'ベネフィット',
        features: [],
        priceRange: '要問合せ',
        tone: 'professional',
        uniqueValue: '',
      },
    )

    // リビジョン履歴に追記
    const existingRevisions = (copyItem.revisions as any[]) || []
    const newRevision = {
      instruction,
      before: {
        headline: copyItem.headline,
        description: copyItem.description,
        catchcopy: copyItem.catchcopy,
        cta: copyItem.cta,
      },
      after: brushed,
      createdAt: new Date().toISOString(),
    }

    // コピーアイテムを更新
    const updated = await prisma.copyItem.update({
      where: { id: copyItemId },
      data: {
        headline: brushed.headline,
        description: brushed.description,
        catchcopy: brushed.catchcopy,
        cta: brushed.cta,
        revisions: [...existingRevisions, newRevision] as any,
      },
    })

    return NextResponse.json({ success: true, copy: updated })
  } catch (error: any) {
    console.error('Copy brushup error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
