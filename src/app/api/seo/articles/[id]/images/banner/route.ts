import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSeoStorage, saveBase64ToFile } from '@seo/lib/storage'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { guessArticleGenreJa, pickRandomPatterns, buildBannerPromptFromPattern } from '@seo/lib/bannerPlan'
import { geminiGenerateImagePng, GEMINI_IMAGE_MODEL_DEFAULT } from '@seo/lib/gemini'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const params = 'then' in ctx.params ? await ctx.params : ctx.params
  const articleId = params.id

  try {
    await ensureSeoSchema()
    const article = await (prisma as any).seoArticle.findUnique({ where: { id: articleId } })
    if (!article) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })

    await ensureSeoStorage()

    const title = String(article.title || '').trim()

    // 記事本文を整形（マークダウンから不要要素を除去）
    const articleText = String(article.finalMarkdown || article.outline || '')
      .replace(/!\[[^\]]*?\]\([^)]+\)/g, '') // 画像を除去
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // リンクをテキストに変換
      .replace(/`{3}[\s\S]*?`{3}/g, '') // コードブロックを除去
      .replace(/^#{1,6}\s+/gm, '') // 見出し記号を除去
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 5000)

    // ジャンルを推定
    const genre = guessArticleGenreJa([title, articleText].join(' '))

    // 12パターンからランダムに4つ選択
    const selectedPatterns = pickRandomPatterns(4)

    // 各パターンで1枚ずつ生成（計4枚）
    const results: any[] = []
    for (let i = 0; i < selectedPatterns.length; i++) {
      const pattern = selectedPatterns[i]
      try {
        const prompt = buildBannerPromptFromPattern(pattern, {
          title,
          articleText,
          genre,
        })

        const result = await geminiGenerateImagePng({
          prompt,
          aspectRatio: '16:9',
          imageSize: '2K',
          model: GEMINI_IMAGE_MODEL_DEFAULT,
        })

        if (result?.dataBase64) {
          const filename = `seo_${articleId}_${Date.now()}_banner_${i}.png`
          const saved = await saveBase64ToFile({ base64: result.dataBase64, filename, subdir: 'images' })

          const rec = await (prisma as any).seoImage.create({
            data: {
              articleId,
              kind: 'BANNER',
              title: `${pattern.label}スタイル`,
              description: `記事「${title}」のバナー画像（${pattern.label}）`,
              prompt: prompt,
              filePath: saved.relativePath,
              mimeType: 'image/png',
            },
          })
          results.push(rec)
        }

        if (i < selectedPatterns.length - 1) await new Promise((r) => setTimeout(r, 500))
      } catch (err: any) {
        console.error(`Banner ${i + 1} (${pattern.label}) generation failed:`, err?.message)
      }
    }

    if (!results.length) {
      throw new Error('バナー画像の生成に失敗しました')
    }

    return NextResponse.json({ success: true, images: results, image: results[0] })
  } catch (e: any) {
    console.error('[seo banner] failed', { articleId, error: e?.message || 'unknown error', stack: e?.stack })
    return NextResponse.json(
      { success: false, error: e?.message || '不明なエラー' },
      { status: 500 }
    )
  }
}
