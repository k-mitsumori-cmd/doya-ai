import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { SeoCreateArticleInputSchema } from '@seo/lib/types'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import {
  ensureGuestId,
  getGuestIdFromRequest,
  isTrialActive,
  jstDayRange,
  normalizeSeoPlan,
  seoDailyArticleLimit,
  setGuestCookie,
} from '@/lib/seoAccess'
import { getSeoCharLimitByUserPlan } from '@/lib/pricing'
import { notifyApiError } from '@/lib/errorHandler'

/**
 * スワイプ結果から記事を生成するAPI
 */
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

    const body = await req.json().catch(() => ({}))
    const { sessionId, finalConditions, primaryInfo } = body

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    // スワイプセッションを取得
    const swipeSession = await prisma.swipeSession.findUnique({
      where: { sessionId },
    })

    if (!swipeSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // 権限チェック
    if (
      (userId && swipeSession.userId !== userId) ||
      (!userId && swipeSession.guestId !== guestId)
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // 使用制限チェック
    if (!trialActive) {
      if (userId) {
        const limit = seoDailyArticleLimit(plan)
        if (limit >= 0) {
          const { start, end } = jstDayRange(new Date())
          const used = await (prisma as any).seoArticle.count({
            where: { userId, createdAt: { gte: start, lt: end } },
          })
          if (used >= limit) {
            return NextResponse.json(
              {
                error: `1日の生成上限（${limit}件）に達しました。プランをアップグレードするか、明日再度お試しください。`,
              },
              { status: 429 }
            )
          }
        }
      }
    }

    // スワイプ結果から記事生成パラメータを構築
    const swipes = Array.isArray(swipeSession.swipes) ? (swipeSession.swipes as any[]) : []
    const swipeMap = new Map<string, 'yes' | 'no' | 'hold'>()
    swipes.forEach((s: any) => {
      if (s.questionId && s.decision) {
        swipeMap.set(s.questionId, s.decision)
      }
    })

    // 文字数と記事タイプを取得
    const targetChars = finalConditions?.targetChars || 4000
    const articleType = finalConditions?.articleType || '解説記事'

    // 記事タイトルを自動生成（キーワードベース）
    const mainKeyword = swipeSession.mainKeyword
    const title = await generateTitleFromKeyword(mainKeyword, articleType, swipeMap)

    // キーワード配列（メインキーワード + 関連キーワード）
    const keywords = [mainKeyword]

    // 記事タイプからmodeを決定
    const mode = articleType.includes('比較') ? 'comparison_research' : 'standard'

    // LLMOオプションをスワイプ結果から構築
    const llmoOptions: any = {
      tldr: swipeMap.get('q15') === 'yes', // まとめを最初に
      faq: swipeMap.get('q9') === 'yes',
      glossary: swipeMap.get('q10') === 'yes',
      comparison: swipeMap.get('q6') === 'yes' || swipeMap.get('q7') === 'yes',
      quotes: swipeMap.get('q16') === 'yes',
      templates: swipeMap.get('q18') === 'yes',
      objections: swipeMap.get('q17') === 'yes',
      conclusionFirst: swipeMap.get('q15') === 'yes',
    }

    // 一次情報をrequestTextに統合
    const primaryInfoText = buildPrimaryInfoText(primaryInfo)
    const requestText = primaryInfoText
      ? `【一次情報（必ず反映・改変禁止）】\n${primaryInfoText}\n\n【記事構成要件】\n${buildStructureRequirements(swipeMap)}`
      : buildStructureRequirements(swipeMap)

    // 記事生成パラメータ
    const articleInput = {
      title,
      keywords,
      targetChars,
      persona: swipeMap.get('q4') === 'yes' ? '初心者' : '上級者',
      searchIntent: swipeMap.get('q3') === 'yes' ? 'BtoB' : 'BtoC',
      tone: swipeMap.get('q5') === 'yes' ? '営業色強め' : swipeMap.get('q5') === 'hold' ? '営業色中' : '丁寧',
      requestText,
      llmoOptions,
      mode,
      autoBundle: true,
    }

    // バリデーション
    const validated = SeoCreateArticleInputSchema.parse(articleInput)

    // 文字数制限チェック
    const charLimit = getSeoCharLimitByUserPlan(plan, trialActive)
    if (targetChars > charLimit) {
      return NextResponse.json(
        {
          error: `文字数上限（${charLimit.toLocaleString()}字）を超えています。プランをアップグレードしてください。`,
        },
        { status: 400 }
      )
    }

    // 記事を作成
    const seoArticle = (prisma as any).seoArticle as any
    const article = await seoArticle.create({
      data: {
        userId: userId || null,
        guestId: !userId ? guestId : null,
        ...validated,
      },
    })

    // スワイプセッションに記事IDを保存
    await prisma.swipeSession.update({
      where: { sessionId },
      data: {
        finalConditions: finalConditions as any,
        primaryInfo: primaryInfo as any,
        generatedArticleId: article.id,
        updatedAt: new Date(),
      },
    })

    // ジョブを作成して生成を開始
    const seoJob = (prisma as any).seoJob as any
    const job = await seoJob.create({
      data: {
        articleId: article.id,
        status: 'queued',
        progress: 0,
        step: 'init',
      },
    })

    const res = NextResponse.json({
      success: true,
      articleId: article.id,
      jobId: job.id,
    })

    if (!userId && !guestId) {
      setGuestCookie(res, ensureGuestId())
    }

    return res
  } catch (error: any) {
    console.error('[swipe/generate] error:', error)
    await notifyApiError(error, req, 500, { endpoint: 'POST /api/swipe/generate' })
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * キーワードから記事タイトルを生成
 */
async function generateTitleFromKeyword(
  keyword: string,
  articleType: string,
  swipeMap: Map<string, 'yes' | 'no' | 'hold'>
): Promise<string> {
  // 簡易版：キーワードベースのタイトル生成
  // 実際にはGemini APIを使うことも可能
  const typeMap: Record<string, string> = {
    解説記事: 'とは？',
    比較記事: '比較',
    'HowTo / 手順解説': 'のやり方',
    'まとめ・一覧型': 'おすすめ',
  }

  const suffix = typeMap[articleType] || 'とは？'
  return `${keyword}${suffix}｜${articleType}`
}

/**
 * 一次情報テキストを構築
 */
function buildPrimaryInfoText(primaryInfo: any): string {
  if (!primaryInfo) return ''
  const parts: string[] = []
  if (primaryInfo.results) parts.push(`実績・数値データ: ${primaryInfo.results}`)
  if (primaryInfo.experience) parts.push(`実体験・感想: ${primaryInfo.experience}`)
  if (primaryInfo.opinion) parts.push(`独自の考え・スタンス: ${primaryInfo.opinion}`)
  if (primaryInfo.fixedPhrase) parts.push(`必ず含めたい固定文言（言い換え禁止）: ${primaryInfo.fixedPhrase}`)
  return parts.join('\n')
}

/**
 * 構成要件テキストを構築
 */
function buildStructureRequirements(swipeMap: Map<string, 'yes' | 'no' | 'hold'>): string {
  const requirements: string[] = []
  if (swipeMap.get('q6') === 'yes') requirements.push('料金比較表を必ず含める')
  if (swipeMap.get('q7') === 'yes') requirements.push('機能比較表を必ず含める')
  if (swipeMap.get('q8') === 'yes') requirements.push('選び方のチェックリストを必ず含める')
  if (swipeMap.get('q11') === 'yes') requirements.push('導入事例・実績を必ず含める')
  if (swipeMap.get('q12') === 'yes') requirements.push('メリット・デメリットを必ず含める')
  if (swipeMap.get('q13') === 'yes') requirements.push('手順・ステップを必ず含める')
  if (swipeMap.get('q14') === 'yes') requirements.push('ランキング形式で表示する')
  return requirements.join('\n')
}
