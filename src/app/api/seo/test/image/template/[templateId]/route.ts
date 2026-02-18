import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as fs from 'fs'
import * as path from 'path'

export const runtime = 'nodejs'

// テンプレートIDに基づくフォールバック画像
const TEMPLATE_FALLBACKS: Record<string, string> = {
  // 入門・解説（guide）
  'guide-1': '/banner-samples/cat-it.png',        // ChatGPTの使い方
  'guide-2': '/banner-samples/cat-finance.png',    // 副業の始め方
  'guide-3': '/banner-samples/cat-marketing.png',  // マーケティング
  'guide-4': '/banner-samples/purpose-webinar.png', // DX推進
  // 比較・ランキング（compare）
  'compare-1': '/banner-samples/purpose-display.png', // プロジェクト管理ツール
  'compare-2': '/banner-samples/cat-it.png',          // AIライティングツール
  'compare-3': '/banner-samples/cat-finance.png',     // クラウド会計ソフト
  'compare-4': '/banner-samples/purpose-campaign.png', // CRMツール
  // HowTo・実践（howto）
  'howto-1': '/banner-samples/purpose-lp_hero.png',   // LP制作
  'howto-2': '/banner-samples/cat-marketing.png',      // コンテンツマーケティング
  'howto-3': '/banner-samples/cat-recruit.png',        // 採用ブランディング
  'howto-4': '/banner-samples/cat-ec.png',             // ECサイトCVR改善
  // 事例・トレンド（case）
  'case-1': '/banner-samples/purpose-sns_ad.png',      // BtoB営業成功事例
  'case-2': '/banner-samples/purpose-youtube.png',     // SNSマーケティング
  'case-3': '/banner-samples/cat-telecom.png',         // SaaSトレンド
  'case-4': '/banner-samples/cat-education.png',       // データドリブン経営
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
