import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { geminiGenerateImagePng, GEMINI_IMAGE_MODEL_DEFAULT } from '@seo/lib/gemini'
import { ensureSeoStorage, saveBase64ToFile } from '@seo/lib/storage'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { guessArticleGenreJa, mapGenreToNanobannerCategory } from '@seo/lib/bannerPlan'
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
    const category = mapGenreToNanobannerCategory(genreGuess)

    // 広告バナー用（本文ベースでコピー生成＋CTAあり）
    const prompt = `あなたは成果の出る広告バナーを専門に制作する一流のマーケティングデザイナーです。
以下の「記事本文テキスト」を読み取り、内容を要約・再構成し、
クリック率・視認性・訴求力を最大化する広告バナー画像を生成してください。

【前提条件】
・バナー用途：Web広告 / 記事内バナー / SNS広告
・ターゲット：記事内容から最も適切なペルソナを自動推定する
・目的：一瞬で価値が伝わり「詳しく見たい」と思わせること

【必須ルール】
・画像内に使用するテキストは、必ず記事本文の内容を基に生成する
・誇張しすぎず、ただし広告として弱くならない表現にする
・文字は必ず読みやすく、背景と十分なコントラストを確保する
・日本の広告バナーでよく使われる構成・トーンを踏襲する

【バナーデザイン構成】
1. メインキャッチ（最も伝えたい価値を短く・強く）
2. サブコピー（安心感・具体性・実績・限定性など）
3. 補足要素（実績数値／価格／割引／特徴／権威性など）
4. CTA文言（例：「詳しくはこちら」「今すぐチェック」など）

【ビジュアル指針】
・人物が適切な場合：日本人モデル、自然な表情、広告感のある構図
・商品が主役の場合：清潔感・高級感・信頼感を重視
・教育／ビジネス系：青・紫・黒系を基調に信頼感を演出
・美容／EC系：白・ベージュ・淡色を基調に上品さを演出
・セール／キャンペーン系：赤・オレンジ・黄色で緊急性を演出

【禁止事項】
・意味のない装飾
・読みづらい極小文字
・記事内容と乖離したコピー
・英語の多用（日本向け広告のため）

【入力】
▼ 記事本文テキスト：
${String(article.finalMarkdown || '').slice(0, 7000)}

【出力】
・1枚の完成された広告バナー画像
・視認性が高く、広告として即利用可能なクオリティ`

    const result = await generateBanners(
      category,
      title,
      '1200x628',
      {
        purpose: 'sns_ad',
        customImagePrompt: prompt,
      },
      1
    )

    // 保存用のプロンプトログ（表示用）
    const promptLog = prompt
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
