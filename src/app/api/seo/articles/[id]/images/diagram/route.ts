import { requireSeoImageAccess } from '@/lib/seo-image-access'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { geminiGenerateImagePng, GEMINI_IMAGE_MODEL_DEFAULT } from '@seo/lib/gemini'
import { ensureSeoStorage, saveBase64ToFile } from '@seo/lib/storage'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { reserveSeoToolCalls, SeoToolRateLimitError } from '@/lib/seo-tool-admission'

export const runtime = 'nodejs'
export const maxDuration = 60

const BodySchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(2000),
})

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireSeoImageAccess()
    if (!access.ok) return access.response
    await ensureSeoSchema()
    const articleId = (await ctx.params).id
    const article = await (prisma as any).seoArticle.findFirst({ where: { id: articleId, userId: access.userId } })
    if (!article) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })

    const parsed = BodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ success: false, error: '画像のタイトルと説明を確認してください。' }, { status: 400 })
    const body = parsed.data
    await ensureSeoStorage()
    await reserveSeoToolCalls(access.userId, 'article-images', 1)

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

    if (!img?.dataBase64) {
      return NextResponse.json({ success: false, error: '図解画像の生成に失敗しました（空のレスポンス）' }, { status: 500 })
    }

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
    if (e instanceof SeoToolRateLimitError) return NextResponse.json({ code: 'SEO_IMAGE_DAILY_LIMIT', error: `本日の追加画像生成上限（${e.limit}枚）に達しました。明日お試しください。` }, { status: 429 })
    console.error('[seo diagram] failed', e)
    return NextResponse.json(
      { success: false, error: '図解を生成できませんでした。時間をおいて再試行してください。' },
      { status: 500 }
    )
  }
}
