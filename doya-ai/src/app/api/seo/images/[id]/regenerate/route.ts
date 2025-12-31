import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { ensureSeoStorage, saveBase64ToFile } from '@seo/lib/storage'
import { geminiGenerateImagePng, GEMINI_IMAGE_MODEL_DEFAULT } from '@seo/lib/gemini'
import { guessArticleGenreJa, mapGenreToNanobannerCategory } from '@seo/lib/bannerPlan'
import { generateBanners } from '@/lib/nanobanner'
import { z } from 'zod'

export const runtime = 'nodejs'

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

// 古い「文字を入れない」系プロンプトを除去
function sanitizePrompt(raw: string): string {
  const s = String(raw || '')
  if (!s) return s
  const lines = s.replace(/\r\n/g, '\n').split('\n')
  const filtered = lines.filter((line) => {
    const t = line.trim()
    if (!t) return true
    if (t.includes('画像に文字は入れない')) return false
    if (t.includes('画像内に文字') && t.includes('入れない')) return false
    if (t.includes('後から文字を載せられる')) return false
    if (t.includes('ネガティブスペース')) return false
    return true
  })
  return filtered.join('\n').replace(/\n{3,}/g, '\n\n').trim()
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
    const cleanPrompt = sanitizePrompt(body.prompt)
    
    let base64: string
    let mimeType = 'image/png'

    if (kind === 'BANNER') {
      // バナーはnanobannerを使用（テキスト描画のため）
      const articleTitle = String(article.title || '').trim()
      const articleContent = String(article.finalMarkdown || '').slice(0, 5000)
      const genreGuess = guessArticleGenreJa([articleTitle, articleContent].join(' '))
      const category = mapGenreToNanobannerCategory(genreGuess)

      const result = await generateBanners(
        category,
        articleTitle,
        '1200x628',
        {
          purpose: 'sns_ad',
          customImagePrompt: cleanPrompt,
        },
        1
      )
      const dataUrl = Array.isArray(result?.banners) ? result.banners.find((b) => typeof b === 'string' && b.startsWith('data:image/')) : null
      if (!dataUrl) throw new Error(result?.error || 'バナー画像の再生成に失敗しました')
      base64 = String(dataUrl).split(',')[1] || ''
    } else {
      // 図解はGeminiを使用
      const img = await geminiGenerateImagePng({
        prompt: cleanPrompt,
        aspectRatio: '1:1',
        imageSize: '2K',
        model: GEMINI_IMAGE_MODEL_DEFAULT,
      })
      base64 = img.dataBase64
      mimeType = img.mimeType || 'image/png'
    }

    const filename = `seo_${imgRec.articleId}_${Date.now()}_${kind.toLowerCase()}_regen.png`
    const saved = await saveBase64ToFile({ base64, filename, subdir: 'images' })

    const newRec = await (prisma as any).seoImage.create({
      data: {
        articleId: imgRec.articleId,
        kind,
        title: imgRec.title,
        description: imgRec.description,
        prompt: cleanPrompt,
        filePath: saved.relativePath,
        mimeType,
      },
    })

    return NextResponse.json({ success: true, image: newRec })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 400 })
  }
}


