import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSeoStorage, saveBase64ToFile } from '@seo/lib/storage'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { guessArticleGenreJa, buildArticleBannerPrompt } from '@seo/lib/bannerPlan'
import { geminiGenerateImagePng, GEMINI_IMAGE_MODEL_DEFAULT } from '@seo/lib/gemini'

export const runtime = 'nodejs'

export async function POST(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await ensureSeoSchema()
    const articleId = ctx.params.id
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

    // バナー生成プロンプトを組み立て
    const prompt = buildArticleBannerPrompt({
      title,
      articleText,
      bannerSize: '1200x628（16:9、SNS/広告向け）',
      genre,
    })

    // Geminiで画像生成
    const result = await geminiGenerateImagePng({
      prompt,
      aspectRatio: '16:9',
      imageSize: '2K',
      model: GEMINI_IMAGE_MODEL_DEFAULT,
    })

    if (!result?.dataBase64) {
      throw new Error('バナー画像の生成に失敗しました')
    }

    const filename = `seo_${articleId}_${Date.now()}_banner.png`
    const saved = await saveBase64ToFile({ base64: result.dataBase64, filename, subdir: 'images' })

    // DBに保存
    const rec = await (prisma as any).seoImage.create({
      data: {
        articleId,
        kind: 'BANNER',
        title: '記事バナー',
        description: `記事「${title}」のバナー画像`,
        prompt: prompt,
        filePath: saved.relativePath,
        mimeType: 'image/png',
      },
    })

    return NextResponse.json({ success: true, image: rec })
  } catch (e: any) {
    console.error('Banner generation error:', e)
    return NextResponse.json(
      { success: false, error: e?.message || '不明なエラー' },
      { status: 500 }
    )
  }
}
