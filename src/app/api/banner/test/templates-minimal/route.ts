import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireBannerAdmin } from '@/lib/banner-admin-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const denied = requireBannerAdmin(request)
  if (denied) return denied
  try {
    // DBから最小限のデータのみ取得
    const dbTemplates = await prisma.bannerTemplate.findMany({
      select: {
        templateId: true,
        industry: true,
        category: true,
        isFeatured: true,
        // imageUrl, previewUrl, prompt は除外（サイズ削減）
      },
      take: 100, // 100件に制限
    })
    
    const templates = dbTemplates.map((t) => ({
      id: t.templateId,
      industry: t.industry,
      category: t.category,
      isFeatured: t.isFeatured || false,
      // フォールバック画像を使用
      imageUrl: '/banner-samples/cat-it.webp',
      previewUrl: '/banner-samples/cat-it.webp',
    }))
    
    return NextResponse.json({
      templates,
      count: templates.length,
      message: 'Minimal response for testing',
    })
  } catch (err: any) {
    console.error('[Templates Minimal API] Error:', err)
    return NextResponse.json(
      { error: 'テンプレート診断情報を取得できませんでした。' },
      { status: 500 }
    )
  }
}
