import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const { templateId } = params
    
    if (!templateId) {
      return NextResponse.json({ error: 'templateId is required' }, { status: 400 })
    }
    
    // DBから画像を取得
    const template = await prisma.bannerTemplate.findUnique({
      where: { templateId },
      select: { imageUrl: true },
    })
    
    if (!template?.imageUrl) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }
    
    const imageUrl = template.imageUrl
    
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
    console.error('[Image API] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
