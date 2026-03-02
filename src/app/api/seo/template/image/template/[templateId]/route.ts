import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

function base64ToBuffer(base64: string): Buffer {
  const matches = base64.match(/^data:image\/(\w+);base64,(.+)$/)
  if (matches) {
    return Buffer.from(matches[2], 'base64')
  }
  return Buffer.from(base64, 'base64')
}

/**
 * SEO記事テンプレートIDに基づいてAI生成画像を返す
 * DB に Nano Banana Pro で生成された画像がなければ 404
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const { templateId } = await params

  if (!templateId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
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
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
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

    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  } catch (err: any) {
    console.error(`[SEO Template Image] Error for ${templateId}:`, err.message)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
