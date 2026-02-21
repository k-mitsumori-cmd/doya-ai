import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
// force-dynamic を削除 → Vercel CDN が s-maxage に従いキャッシュする

// サーバーサイドメモリキャッシュ（同一インスタンス内でDBアクセスを削減）
const IMAGE_CACHE = new Map<string, { buffer: Buffer; contentType: string; ts: number }>()
const MEMORY_CACHE_TTL = 60 * 60 * 1000 // 1時間

// 静的フォールバック画像（生成中プレースホルダー）
const FALLBACK_IMAGE = '/banner-samples/generating-placeholder.png'

export async function GET(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const { templateId } = params

  if (!templateId) {
    return NextResponse.json({ error: 'templateId is required' }, { status: 400 })
  }

  // メモリキャッシュチェック
  const cached = IMAGE_CACHE.get(templateId)
  if (cached && Date.now() - cached.ts < MEMORY_CACHE_TTL) {
    return new NextResponse(cached.buffer, {
      headers: {
        'Content-Type': cached.contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        'X-Cache': 'HIT',
      },
    })
  }

  const staticFallbackUrl = FALLBACK_IMAGE

  try {
    // DBから画像を取得
    const template = await prisma.bannerTemplate.findUnique({
      where: { templateId },
      select: { imageUrl: true },
    })

    // DBに画像がない場合またはエラープレースホルダーの場合
    const imageUrl = template?.imageUrl
    const needsFallback = !imageUrl ||
      (imageUrl.includes('placehold.co') && imageUrl.includes('Error'))

    if (needsFallback) {
      return NextResponse.redirect(new URL(staticFallbackUrl, request.url))
    }

    // base64画像の場合
    if (imageUrl.startsWith('data:image/')) {
      const matches = imageUrl.match(/^data:image\/(\w+);base64,(.+)$/)
      if (!matches) {
        return NextResponse.redirect(new URL(staticFallbackUrl, request.url))
      }

      const [, mimeType, base64Data] = matches
      const buffer = Buffer.from(base64Data, 'base64')
      const contentType = `image/${mimeType}`

      // メモリキャッシュに保存
      IMAGE_CACHE.set(templateId, { buffer, contentType, ts: Date.now() })
      // キャッシュサイズ制限（最大200件）
      if (IMAGE_CACHE.size > 200) {
        const oldest = IMAGE_CACHE.keys().next().value
        if (oldest) IMAGE_CACHE.delete(oldest)
      }

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
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

    return NextResponse.redirect(new URL(staticFallbackUrl, request.url))
  } catch (err: any) {
    console.error(`[Image API] Error for ${templateId}:`, err.message)
    return NextResponse.redirect(new URL(staticFallbackUrl, request.url))
  }
}
