import { NextRequest, NextResponse } from 'next/server'
import { requireBannerAdmin } from '@/lib/banner-admin-guard'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// DELETE: 全ての生成済みテンプレート画像を削除
// ⚠️ 破壊的。requireBannerAdmin で管理者のみに制限している（2026-08-22 に追加）。
export async function DELETE(request: NextRequest) {
  // ⚠️ テンプレートを壊せる保守API。管理者以外は通さない
  //    （認証が無いまま本番に出ており、DELETE 1回で全件消える状態だった）
  const denied = requireBannerAdmin(request)
  if (denied) return denied

  try {
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
  // ⚠️ テンプレートを壊せる保守API。管理者以外は通さない
  //    （認証が無いまま本番に出ており、DELETE 1回で全件消える状態だった）
  const denied = requireBannerAdmin(request)
  if (denied) return denied

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
