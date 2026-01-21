import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// DELETE: 全ての生成済みテンプレート画像を削除
// 注意: このAPIは開発・テスト用です。本番環境では適切な認証を追加してください。
export async function DELETE(request: NextRequest) {
  try {
    // 認証チェックは一時的に無効化（テスト用）
    // TODO: 本番環境では認証を有効化する

    // 削除前のカウント
    const beforeCount = await prisma.bannerTemplate.count()
    
    // 全てのBannerTemplateレコードを削除
    const result = await prisma.bannerTemplate.deleteMany({})
    
    console.log(`[Clear Templates] Deleted ${result.count} templates`)
    
    return NextResponse.json({
      success: true,
      message: `${result.count}件のテンプレートを削除しました`,
      deletedCount: result.count,
      beforeCount,
    })
  } catch (err: any) {
    console.error('[Clear Templates] Error:', err)
    return NextResponse.json(
      { 
        error: err.message || '削除に失敗しました',
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      }, 
      { status: 500 }
    )
  }
}

// GET: 現在のテンプレート数を確認
export async function GET(request: NextRequest) {
  try {
    const count = await prisma.bannerTemplate.count()
    const templates = await prisma.bannerTemplate.findMany({
      select: {
        templateId: true,
        industry: true,
        category: true,
        createdAt: true,
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    })
    
    return NextResponse.json({
      totalCount: count,
      recentTemplates: templates,
    })
  } catch (err: any) {
    console.error('[Clear Templates] Count error:', err)
    return NextResponse.json(
      { error: err.message || 'カウントに失敗しました' }, 
      { status: 500 }
    )
  }
}
