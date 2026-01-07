import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { geminiGenerateImagePng, GEMINI_IMAGE_MODEL_DEFAULT } from '@seo/lib/gemini'
import { ensureSeoStorage, saveBase64ToFile } from '@seo/lib/storage'
import { ensureSeoSchema } from '@seo/lib/bootstrap'

export const runtime = 'nodejs'
export const maxDuration = 60

const BodySchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(2000),
})

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await ensureSeoSchema()
    const articleId = ctx.params.id
    const article = await (prisma as any).seoArticle.findUnique({ where: { id: articleId } })
    if (!article) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })

    const body = BodySchema.parse(await req.json())
    await ensureSeoStorage()

    const prompt = [
      'Create a professional, business-like diagram illustration for a Japanese business article.',
      'CRITICAL: NO TEXT at all (no Japanese, no English, no numbers).',
      '',
      'Design Requirements:',
      '- Style: Professional, business-like, sophisticated, refined, simple, and clear',
      '- Visual approach: Simple, clear, and easy to understand - like diagrams in corporate reports or business books',
      '- Color scheme: Use ONLY muted, professional colors (blues, grays, subtle accents). STRICTLY avoid bright, pop, colorful, or playful colors',
      '- Layout: Clean, organized, with clear visual hierarchy and generous whitespace',
      '- Elements: Use geometric shapes, professional icons, arrows, and connectors',
      '- Avoid: Playful, cartoon-like, overly decorative, pop, or colorful elements',
      '- Whitespace: Generous whitespace for clarity and professionalism',
      '- Contrast: High contrast for readability, but maintain a professional, business-like tone',
      '- Overall impression: Should look like it belongs in a professional business presentation, corporate report, or business book',
      '',
      `Article title: ${article.title}`,
      `Diagram title (concept): ${body.title}`,
      `What to express: ${body.description}`,
      '',
      'Output: one square (1:1) diagram image that looks like it belongs in a professional business presentation, corporate report, or business book.',
    ].join('\n')

    const img = await geminiGenerateImagePng({
      prompt,
      aspectRatio: '1:1',
      imageSize: '2K',
      model: GEMINI_IMAGE_MODEL_DEFAULT,
    })

    const filename = `seo_${articleId}_${Date.now()}_diagram.png`
    const saved = await saveBase64ToFile({ base64: img.dataBase64, filename, subdir: 'images' })

    const rec = await (prisma as any).seoImage.create({
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
