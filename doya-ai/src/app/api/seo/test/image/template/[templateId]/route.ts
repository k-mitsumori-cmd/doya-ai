import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as fs from 'fs'
import * as path from 'path'

export const runtime = 'nodejs'

// テンプレートIDに基づくフォールバック画像
const TEMPLATE_FALLBACKS: Record<string, string> = {
  // 初心者向け（青系）
  'intro-1': '/banner-samples/purpose-webinar.png',
  'intro-2': '/banner-samples/purpose-display.png',
  'intro-3': '/banner-samples/purpose-campaign.png',
  'intro-4': '/banner-samples/purpose-lp_hero.png',
  'intro-5': '/banner-samples/cat-finance.png',
  'intro-6': '/banner-samples/purpose-sns_ad.png',
  'intro-7': '/banner-samples/cat-other.png',
  'intro-8': '/banner-samples/purpose-campaign.png',
  // 比較・検討向け
  'compare-1': '/banner-samples/cat-it.png',
  'compare-2': '/banner-samples/cat-finance.png',
  'compare-3': '/banner-samples/purpose-youtube.png',
  'compare-4': '/banner-samples/cat-education.png',
  'compare-5': '/banner-samples/cat-marketing.png',
  'compare-6': '/banner-samples/cat-ec.png',
  // 構造タイプ別
  'structure-1': '/banner-samples/purpose-display.png',
  'structure-2': '/banner-samples/cat-finance.png',
  'structure-3': '/banner-samples/cat-it.png',
  'structure-4': '/banner-samples/purpose-lp_hero.png',
  'structure-5': '/banner-samples/cat-marketing.png',
  'structure-6': '/banner-samples/purpose-webinar.png',
  'structure-7': '/banner-samples/purpose-campaign.png',
  // 鉄板テンプレ
  'template-1': '/banner-samples/purpose-sns_ad.png',
  'template-2': '/banner-samples/cat-marketing.png',
  'template-3': '/banner-samples/purpose-display.png',
  'template-4': '/banner-samples/cat-ec.png',
  'template-5': '/banner-samples/purpose-lp_hero.png',
  'template-6': '/banner-samples/purpose-campaign.png',
  'template-7': '/banner-samples/cat-it.png',
  default: '/banner-samples/cat-other.png',
}

function base64ToBuffer(base64: string): Buffer {
  const matches = base64.match(/^data:image\/(\w+);base64,(.+)$/)
  if (matches) {
    return Buffer.from(matches[2], 'base64')
  }
  return Buffer.from(base64, 'base64')
}

async function serveFallbackImage(templateId: string): Promise<NextResponse> {
  const fallbackPath = TEMPLATE_FALLBACKS[templateId] || TEMPLATE_FALLBACKS.default
  const publicPath = path.join(process.cwd(), 'public', fallbackPath)

  try {
    const fileBuffer = await fs.promises.readFile(publicPath)
    const ext = path.extname(publicPath).toLowerCase().slice(1)
    const mimeType = ext === 'png' ? 'image/png' : ext === 'svg' ? 'image/svg+xml' : 'image/jpeg'

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (err) {
    return NextResponse.redirect(
      new URL(fallbackPath, process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000')
    )
  }
}

/**
 * SEO記事テンプレートIDに基づいて画像を返す
 * 1. seo-article-{templateId}のテンプレートをDBから検索
 * 2. 見つからない場合はフォールバック画像を返す
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const { templateId } = await params

  if (!templateId) {
    return serveFallbackImage('default')
  }

  try {
    // まずSEO記事用に生成されたテンプレートを検索
    const template = await prisma.bannerTemplate.findFirst({
      where: {
        templateId: `seo-article-${templateId}`,
        isActive: true,
      },
      select: {
        previewUrl: true,
        imageUrl: true,
      },
    })

    const imageData = template?.previewUrl || template?.imageUrl

    if (!imageData) {
      // 生成されたテンプレートがない場合はフォールバック
      return serveFallbackImage(templateId)
    }

    // Base64データURLの場合
    if (imageData.startsWith('data:image/')) {
      const buffer = base64ToBuffer(imageData)
      const mimeMatch = imageData.match(/^data:(image\/\w+);/)
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png'

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=3600',
        },
      })
    }

    // URLの場合はリダイレクト
    if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
      return NextResponse.redirect(imageData)
    }

    return serveFallbackImage(templateId)
  } catch (err: any) {
    console.error(`[SEO Template Image] Error for ${templateId}:`, err.message)
    return serveFallbackImage(templateId)
  }
}
