import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 手動でバナーテンプレートを追加するAPI
 * 
 * POST: 画像URLとメタデータを受け取り、DBに保存
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      templateId, 
      imageUrl, 
      prompt, 
      displayTitle,
      genre,
      category,
      tags = []
    } = body

    if (!templateId || !imageUrl || !prompt) {
      return NextResponse.json(
        { error: 'templateId, imageUrl, prompt は必須です' },
        { status: 400 }
      )
    }

    // 既存チェック
    const existing = await prisma.bannerTemplate.findUnique({
      where: { templateId },
    })

    if (existing) {
      // 更新
      const updated = await prisma.bannerTemplate.update({
        where: { templateId },
        data: {
          imageUrl,
          previewUrl: imageUrl,
          prompt,
          industry: genre || 'business',
          category: category || 'it',
          isFeatured: true,
        },
      })
      return NextResponse.json({ 
        success: true, 
        action: 'updated',
        template: updated 
      })
    }

    // 新規作成
    const created = await prisma.bannerTemplate.create({
      data: {
        templateId,
        imageUrl,
        previewUrl: imageUrl,
        prompt,
        industry: genre || 'business',
        category: category || 'it',
        isFeatured: true,
        size: '1200x628',
        isActive: true,
      },
    })

    return NextResponse.json({ 
      success: true, 
      action: 'created',
      template: created 
    })
  } catch (error) {
    console.error('[Add Template] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
