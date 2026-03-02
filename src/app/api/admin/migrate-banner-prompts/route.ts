import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'

export const runtime = 'nodejs'

// 新しいデフォルトプロンプト（広告バナー用）
const NEW_BANNER_PROMPT = `あなたは成果の出る広告バナーを専門に制作する一流のマーケティングデザイナーです。
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

【出力】
・1枚の完成された広告バナー画像
・視認性が高く、広告として即利用可能なクオリティ`

/**
 * 古い「文字を入れない」系のバナープロンプトを新しいプロンプトに一括更新
 * 管理者のみ実行可能
 */
export async function POST(req: NextRequest) {
  try {
    await ensureSeoSchema()
    
    // 管理者認証（必要に応じて調整）
    const session = await getServerSession(authOptions)
    const user: any = session?.user || null
    const email = String(user?.email || '').toLowerCase()
    
    // 管理者メールアドレスのチェック（環境変数または固定値）
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())
    if (!adminEmails.includes(email)) {
      return NextResponse.json({ success: false, error: '管理者権限が必要です' }, { status: 403 })
    }

    // 古いプロンプトを含むBANNER画像を検索
    const oldBanners = await (prisma as any).seoImage.findMany({
      where: {
        kind: 'BANNER',
        OR: [
          { prompt: { contains: '画像内に文字は一切入れない' } },
          { prompt: { contains: '文字を入れない' } },
          { prompt: { contains: 'ネガティブスペース' } },
          { prompt: { contains: '後から文字を載せられる' } },
          { prompt: { contains: 'あなたは記事バナー' } },
        ],
      },
      select: { id: true, prompt: true },
    })

    if (oldBanners.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: '更新が必要なバナープロンプトはありませんでした',
        updated: 0,
      })
    }

    // 一括更新
    const updateResult = await (prisma as any).seoImage.updateMany({
      where: {
        id: { in: oldBanners.map((b: any) => b.id) },
      },
      data: {
        prompt: NEW_BANNER_PROMPT,
      },
    })

    return NextResponse.json({ 
      success: true, 
      message: `${updateResult.count}件のバナープロンプトを更新しました`,
      updated: updateResult.count,
      ids: oldBanners.map((b: any) => b.id),
    })
  } catch (e: any) {
    console.error('migrate-banner-prompts error:', e)
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 500 })
  }
}

// 更新対象の確認用（実行前のプレビュー）
export async function GET(req: NextRequest) {
  try {
    await ensureSeoSchema()
    
    const session = await getServerSession(authOptions)
    const user: any = session?.user || null
    const email = String(user?.email || '').toLowerCase()
    
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())
    if (!adminEmails.includes(email)) {
      return NextResponse.json({ success: false, error: '管理者権限が必要です' }, { status: 403 })
    }

    // 古いプロンプトを含むBANNER画像を検索（プレビュー）
    const oldBanners = await (prisma as any).seoImage.findMany({
      where: {
        kind: 'BANNER',
        OR: [
          { prompt: { contains: '画像内に文字は一切入れない' } },
          { prompt: { contains: '文字を入れない' } },
          { prompt: { contains: 'ネガティブスペース' } },
          { prompt: { contains: '後から文字を載せられる' } },
          { prompt: { contains: 'あなたは記事バナー' } },
        ],
      },
      select: { id: true, title: true, createdAt: true, articleId: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({ 
      success: true, 
      count: oldBanners.length,
      preview: oldBanners,
      message: `${oldBanners.length}件のバナーが更新対象です。POSTリクエストで更新を実行してください。`,
    })
  } catch (e: any) {
    console.error('migrate-banner-prompts preview error:', e)
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 500 })
  }
}

