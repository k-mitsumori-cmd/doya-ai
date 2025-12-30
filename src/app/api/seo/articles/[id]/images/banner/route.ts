import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { geminiGenerateImagePng, GEMINI_IMAGE_MODEL_DEFAULT } from '@seo/lib/gemini'
import { ensureSeoStorage, saveBase64ToFile } from '@seo/lib/storage'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { formatBannerPlanDescription, generateArticleBannerPlan, guessArticleGenreJa, mapGenreToNanobannerCategory } from '@seo/lib/bannerPlan'
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
    const keywords = String(((article.keywords as any) || []).join(', ')).trim()
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
    const genreGuess = guessArticleGenreJa([title, headings.join(' '), excerpt, keywords].join(' '))

    const plan = await generateArticleBannerPlan({
      title,
      headings,
      excerpt,
      keywords: keywords ? keywords.split(',').map((s) => s.trim()).filter(Boolean) : [],
      usage: '記事一覧/SNS（記事アイキャッチ）',
      genreHint: genreGuess,
    })

    const category = mapGenreToNanobannerCategory(plan.genre)
    const headline = plan.mainCopy || title

    // customImagePromptを削除し、nanobannerのデフォルトプロンプト（テキスト描画強制）を使用
    const result = await generateBanners(
      category,
      headline,
      '1200x628',
      {
        purpose: 'article_banner', // 記事バナー専用（広告/CTAを避けつつ文字の可読性を最優先）
        headlineText: headline,
        subheadText: plan.subCopy || '',
        ctaText: '', // CTA禁止（記事バナーなので）
        imageDescription: [
          plan.visualConcept,
          `Article: ${title}`,
          headings.length ? `Key points: ${headings.slice(0, 5).join(', ')}` : '',
          `Genre: ${plan.genre}`,
        ].filter(Boolean).join('. '),
        brandColors: ['#2563EB'],
        // customImagePromptを削除 - nanobannerのデフォルトプロンプトでテキスト描画を強制
      },
      1
    )

    // 保存用のプロンプトログ（表示用）
    const promptLog = [
      `Headline: ${headline}`,
      plan.subCopy ? `Subhead: ${plan.subCopy}` : '',
      `Genre: ${plan.genre}`,
      `Visual: ${plan.visualConcept}`,
    ].filter(Boolean).join('\n')
    const dataUrl = Array.isArray(result?.banners) ? result.banners.find((b) => typeof b === 'string' && b.startsWith('data:image/')) : null
    if (!dataUrl) throw new Error(result?.error || 'バナー画像の生成に失敗しました')
    const base64 = String(dataUrl).split(',')[1] || ''

    const filename = `seo_${articleId}_${Date.now()}_banner.png`
    const saved = await saveBase64ToFile({ base64, filename, subdir: 'images' })

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
