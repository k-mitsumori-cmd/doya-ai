import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ジャンルに基づく静的フォールバック画像（publicフォルダ内）
const STATIC_FALLBACK_IMAGES: Record<string, string> = {
  fashion: '/banner-samples/cat-ec.png',
  beauty: '/banner-samples/cat-beauty.png',
  food: '/banner-samples/cat-food.png',
  it: '/banner-samples/cat-it.png',
  business: '/banner-samples/cat-marketing.png',
  recruit: '/banner-samples/cat-marketing.png',
  education: '/banner-samples/cat-education.png',
  travel: '/banner-samples/cat-ec.png',
  luxury: '/banner-samples/cat-beauty.png',
  natural: '/banner-samples/cat-health.png',
  default: '/banner-samples/cat-it.png',
}

// templateIdからジャンルを推測
function getGenreFromTemplateId(templateId: string): string {
  const prefix = templateId.split('-')[0]
  return prefix || 'it'
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
  const staticFallbackUrl = STATIC_FALLBACK_IMAGES[inferredGenre] || STATIC_FALLBACK_IMAGES.default
  
  try {
    // DBから画像を取得
    const template = await prisma.bannerTemplate.findUnique({
      where: { templateId },
      select: { imageUrl: true, category: true, updatedAt: true },
    })
    
    // DBに画像がない場合またはエラープレースホルダーの場合
    const imageUrl = template?.imageUrl
    const needsFallback = !imageUrl || 
      (imageUrl.includes('placehold.co') && imageUrl.includes('Error'))
    
    if (needsFallback) {
      // 静的フォールバック画像にリダイレクト
      console.log(`[Image API] No valid image for ${templateId}, redirecting to fallback: ${staticFallbackUrl}`)
      return NextResponse.redirect(new URL(staticFallbackUrl, request.url))
    }
    
    // base64画像の場合
    if (imageUrl.startsWith('data:image/')) {
      const matches = imageUrl.match(/^data:image\/(\w+);base64,(.+)$/)
      if (!matches) {
        console.error(`[Image API] Invalid base64 format for ${templateId}`)
        return NextResponse.redirect(new URL(staticFallbackUrl, request.url))
      }
      
      const [, mimeType, base64Data] = matches
      const buffer = Buffer.from(base64Data, 'base64')
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': `image/${mimeType}`,
          'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
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
    
    // 不明な形式の場合はフォールバック
    console.error(`[Image API] Unknown image URL format for ${templateId}: ${imageUrl.substring(0, 50)}...`)
    return NextResponse.redirect(new URL(staticFallbackUrl, request.url))
  } catch (err: any) {
    // DBエラーの場合は静的フォールバック画像にリダイレクト
    console.error(`[Image API] DB error for ${templateId}:`, err.message)
    return NextResponse.redirect(new URL(staticFallbackUrl, request.url))
  }
}
