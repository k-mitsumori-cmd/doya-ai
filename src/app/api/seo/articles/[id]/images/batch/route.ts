import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { geminiGenerateImage } from '@seo/lib/gemini'
import { saveImage } from '@seo/lib/storage'

/**
 * 複数の図解を一括生成するAPI
 */

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const diagrams: { title: string; description: string }[] = body.diagrams || []

    if (!diagrams.length) {
      return NextResponse.json({ success: false, error: '図解のリストが空です' }, { status: 400 })
    }

    const article = await (prisma as any).seoArticle.findUnique({
      where: { id: params.id },
      select: { id: true, title: true },
    })

    if (!article) {
      return NextResponse.json({ success: false, error: 'Article not found' }, { status: 404 })
    }

    const results: { title: string; success: boolean; imageId?: string; error?: string }[] = []

    // 順番に生成（並列だとレート制限に引っかかる可能性）
    for (const diagram of diagrams.slice(0, 5)) {
      try {
        const prompt = `
Create a professional infographic diagram for a Japanese article.
Style: Clean, modern, minimal, professional
Colors: Blue and gray tones with white background
Language: Japanese text if any labels needed

Title: ${diagram.title}
Content to visualize: ${diagram.description}

Important:
- Clear visual hierarchy
- Easy to understand at a glance
- Professional business style
- No cluttered elements
`

        const imageBuffer = await geminiGenerateImage(prompt)
        
        if (!imageBuffer) {
          results.push({
            title: diagram.title,
            success: false,
            error: '画像生成に失敗しました',
          })
          continue
        }

        const filePath = await saveImage(imageBuffer, 'png')

        const seoImage = await (prisma as any).seoImage.create({
          data: {
            articleId: params.id,
            kind: 'diagram',
            title: diagram.title,
            description: diagram.description,
            filePath,
          },
        })

        results.push({
          title: diagram.title,
          success: true,
          imageId: seoImage.id,
        })
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

