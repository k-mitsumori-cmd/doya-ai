import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET: Nano Banana Proで生成されていないテンプレートの一覧を取得
 *
 * Nano Banana Proで生成された画像は base64 data URL（data:image/...）で格納される。
 * それ以外（null、空、プレースホルダー、外部URL等）は非Nano Banana Proとみなす。
 */
export async function GET() {
  try {
    const allTemplates = await prisma.bannerTemplate.findMany({
      select: {
        id: true,
        templateId: true,
        industry: true,
        imageUrl: true,
        createdAt: true,
      },
    })

    const nonNano: typeof allTemplates = []
    const nano: typeof allTemplates = []

    for (const t of allTemplates) {
      const url = t.imageUrl || ''
      // Nano Banana Proで生成された画像は data:image/ で始まるbase64
      if (url.startsWith('data:image/')) {
        nano.push(t)
      } else {
        nonNano.push(t)
      }
    }

    return NextResponse.json({
      totalCount: allTemplates.length,
      nanoCount: nano.length,
      nonNanoCount: nonNano.length,
      nonNanoTemplates: nonNano.map((t) => ({
        id: t.id,
        templateId: t.templateId,
        industry: t.industry,
        imageUrlPrefix: (t.imageUrl || '').substring(0, 80),
        createdAt: t.createdAt,
      })),
    })
  } catch (err: any) {
    console.error('[Cleanup Non-Nano] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * DELETE: Nano Banana Proで生成されていないテンプレートを一括削除
 */
export async function DELETE() {
  try {
    // まず対象を特定
    const allTemplates = await prisma.bannerTemplate.findMany({
      select: {
        id: true,
        templateId: true,
        imageUrl: true,
      },
    })

    const nonNanoIds: string[] = []
    for (const t of allTemplates) {
      const url = t.imageUrl || ''
      if (!url.startsWith('data:image/')) {
        nonNanoIds.push(t.id)
      }
    }

    if (nonNanoIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: '削除対象のテンプレートはありませんでした',
        deletedCount: 0,
      })
    }

    const deleteResult = await prisma.bannerTemplate.deleteMany({
      where: {
        id: { in: nonNanoIds },
      },
    })

    console.log(`[Cleanup Non-Nano] Deleted ${deleteResult.count} non-Nano Banana Pro templates`)

    return NextResponse.json({
      success: true,
      message: `${deleteResult.count}件のNano Banana Pro以外のテンプレートを削除しました`,
      deletedCount: deleteResult.count,
    })
  } catch (err: any) {
    console.error('[Cleanup Non-Nano] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
