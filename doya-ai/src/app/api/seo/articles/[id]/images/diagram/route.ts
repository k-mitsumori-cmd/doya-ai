import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { geminiGenerateImagePng, GEMINI_IMAGE_MODEL_DEFAULT } from '@seo/lib/gemini'
import { ensureSeoStorage, saveBase64ToFile } from '@seo/lib/storage'

const BodySchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(2000),
})

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const articleId = ctx.params.id
    const article = await prisma.seoArticle.findUnique({ where: { id: articleId } })
    if (!article) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })

    const body = BodySchema.parse(await req.json())
    await ensureSeoStorage()

    const prompt = [
      'Create a clean monochrome-friendly diagram illustration for a Japanese business article.',
      'CRITICAL: NO TEXT at all (no Japanese, no English, no numbers).',
      'Use simple shapes, icons, arrows, and layout to represent the concept.',
      'Style: flat vector-like, minimal, high contrast, plenty of whitespace.',
      '',
      `Article title: ${article.title}`,
      `Diagram title (concept): ${body.title}`,
      `What to express: ${body.description}`,
      '',
      'Output: one square (1:1) diagram image.',
    ].join('\n')

    const img = await geminiGenerateImagePng({
      prompt,
      aspectRatio: '1:1',
      imageSize: '2K',
      model: GEMINI_IMAGE_MODEL_DEFAULT,
    })

    const filename = `seo_${articleId}_${Date.now()}_diagram.png`
    const saved = await saveBase64ToFile({ base64: img.dataBase64, filename, subdir: 'images' })

    const rec = await prisma.seoImage.create({
      data: {
        articleId,
        kind: 'DIAGRAM',
        title: body.title,
        description: body.description,
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


