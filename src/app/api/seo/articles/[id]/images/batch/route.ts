import { z } from 'zod'
import { getSeoArticleOwner } from '@/lib/seoArticleOwner'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { geminiGenerateImagePng, GEMINI_IMAGE_MODEL_DEFAULT } from '@seo/lib/gemini'
import { ensureSeoStorage, saveBase64ToFile } from '@seo/lib/storage'
import { ensureSeoSchema } from '@seo/lib/bootstrap'

export const runtime = 'nodejs'
export const maxDuration = 120

const BodySchema = z.object({
  diagrams: z.array(z.object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(2000),
  })).min(1).max(10),
})

/**
 * 複数の図解を一括生成するAPI
 */

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const owner = await getSeoArticleOwner(req)
    if (!owner) return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
    await ensureSeoSchema()
    const articleId = params.id
    const parsed = BodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ success: false, error: '図解は1〜10件で、各タイトルと説明を入力してください。' }, { status: 400 })
    const { diagrams } = parsed.data

    const article = await (prisma as any).seoArticle.findFirst({
      where: { id: articleId, ...owner },
      select: { id: true, title: true },
    })

    if (!article) {
      return NextResponse.json({ success: false, error: 'Article not found' }, { status: 404 })
    }

    await ensureSeoStorage()

    const results: { title: string; success: boolean; imageId?: string; error?: string }[] = []

    // 順番に生成（並列だとレート制限に引っかかる可能性）
    for (const diagram of diagrams) {
      try {
        const prompt = [
          'Create a clean monochrome-friendly diagram illustration for a Japanese business article.',
          'CRITICAL: NO TEXT at all (no Japanese, no English, no numbers).',
          'Use simple shapes, icons, arrows, and layout to represent the concept.',
          'Style: flat vector-like, minimal, high contrast, plenty of whitespace.',
          '',
          `Article title: ${article.title}`,
          `Diagram title (concept): ${diagram.title}`,
          `What to express: ${diagram.description}`,
          '',
          'Output: one square (1:1) diagram image.',
        ].join('\n')

        const img = await geminiGenerateImagePng({
          prompt,
          aspectRatio: '1:1',
          imageSize: '2K',
          model: GEMINI_IMAGE_MODEL_DEFAULT,
        })

        if (!img?.dataBase64) throw new Error('画像生成の結果が空でした')
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
        console.error('[seo diagram batch] item failed', err)
        results.push({
          title: diagram.title,
          success: false,
          error: '図解を生成できませんでした。時間をおいて再試行してください。',
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const failCount = results.filter((r) => !r.success).length

    return NextResponse.json({
      success: failCount === 0,
      ...(failCount ? { error: `${results.length}件中${successCount}件を保存しました。${failCount}件は生成できませんでした。成功分は保存済みです。`, code: 'PARTIAL_GENERATION_FAILURE' } : {}),
      results,
      summary: {
        total: results.length,
        success: successCount,
        failed: failCount,
      },
    }, { status: failCount ? 502 : 200 })
  } catch (e: any) {
    console.error('Batch diagram generation error:', e)
    return NextResponse.json({ success: false, error: '図解を生成できませんでした。時間をおいて再試行してください。' }, { status: 500 })
  }
}
