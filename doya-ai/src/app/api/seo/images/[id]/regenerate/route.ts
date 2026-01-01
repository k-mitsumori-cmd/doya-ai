import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { ensureSeoStorage, saveBase64ToFile } from '@seo/lib/storage'
import { geminiGenerateImagePng, GEMINI_IMAGE_MODEL_DEFAULT } from '@seo/lib/gemini'
import { z } from 'zod'

export const runtime = 'nodejs'
export const maxDuration = 60 // 60秒のタイムアウト

type PlanCode = 'GUEST' | 'FREE' | 'PRO' | 'ENTERPRISE' | 'UNKNOWN'
function normalizePlan(raw: any): PlanCode {
  const s = String(raw || '').toUpperCase().trim()
  if (s === 'PRO') return 'PRO'
  if (s === 'ENTERPRISE') return 'ENTERPRISE'
  if (s === 'FREE') return 'FREE'
  if (s === 'GUEST') return 'GUEST'
  return 'UNKNOWN'
}
function isPaid(plan: PlanCode) {
  return plan === 'PRO' || plan === 'ENTERPRISE'
}

const BodySchema = z.object({
  prompt: z.string().min(1).max(20000),
})

/**
 * 画像のプロンプトを修正して再生成（新しいSeoImageとして保存）
 * - 有料のみ
 */
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await ensureSeoSchema()
    const session = await getServerSession(authOptions)
    const user: any = session?.user || null
    const userId = String(user?.id || '')
    const plan = normalizePlan(user?.seoPlan || user?.plan || (userId ? 'FREE' : 'GUEST'))
    if (!userId) {
      return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
    }
    if (!isPaid(plan)) {
      return NextResponse.json({ success: false, error: '画像の再生成は有料プラン限定です' }, { status: 403 })
    }

    const id = ctx.params.id
    const body = BodySchema.parse(await req.json())

    const imgRec = await (prisma as any).seoImage.findUnique({ where: { id } })
    if (!imgRec) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })

    const article = await (prisma as any).seoArticle.findUnique({ where: { id: imgRec.articleId } })
    if (!article) return NextResponse.json({ success: false, error: 'article not found' }, { status: 404 })
    if (String(article.userId || '') !== userId) {
      return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 })
    }

    await ensureSeoStorage()

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
    console.error('Image regeneration error:', e)
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 400 })
  }
}
