import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { geminiGenerateImagePng, GEMINI_IMAGE_MODEL_DEFAULT } from '@seo/lib/gemini'
import { ensureSeoStorage, saveBase64ToFile } from '@seo/lib/storage'

export async function POST(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const articleId = ctx.params.id
    const article = await prisma.seoArticle.findUnique({ where: { id: articleId } })
    if (!article) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })

    await ensureSeoStorage()

    const prompt = [
      'Create a modern Japanese SEO article banner image.',
      'CRITICAL: NO TEXT at all (no Japanese, no English, no numbers).',
      'Create a clean visual with a large empty area for text overlay.',
      'Style: professional, high contrast, modern.',
      '',
      `Theme: ${article.title}`,
      `Keywords: ${((article.keywords as any) || []).join(', ')}`,
      '',
      'Output: a single 16:9 banner image.',
    ].join('\n')

    const img = await geminiGenerateImagePng({
      prompt,
      aspectRatio: '16:9',
      imageSize: '2K',
      model: GEMINI_IMAGE_MODEL_DEFAULT,
    })

    const filename = `seo_${articleId}_${Date.now()}_banner.png`
    const saved = await saveBase64ToFile({ base64: img.dataBase64, filename, subdir: 'images' })

    const rec = await prisma.seoImage.create({
      data: {
        articleId,
        kind: 'BANNER',
        title: '記事バナー',
        prompt,
        filePath: saved.relativePath,
        mimeType: img.mimeType || 'image/png',
      },
    })

    return NextResponse.json({ success: true, image: rec })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || '不明なエラー' },
      { status: 500 }
    )
  }
}


