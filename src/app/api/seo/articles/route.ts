import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SeoCreateArticleInputSchema } from '@seo/lib/types'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import {
  ensureGuestId,
  getGuestIdFromRequest,
  isTrialActive,
  jstMonthRange,
  normalizeSeoPlan,
  seoMonthlyArticleLimit,
  seoGuestTotalArticleLimit,
  setGuestCookie,
} from '@/lib/seoAccess'
import { getSeoCharLimitByUserPlan } from '@/lib/pricing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await ensureSeoSchema()
    const seoArticle = (prisma as any).seoArticle as any
    const session = await getServerSession(authOptions)
    const user: any = session?.user || null
    const userId = String(user?.id || '').trim()
    const guestId = !userId ? getGuestIdFromRequest(req) : null
    // 生成記事は3ヶ月（約90日）まで保持
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

    // 古い記事は削除（RUNNINGは除外して安全側）
    try {
      await seoArticle.deleteMany({
        where: {
          createdAt: { lt: cutoff },
          status: { not: 'RUNNING' },
        },
      })
    } catch {
      // 失敗しても一覧表示自体は止めない
    }

    const where: any = { createdAt: { gte: cutoff } }
    if (userId) where.userId = userId
    else if (guestId) where.guestId = guestId
    else where.id = '__none__'

    const articles = await seoArticle.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        jobs: { orderBy: { createdAt: 'desc' }, take: 1 },
        // 一覧サムネ用（最新バナー1枚だけ）
        images: {
          where: { kind: 'BANNER' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })
    const res = NextResponse.json({ success: true, articles })
    if (!userId && !guestId) {
      const newGuest = ensureGuestId()
      setGuestCookie(res, newGuest)
    }
    return res
  } catch (e: any) {
    // DB未反映/接続不可でも画面側が404にならないよう、明示的にJSONエラーを返す
    return NextResponse.json(
      { success: false, error: e?.message || 'DBエラー（スキーマ未反映の可能性）', articles: [] },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSeoSchema()
    const session = await getServerSession(authOptions)
    const user: any = session?.user || null
    const userId = String(user?.id || '').trim()
    const plan = normalizeSeoPlan(user?.seoPlan || user?.plan || (userId ? 'FREE' : 'GUEST'))
    const trial = isTrialActive(user?.firstLoginAt || null)
    const trialActive = !!userId && trial.active

    let guestId = !userId ? getGuestIdFromRequest(req) : null
    if (!userId && !guestId) guestId = ensureGuestId()

    // 使用制限（トライアル中は無制限）
    if (!trialActive) {
      if (userId) {
        const limit = seoMonthlyArticleLimit(plan)
        if (limit >= 0) {
          const { start, end } = jstMonthRange(new Date())
          const used = await (prisma as any).seoArticle.count({
            where: { userId, createdAt: { gte: start, lt: end } },
          })
          if (used >= limit) {
            return NextResponse.json(
              { success: false, error: `今月の生成回数の上限に達しました（${limit}回/月）。プランをアップグレードすると増やせます。` },
              { status: 429 }
            )
          }
        }
      } else {
        const limit = seoGuestTotalArticleLimit()
        const used = guestId ? await (prisma as any).seoArticle.count({ where: { guestId } }) : 0
        if (used >= limit) {
          const res = NextResponse.json(
            { success: false, error: `ゲストは${limit}回まで作成できます。ログインすると継続して使えます。` },
            { status: 429 }
          )
          if (guestId) setGuestCookie(res, guestId)
          return res
        }
      }
    }

    const body = await req.json()
    const input = SeoCreateArticleInputSchema.parse(body)
    const createJob = body?.createJob !== false

    // 文字数制限チェック（トライアル中はPRO相当）
    const isGuest = !userId
    const effectivePlan = trialActive ? 'PRO' : plan
    const charLimit = getSeoCharLimitByUserPlan(effectivePlan, isGuest && !trialActive)
    const requestedChars = Number(input.targetChars || 10000)
    
    if (requestedChars > charLimit) {
      const planLabel = isGuest ? 'ゲスト' : (plan === 'PRO' ? 'プロ' : plan === 'ENTERPRISE' ? 'エンタープライズ' : 'フリー')
      return NextResponse.json(
        { 
          success: false, 
          error: `${planLabel}プランでは${charLimit.toLocaleString()}字までの記事を作成できます。${requestedChars.toLocaleString()}字を作成するにはプランのアップグレードが必要です。`,
          charLimit,
          requestedChars,
        },
        { status: 403 }
      )
    }

    const seoArticle = (prisma as any).seoArticle as any
    const seoJob = (prisma as any).seoJob as any

    const article = await seoArticle.create({
      data: {
        status: createJob ? 'RUNNING' : 'DRAFT',
        userId: userId || null,
        guestId: userId ? null : guestId,
        title: input.title,
        keywords: input.keywords as any,
        persona: input.persona || null,
        searchIntent: input.searchIntent || null,
        targetChars: input.targetChars,
        tone: input.tone,
        forbidden: input.forbidden as any,
        referenceUrls: input.referenceUrls as any,
        llmoOptions: (input.llmoOptions ?? undefined) as any,
        // 新機能：依頼テキストと参考画像
        requestText: input.requestText || null,
        referenceImages: input.referenceImages || null,
        autoBundle: (body.autoBundle ?? true) as boolean, // 追加
        // 比較記事（調査型）
        mode: (input.mode ?? 'standard') as any,
        comparisonConfig: (input.comparisonConfig ?? null) as any,
        comparisonCandidates: (input.comparisonCandidates ?? null) as any,
        referenceInputs: (input.referenceInputs ?? null) as any,
      },
    })

    if (!createJob) {
      const res = NextResponse.json({ success: true, articleId: article.id, jobId: null })
      if (!userId && guestId) setGuestCookie(res, guestId)
      return res
    }

    // 分割生成ジョブを作って記事ページ側でadvanceする
    const job = await seoJob.create({ data: { articleId: article.id, status: 'queued', step: 'init', progress: 0 } })
    const res = NextResponse.json({ success: true, articleId: article.id, jobId: job.id })
    if (!userId && guestId) setGuestCookie(res, guestId)
    return res
  } catch (e: any) {
    // バリデーションエラーの詳細を返す
    if (e?.name === 'ZodError') {
      const issues = e.issues?.map((issue: any) => ({
        path: issue.path?.join('.') || 'unknown',
        message: issue.message,
        code: issue.code,
      })) || []
      console.error('Validation error:', JSON.stringify(issues, null, 2))
      return NextResponse.json(
        { 
          success: false, 
          error: 'バリデーションエラー',
          details: issues,
          message: e?.message || '不明なエラー',
        },
        { status: 400 }
      )
    }
    console.error('POST /api/seo/articles error:', e)
    return NextResponse.json(
      { 
        success: false, 
        error: e?.message || '不明なエラー',
        stack: process.env.NODE_ENV === 'development' ? e?.stack : undefined,
      },
      { status: 400 }
    )
  }
}

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
 * PATCH: 古い「文字を入れない」系のバナープロンプトを新しいプロンプトに一括更新
 * 管理者のみ実行可能
 */
export async function PATCH(req: NextRequest) {
  try {
    await ensureSeoSchema()
    
    // 管理者認証
    const session = await getServerSession(authOptions)
    const user: any = session?.user || null
    const email = String(user?.email || '').toLowerCase()
    
    // 管理者メールアドレスのチェック
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())
    if (!adminEmails.includes(email)) {
      return NextResponse.json({ success: false, error: '管理者権限が必要です' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const action = body.action || 'preview'

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
      select: { id: true, title: true, createdAt: true, articleId: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    if (action === 'execute' && oldBanners.length > 0) {
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
    }

    return NextResponse.json({ 
      success: true, 
      count: oldBanners.length,
      preview: oldBanners,
      message: `${oldBanners.length}件のバナーが更新対象です。action: "execute" で更新を実行してください。`,
    })
  } catch (e: any) {
    console.error('migrate-prompts error:', e)
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 500 })
  }
}

