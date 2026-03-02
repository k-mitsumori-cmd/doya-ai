import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // 最初の10件のテンプレートを取得して、imageUrlの状態を確認
    const templates = await prisma.bannerTemplate.findMany({
      take: 10,
      select: {
        templateId: true,
        imageUrl: true,
        industry: true,
      },
    })

    // 画像タイプ別の統計
    let stats = {
      total: templates.length,
      base64: 0,
      https: 0,
      http: 0,
      local: 0,
      null: 0,
      unknown: 0,
      hasValidBase64: 0,
    }

    const debugInfo = templates.map(t => {
      let imageUrlType = 'null'
      let isValidBase64 = false
      
      if (t.imageUrl) {
        if (t.imageUrl.startsWith('data:image/')) {
          imageUrlType = 'base64'
          stats.base64++
          // base64が有効かチェック
          const matches = t.imageUrl.match(/^data:image\/(\w+);base64,(.+)$/)
          if (matches && matches[2] && matches[2].length > 100) {
            isValidBase64 = true
            stats.hasValidBase64++
          }
        } else if (t.imageUrl.startsWith('https://')) {
          imageUrlType = 'https'
          stats.https++
        } else if (t.imageUrl.startsWith('http://')) {
          imageUrlType = 'http'
          stats.http++
        } else if (t.imageUrl.startsWith('/')) {
          imageUrlType = 'local'
          stats.local++
        } else {
          imageUrlType = 'unknown'
          stats.unknown++
        }
      } else {
        stats.null++
      }
      
      return {
        templateId: t.templateId,
        industry: t.industry,
        imageUrlType,
        imageUrlLength: t.imageUrl?.length || 0,
        isValidBase64,
        imageUrlPreview: t.imageUrl?.substring(0, 80) || 'null',
      }
    })

    return NextResponse.json({
      stats,
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
