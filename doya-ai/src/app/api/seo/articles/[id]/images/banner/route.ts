import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { geminiGenerateImagePng, GEMINI_IMAGE_MODEL_DEFAULT } from '@seo/lib/gemini'
import { ensureSeoStorage, saveBase64ToFile } from '@seo/lib/storage'
import { ensureSeoSchema } from '@seo/lib/bootstrap'

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

    const prompt = [
      'あなたはBtoBマーケティングに精通したプロのデザイナー兼アートディレクターです。',
      '以下の記事内容を正確に理解し、その要点が一目で伝わる「マーケティング用バナー画像」を作成してください。',
      '',
      '【前提条件】',
      '・目的：記事の訴求内容を視覚的に要約し、クリック・理解を促進する',
      '・用途：Webサイト/LP/広告/SNS（記事一覧のサムネ）',
      '・トーン：信頼感・プロフェッショナル・わかりやすさを重視',
      '・情報を盛り込みすぎず、「一瞬で伝わる」構成にする',
      '',
      '【必須インプット】',
      `▼記事タイトル\n${title}`,
      excerpt ? `\n▼記事の要約（または本文）\n${excerpt}` : '',
      keywords ? `\n▼キーワード\n${keywords}` : '',
      '\n▼ブランド・サービス名\nドヤライティングAI',
      '\n▼カラー指定\n#2563EB（指定なしの場合も“青基調のBtoB”で）',
      '\n▼サイズ\n1200×628（16:9）',
      '',
      '【重要：画像生成の制約】',
      '・画像内に文字は一切入れない（日本語/英語/数字/記号含む）',
      '・後で文字を載せられる大きな余白を確保する',
      '',
      '【最終ゴール】',
      '「この記事を読むと何が分かるのか」が、バナーを見た瞬間に直感的に伝わる画像を生成してください。',
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
