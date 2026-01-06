import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { geminiGenerateImagePng, GEMINI_IMAGE_MODEL_DEFAULT } from '@seo/lib/gemini'
import { ensureSeoStorage, saveBase64ToFile } from '@seo/lib/storage'
import { ensureSeoSchema } from '@seo/lib/bootstrap'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * 複数の図解を一括生成するAPI
 */

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureSeoSchema()
    const articleId = params.id
    const body = await req.json()
    const diagrams: { title: string; description: string }[] = body.diagrams || []

    if (!diagrams.length) {
      return NextResponse.json({ success: false, error: '図解のリストが空です' }, { status: 400 })
    }

    const article = await (prisma as any).seoArticle.findUnique({
      where: { id: articleId },
      select: { id: true, title: true },
    })

    if (!article) {
      return NextResponse.json({ success: false, error: 'Article not found' }, { status: 404 })
    }

    await ensureSeoStorage()

    const results: { title: string; success: boolean; imageId?: string; error?: string }[] = []

    // 順番に生成（並列だとレート制限に引っかかる可能性）
    for (const diagram of diagrams.slice(0, 5)) {
      try {
        const prompt = [
          'Create a professional, business-like diagram illustration for a Japanese business article.',
          'CRITICAL: NO TEXT at all (no Japanese, no English, no numbers).',
          '',
          'Design Requirements:',
          '- Style: Professional, business-like, sophisticated, and refined',
          '- Visual approach: Simple, clear, and easy to understand',
          '- Color scheme: Use muted, professional colors (blues, grays, subtle accents). Avoid bright, pop colors',
          '- Layout: Clean, organized, with clear visual hierarchy',
          '- Elements: Use geometric shapes, professional icons, arrows, and connectors',
          '- Avoid: Playful, cartoon-like, or overly decorative elements',
          '- Whitespace: Generous whitespace for clarity and professionalism',
          '- Contrast: High contrast for readability, but maintain a professional tone',
          '',
          `Article title: ${article.title}`,
          `Diagram title (concept): ${diagram.title}`,
          `What to express: ${diagram.description}`,
          '',
          'Output: one square (1:1) diagram image that looks like it belongs in a professional business presentation or corporate report.',
        ].join('\n')

        const img = await geminiGenerateImagePng({
          prompt,
          aspectRatio: '1:1',
          imageSize: '2K',
          model: GEMINI_IMAGE_MODEL_DEFAULT,
        })

        const filename = `seo_${articleId}_${Date.now()}_diagram.png`
        const saved = await saveBase64ToFile({ base64: img.dataBase64, filename, subdir: 'images' })

        const seoImage = await (prisma as any).seoImage.create({
          data: {
            articleId,
            kind: 'DIAGRAM',
            title: diagram.title,
            description: diagram.description,
            prompt,
            filePath: saved.relativePath,
            mimeType: img.mimeType || 'image/png',
          },
        })

        results.push({
          title: diagram.title,
          success: true,
          imageId: seoImage.id,
        })

        // レート制限を避けるため少し待つ
        await new Promise((resolve) => setTimeout(resolve, 500))
      } catch (err: any) {
        results.push({
          title: diagram.title,
          success: false,
          error: err?.message || '不明なエラー',
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const failCount = results.filter((r) => !r.success).length

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: results.length,
        success: successCount,
        failed: failCount,
      },
    })
  } catch (e: any) {
    console.error('Batch diagram generation error:', e)
    return NextResponse.json({ success: false, error: e?.message || 'Unknown error' }, { status: 500 })
  }
}