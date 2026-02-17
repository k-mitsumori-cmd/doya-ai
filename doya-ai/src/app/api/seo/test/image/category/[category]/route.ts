import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as fs from 'fs'
import * as path from 'path'

export const runtime = 'nodejs'

// カテゴリ別のフォールバック画像マッピング
const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  ビジネス: '/banner-samples/cat-marketing.png',
  マーケティング: '/banner-samples/cat-marketing.png',
  テクノロジー: '/banner-samples/cat-it.png',
  '暮らし・ライフスタイル': '/banner-samples/cat-other.png',
  '美容・健康': '/banner-samples/cat-beauty.png',
  '金融・投資': '/banner-samples/cat-finance.png',
  'EC・通販': '/banner-samples/cat-ec.png',
  '教育・学習': '/banner-samples/cat-education.png',
  エンタメ: '/banner-samples/cat-other.png',
  '旅行・グルメ': '/banner-samples/cat-food.png',
  認知: '/banner-samples/purpose-lp_hero.png',
  比較: '/banner-samples/purpose-display.png',
  CV: '/banner-samples/purpose-campaign.png',
  解説型: '/banner-samples/purpose-webinar.png',
  比較型: '/banner-samples/purpose-display.png',
  一覧型: '/banner-samples/purpose-sns_ad.png',
  default: '/banner-samples/cat-other.png',
}

// Base64画像データをバイナリに変換して返す
function base64ToBuffer(base64: string): Buffer {
  const matches = base64.match(/^data:image\/(\w+);base64,(.+)$/)
  if (matches) {
    return Buffer.from(matches[2], 'base64')
  }
  return Buffer.from(base64, 'base64')
}

// フォールバック画像を直接返す関数
async function serveFallbackImage(category: string): Promise<NextResponse> {
  const fallbackPath = CATEGORY_FALLBACK_IMAGES[category] || CATEGORY_FALLBACK_IMAGES.default
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
    // ファイルが見つからない場合はリダイレクト
    return NextResponse.redirect(new URL(fallbackPath, process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'))
  }
}

/**
 * カテゴリに基づいてNanoBanana Pro v2生成画像を返す
 * ローカル環境（DB未接続）ではフォールバック画像を直接返す
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  const { category: rawCategory } = await params
  const category = decodeURIComponent(rawCategory)

  if (!category) {
    return serveFallbackImage('default')
  }

  const { searchParams } = new URL(request.url)
  const index = parseInt(searchParams.get('index') || '0')

  try {
    // banner_templateテーブルからランダムに画像を取得
    type TemplateRow = { id: string; preview_image: string | null; category: string | null }

    const templates = await prisma.$queryRaw<TemplateRow[]>`
      SELECT id, preview_image, category
      FROM banner_template
      WHERE preview_image IS NOT NULL
      ORDER BY RANDOM()
      LIMIT 10
    `

    if (!templates || templates.length === 0) {
      return serveFallbackImage(category)
    }

    // indexに基づいて画像を選択（循環）
    const selectedTemplate = templates[index % templates.length]
    const imageData = selectedTemplate?.preview_image

    if (!imageData) {
      return serveFallbackImage(category)
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

    return serveFallbackImage(category)
  } catch (err: any) {
    console.error(`[SEO Category Image] Error for ${category}:`, err.message)
    return serveFallbackImage(category)
  }
}
