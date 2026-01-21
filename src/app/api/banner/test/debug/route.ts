import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // 最初の5件のテンプレートを取得して、imageUrlの状態を確認
    const templates = await prisma.bannerTemplate.findMany({
      take: 5,
      select: {
        templateId: true,
        imageUrl: true,
        industry: true,
      },
    })

    const debugInfo = templates.map(t => ({
      templateId: t.templateId,
      industry: t.industry,
      imageUrlType: t.imageUrl ? (
        t.imageUrl.startsWith('data:image/') ? 'base64' :
        t.imageUrl.startsWith('https://') ? 'https' :
        t.imageUrl.startsWith('http://') ? 'http' :
        t.imageUrl.startsWith('/') ? 'local' :
        'unknown'
      ) : 'null',
      imageUrlLength: t.imageUrl?.length || 0,
      imageUrlPreview: t.imageUrl?.substring(0, 100) || 'null',
    }))

    return NextResponse.json({
      count: templates.length,
      templates: debugInfo,
    })
  } catch (err: any) {
    console.error('[Debug API] Error:', err)
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    )
  }
}
