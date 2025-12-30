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

    const support = (plan.supportingPoints || []).filter(Boolean).slice(0, 1)[0] || ''
    const category = mapGenreToNanobannerCategory(plan.genre)
    const headline = plan.mainCopy || title
    const prompt = [
      '=== MOST IMPORTANT: TEXT MUST BE RENDERED IN THE IMAGE ===',
      'You MUST draw the following Japanese text directly onto the image canvas.',
      'The image MUST contain visible, readable Japanese text. Do NOT output a text-free image.',
      '',
      `【メインコピー（必須・大きく表示）】${headline}`,
      plan.subCopy ? `【サブコピー（画像内に表示）】${plan.subCopy}` : '',
      support ? `【補足（画像内に表示）】${support}` : '',
      '',
      '=== BANNER DESIGN BRIEF ===',
      'You are a top-tier editorial banner designer for Japanese articles.',
      'Goal: Create a 16:9 article banner with the Japanese text above rendered clearly.',
      '',
      'RULES:',
      '- This is NOT an ad. No CTA (今すぐ, 詳しくはこちら, etc.).',
      '- Text: large, bold, Noto Sans JP-like font, with solid/gradient panel for contrast.',
      '- Maximum 3 text blocks (headline / subhead / support).',
      '',
      'ARTICLE CONTEXT (for visual design):',
      `- Title: ${title}`,
      headings.length ? `- Headings: ${headings.join(' / ')}` : '',
      excerpt ? `- Excerpt: ${excerpt.slice(0, 800)}` : '',
      keywords ? `- Keywords: ${keywords}` : '',
      '',
      'DESIGN:',
      `- Genre: ${plan.genre}`,
      `- Palette: ${plan.palette}`,
      `- Layout: ${plan.layout}`,
      '',
      'OUTPUT:',
      '- 1200x628 px (16:9). Edge-to-edge, no letterboxing.',
      '- CRITICAL: The メインコピー text MUST be visible in the final image.',
    ]
      .filter(Boolean)
      .join('\n')

    const result = await generateBanners(
      category,
      headline,
      '1200x628',
      {
        purpose: 'email',
        headlineText: headline,
        subheadText: plan.subCopy,
        ctaText: '',
        imageDescription: plan.visualConcept,
        brandColors: ['#2563EB'],
        customImagePrompt: prompt,
      },
      1
    )
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
        prompt,
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
