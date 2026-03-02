import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// DELETE: エラープレースホルダーURLを持つテンプレートを削除
export async function DELETE(request: NextRequest) {
  try {
    // エラープレースホルダーURLを持つテンプレートを検索
    const errorTemplates = await prisma.bannerTemplate.findMany({
      where: {
        imageUrl: {
          contains: 'placehold.co',
        },
      },
      select: {
        templateId: true,
        imageUrl: true,
      },
    })

    // エラープレースホルダーを持つテンプレートを削除
    const deleteResult = await prisma.bannerTemplate.deleteMany({
      where: {
        imageUrl: {
          contains: 'placehold.co',
        },
      },
    })

    console.log(`[Cleanup API] Deleted ${deleteResult.count} error templates`)

    return NextResponse.json({
      success: true,
      message: `${deleteResult.count}件のエラーテンプレートを削除しました`,
      deletedCount: deleteResult.count,
      deletedTemplates: errorTemplates.map(t => t.templateId),
    })
  } catch (err: any) {
    console.error('[Cleanup API] Error:', err)
    return NextResponse.json(
      {
        error: err.message || 'クリーンアップに失敗しました',
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      },
      { status: 500 }
    )
  }
}

// GET: エラープレースホルダーURLを持つテンプレートの数を取得
export async function GET(request: NextRequest) {
  try {
    const errorCount = await prisma.bannerTemplate.count({
      where: {
        imageUrl: {
          contains: 'placehold.co',
        },
      },
    })

    const totalCount = await prisma.bannerTemplate.count()

    return NextResponse.json({
      totalCount,
      errorCount,
      validCount: totalCount - errorCount,
    })
  } catch (err: any) {
    console.error('[Cleanup API] Error:', err)
    return NextResponse.json(
      {
        error: err.message || '取得に失敗しました',
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      },
      { status: 500 }
    )
  }
}
