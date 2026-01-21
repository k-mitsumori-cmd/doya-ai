import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// カテゴリに基づくフォールバック画像
const FALLBACK_IMAGES: Record<string, string> = {
  ec: '/banner-samples/cat-ec.png',
  it: '/banner-samples/cat-it.png',
  beauty: '/banner-samples/cat-beauty.png',
  recruit: '/banner-samples/cat-marketing.png',
  marketing: '/banner-samples/cat-marketing.png',
  default: '/banner-samples/cat-it.png',
}

// templateIdからカテゴリを推測
function getCategoryFromTemplateId(templateId: string): string {
  const prefix = templateId.split('-')[0]
  const categoryMap: Record<string, string> = {
    fashion: 'ec',
    beauty: 'beauty',
    food: 'ec',
    it: 'it',
    business: 'it',
    recruit: 'recruit',
    education: 'it',
    travel: 'ec',
    luxury: 'beauty',
    natural: 'beauty',
  }
  return categoryMap[prefix] || 'default'
}

export async function GET(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const { templateId } = params
  
  if (!templateId) {
    return NextResponse.json({ error: 'templateId is required' }, { status: 400 })
  }
  
  // templateIdからカテゴリを推測（DBエラー時のフォールバック用）
  const inferredCategory = getCategoryFromTemplateId(templateId)
  
  try {
    // DBから画像を取得
    const template = await prisma.bannerTemplate.findUnique({
      where: { templateId },
      select: { imageUrl: true, category: true },
    })
    
    // DBに画像がない場合はフォールバック画像にリダイレクト
    if (!template?.imageUrl) {
      const category = template?.category || inferredCategory
      const fallbackUrl = FALLBACK_IMAGES[category] || FALLBACK_IMAGES.default
      return NextResponse.redirect(new URL(fallbackUrl, request.url))
    }
    
    const imageUrl = template.imageUrl
    
    // エラープレースホルダーの場合はフォールバック画像にリダイレクト
    if (imageUrl.includes('placehold.co') && imageUrl.includes('Error')) {
      const category = template?.category || inferredCategory
      const fallbackUrl = FALLBACK_IMAGES[category] || FALLBACK_IMAGES.default
      return NextResponse.redirect(new URL(fallbackUrl, request.url))
    }
    
    // base64画像の場合
    if (imageUrl.startsWith('data:image/')) {
      // data:image/png;base64,... 形式からバイナリに変換
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
    
    // ローカルパスの場合
    if (imageUrl.startsWith('/')) {
      return NextResponse.redirect(new URL(imageUrl, request.url))
    }
    
    return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 })
  } catch (err: any) {
    // DBエラーの場合はフォールバック画像にリダイレクト
    console.error('[Image API] Error:', err)
    const fallbackUrl = FALLBACK_IMAGES[inferredCategory] || FALLBACK_IMAGES.default
    return NextResponse.redirect(new URL(fallbackUrl, request.url))
  }
}
