import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { ensureSeoStorage, saveBase64ToFile } from '@seo/lib/storage'
import { geminiGenerateImagePng, GEMINI_IMAGE_MODEL_DEFAULT } from '@seo/lib/gemini'
import { z } from 'zod'
import { requireSeoImageAccess } from '@/lib/seo-image-access'
import { reserveSeoToolCalls, SeoToolRateLimitError } from '@/lib/seo-tool-admission'

export const runtime = 'nodejs'
export const maxDuration = 60 // 60秒のタイムアウト

const BodySchema = z.object({
  prompt: z.string().min(1).max(20000),
})

/**
 * 画像のプロンプトを修正して再生成（新しいSeoImageとして保存）
 * - 有料のみ
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireSeoImageAccess()
    if (!access.ok) return access.response
    await ensureSeoSchema()
    const userId = access.userId

    const p = await ctx.params
    const id = p.id
    const body = BodySchema.parse(await req.json())

    const imgRec = await (prisma as any).seoImage.findUnique({ where: { id } })
    if (!imgRec) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })

    const article = await (prisma as any).seoArticle.findUnique({ where: { id: imgRec.articleId } })
    if (!article) return NextResponse.json({ success: false, error: 'article not found' }, { status: 404 })
    if (String(article.userId || '') !== userId) {
      return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 })
    }

    await ensureSeoStorage()
    await reserveSeoToolCalls(userId, 'article-images', 1)

    const kind = String(imgRec.kind || 'BANNER')
    const prompt = body.prompt.trim()

    // バナー・図解ともにGeminiで直接生成（新しいプロンプトを使用）
    const aspectRatio = kind === 'BANNER' ? '16:9' : '1:1'
    
    const img = await geminiGenerateImagePng({
      prompt,
      aspectRatio,
      imageSize: '2K',
      model: GEMINI_IMAGE_MODEL_DEFAULT,
    })

    if (!img?.dataBase64) {
      throw new Error('画像の再生成に失敗しました')
    }

    const filename = `seo_${imgRec.articleId}_${Date.now()}_${kind.toLowerCase()}_regen.png`
    const saved = await saveBase64ToFile({ base64: img.dataBase64, filename, subdir: 'images' })

    const newRec = await (prisma as any).seoImage.create({
      data: {
        articleId: imgRec.articleId,
        kind,
        title: imgRec.title,
        description: imgRec.description,
        prompt,
        filePath: saved.relativePath,
        mimeType: img.mimeType || 'image/png',
      },
    })

    return NextResponse.json({ success: true, image: newRec })
  } catch (e: any) {
    if (e instanceof SeoToolRateLimitError) return NextResponse.json({ code: 'SEO_IMAGE_DAILY_LIMIT', error: `本日の追加画像生成上限（${e.limit}枚）に達しました。明日お試しください。` }, { status: 429 })
    console.error('Image regeneration error:', e)
    if (e?.name === 'ZodError' || e instanceof SyntaxError) {
      return NextResponse.json({ success: false, error: '入力形式が正しくありません' }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: '画像を再生成できませんでした。時間をおいて再試行してください。' }, { status: 500 })
  }
}
