import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { geminiGenerateImagePng, GEMINI_IMAGE_MODEL_DEFAULT } from '@seo/lib/gemini'
import { ensureSeoStorage, saveBase64ToFile } from '@seo/lib/storage'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { formatBannerPlanDescription, generateArticleBannerPlan, guessArticleGenreJa } from '@seo/lib/bannerPlan'

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

    const prompt = [
      'あなたは記事バナー（アイキャッチ）制作に強いアートディレクターです。',
      '以下の記事内容を正確に理解し、記事内容と一致する「記事アイキャッチ画像」を作成してください。',
      '',
      '【前提】',
      '・目的：記事内容が直感的に伝わる（広告っぽくしすぎない）',
      '・用途：記事一覧/SNS（記事アイキャッチ）',
      '・情報を盛り込みすぎない（最大3ブロック）',
      '',
      '【必須インプット】',
      `▼記事タイトル\n${title}`,
      headings.length ? `\n▼記事見出し（要点）\n${headings.join(' / ')}` : '',
      excerpt ? `\n▼記事の要約（または本文）\n${excerpt}` : '',
      keywords ? `\n▼キーワード\n${keywords}` : '',
      `\n▼記事ジャンル（推定）\n${plan.genre}`,
      '\n▼カラー指定\nジャンルに合う配色（信頼/清潔感/視認性の最適化）',
      '\n▼サイズ\n1200×628（16:9）',
      '',
      '【重要ルール】',
      '・CTAは禁止（詳しくはこちら/今すぐ等は入れない）',
      '・画像内に文字は一切入れない（日本語/英語/数字/記号含む）',
      '・後から文字を載せられる大きな余白（ネガティブスペース）を確保する',
      '',
      '【参考：コピー案（※画像内に文字は入れない / CTAなし）】',
      `main: ${plan.mainCopy}`,
      `sub: ${plan.subCopy}`,
      plan.supportingPoints?.length ? `support: ${plan.supportingPoints.join(' / ')}` : '',
      '',
      '【最終ゴール】記事内容が、バナーを見た瞬間に直感的に伝わる画像にする。',
    ]
      .filter(Boolean)
      .join('\n')

    const img = await geminiGenerateImagePng({
      prompt,
      aspectRatio: '16:9',
      imageSize: '2K',
      model: GEMINI_IMAGE_MODEL_DEFAULT,
    })

    const filename = `seo_${articleId}_${Date.now()}_banner.png`
    const saved = await saveBase64ToFile({ base64: img.dataBase64, filename, subdir: 'images' })

    const rec = await (prisma as any).seoImage.create({
      data: {
        articleId,
        kind: 'BANNER',
        title: '記事バナー',
        description: formatBannerPlanDescription(plan),
        prompt,
        filePath: saved.relativePath,
        mimeType: img.mimeType || 'image/png',
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
