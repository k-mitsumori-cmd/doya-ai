import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// DELETE: 全ての生成済みテンプレート画像を削除
export async function DELETE(request: NextRequest) {
  try {
    // 認証チェック（ADMIN_SECRETが設定されている場合のみ）
    const authHeader = request.headers.get('authorization')
    const adminSecret = process.env.ADMIN_SECRET
    if (adminSecret && authHeader !== `Bearer ${adminSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
