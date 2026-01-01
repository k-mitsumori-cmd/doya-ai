import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSeoStorage, saveBase64ToFile } from '@seo/lib/storage'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { guessArticleGenreJa, mapGenreToNanobannerCategory, generateArticleBannerPlan, formatBannerPlanDescription } from '@seo/lib/bannerPlan'
import { generateBanners } from '@/lib/nanobanner'

export const runtime = 'nodejs'

export async function POST(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await ensureSeoSchema()
    const articleId = ctx.params.id
    const article = await (prisma as any).seoArticle.findUnique({ where: { id: articleId } })
    if (!article) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })

    await ensureSeoStorage()

    const title = String(article.title || '').trim()
    const keywords = ((article.keywords as any) || []) as string[]
    const persona = String(article.persona || '').trim()
    const searchIntent = String(article.searchIntent || '').trim()
    const excerpt = String(article.finalMarkdown || article.outline || '')
      .replace(/!\[[^\]]*?\]\([^)]+\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`{3}[\s\S]*?`{3}/g, '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 2200)
    const headings = (String(article.finalMarkdown || '').match(/^#{1,3}\s+.+$/gm) || [])
      .map((h) => String(h).replace(/^#{1,6}\s+/, '').trim())
      .filter(Boolean)
      .slice(0, 16)
    const genreGuess = guessArticleGenreJa([title, headings.join(' '), excerpt, keywords.join(' ')].join(' '))
    const category = mapGenreToNanobannerCategory(genreGuess)

    // バナーコピーを生成（CTAあり、画像内テキスト描画用）
    const plan = await generateArticleBannerPlan({
      title,
      headings,
      excerpt,
      keywords,
      persona,
      searchIntent,
      requestText: '',
      usage: '記事一覧/SNS（記事アイキャッチ）',
      genreHint: genreGuess,
    })

    // nanobannerの標準プロンプト生成ロジックを使用（customImagePromptを使わない）
    const headline = plan.mainCopy || title
    const subhead = plan.subCopy || ''
    const ctaText = '詳しくはこちら'
    const imageDescription = `業界: ${plan.genre} / コンセプト: 記事内容を象徴するビジュアル`

    const result = await generateBanners(
      category,
      headline,
      '1200x628',
      {
        purpose: 'sns_ad',
        subheadText: subhead,
        ctaText: ctaText,
        imageDescription: imageDescription,
      },
      1
    )

    const dataUrl = Array.isArray(result?.banners) ? result.banners.find((b) => typeof b === 'string' && b.startsWith('data:image/')) : null
    if (!dataUrl) throw new Error(result?.error || 'バナー画像の生成に失敗しました')
    const base64 = String(dataUrl).split(',')[1] || ''

    const filename = `seo_${articleId}_${Date.now()}_banner.png`
    const saved = await saveBase64ToFile({ base64, filename, subdir: 'images' })

    // 保存用のプロンプトログ（表示用）
    const promptLog = [
      `【バナー生成設定】`,
      `カテゴリ: ${category}`,
      `メインコピー: ${headline}`,
      subhead ? `サブコピー: ${subhead}` : '',
      `CTA: ${ctaText}`,
      `ビジュアル: ${imageDescription}`,
      '',
      `【生成元情報】`,
      `記事タイトル: ${title}`,
      `ジャンル: ${plan.genre}`,
    ].filter(Boolean).join('\n')

    const rec = await (prisma as any).seoImage.create({
      data: {
        articleId,
        kind: 'BANNER',
        title: '記事バナー',
        description: formatBannerPlanDescription(plan),
        prompt: promptLog,
        filePath: saved.relativePath,
        mimeType: 'image/png',
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
