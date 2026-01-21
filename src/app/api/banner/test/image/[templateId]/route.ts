import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ジャンルに基づくフォールバックテンプレートID（DBの高品質画像を使用）
const FALLBACK_TEMPLATE_IDS: Record<string, string> = {
  fashion: 'fashion-001',
  beauty: 'beauty-001',
  food: 'food-001',
  it: 'it-001',
  business: 'business-001',
  recruit: 'recruit-001',
  education: 'education-001',
  travel: 'travel-001',
  luxury: 'luxury-001',
  natural: 'natural-001',
}

// templateIdからジャンルを推測
function getGenreFromTemplateId(templateId: string): string {
  const prefix = templateId.split('-')[0]
  return prefix || 'it'
}

// フォールバック画像を取得する関数（DBから別のテンプレートの画像を取得）
async function getFallbackImage(genre: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const fallbackTemplateId = FALLBACK_TEMPLATE_IDS[genre] || FALLBACK_TEMPLATE_IDS.it
  
  try {
    const fallbackTemplate = await prisma.bannerTemplate.findUnique({
      where: { templateId: fallbackTemplateId },
      select: { imageUrl: true },
    })
    
    if (fallbackTemplate?.imageUrl?.startsWith('data:image/')) {
      const matches = fallbackTemplate.imageUrl.match(/^data:image\/(\w+);base64,(.+)$/)
      if (matches) {
        const [, mimeType, base64Data] = matches
        return { buffer: Buffer.from(base64Data, 'base64'), mimeType }
      }
    }
  } catch (e) {
    console.error('[Image API] Fallback fetch error:', e)
  }
  
  return null
}

export async function GET(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const { templateId } = params
  
  if (!templateId) {
    return NextResponse.json({ error: 'templateId is required' }, { status: 400 })
  }
  
  // templateIdからジャンルを推測（DBエラー時のフォールバック用）
  const inferredGenre = getGenreFromTemplateId(templateId)
  
  try {
    // DBから画像を取得
    const template = await prisma.bannerTemplate.findUnique({
      where: { templateId },
      select: { imageUrl: true, category: true },
    })
    
    // DBに画像がない場合またはエラープレースホルダーの場合
    const imageUrl = template?.imageUrl
    const needsFallback = !imageUrl || 
      (imageUrl.includes('placehold.co') && imageUrl.includes('Error'))
    
    if (needsFallback) {
      // DBから同じジャンルの別の画像をフォールバックとして取得
      const fallback = await getFallbackImage(inferredGenre)
      if (fallback) {
        return new NextResponse(fallback.buffer, {
          headers: {
            'Content-Type': `image/${fallback.mimeType}`,
            'Cache-Control': 'public, max-age=3600',
          },
        })
      }
      // フォールバックも取得できない場合は透明な1x1 PNG
      const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
      return new NextResponse(transparentPng, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=60',
        },
      })
    }
    
    // base64画像の場合
    if (imageUrl.startsWith('data:image/')) {
      const matches = imageUrl.match(/^data:image\/(\w+);base64,(.+)$/)
      if (!matches) {
        return NextResponse.json({ error: 'Invalid image format' }, { status: 400 })
      }
      
      const [, mimeType, base64Data] = matches
      const buffer = Buffer.from(base64Data, 'base64')
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': `image/${mimeType}`,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    }
    
    // 外部URLの場合はリダイレクト
    if (imageUrl.startsWith('https://') || imageUrl.startsWith('http://')) {
      return NextResponse.redirect(imageUrl)
    }
    
    // ローカルパスの場合はリダイレクト
    if (imageUrl.startsWith('/')) {
      return NextResponse.redirect(new URL(imageUrl, request.url))
    }
    
    return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 })
  } catch (err: any) {
    // DBエラーの場合はフォールバック画像を取得
    console.error('[Image API] Error:', err)
    const fallback = await getFallbackImage(inferredGenre)
    if (fallback) {
      return new NextResponse(fallback.buffer, {
        headers: {
          'Content-Type': `image/${fallback.mimeType}`,
          'Cache-Control': 'public, max-age=3600',
        },
      })
    }
    // フォールバックも取得できない場合は透明な1x1 PNG
    const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
    return new NextResponse(transparentPng, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=60',
      },
    })
  }
}
