import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { SeoCreateArticleInputSchema } from '@seo/lib/types'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { isTrialActive, normalizeSeoPlan } from '@/lib/seoAccess'
import { createSeoArticleWithinLimit, SeoArticleQuotaError } from '@/lib/seo-article-admission'
import { getSeoCharLimitByUserPlan } from '@/lib/pricing'

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

    if (!userId) {
      return NextResponse.json({ code: 'SEO_ARTICLE_LIMIT', error: '記事を生成するにはログインしてください。' }, { status: 429 })
    }

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
    if (swipeSession.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
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
    const charLimit = getSeoCharLimitByUserPlan(trialActive ? 'PRO' : plan)
    if (targetChars > charLimit) {
      return NextResponse.json(
        {
          error: `文字数上限（${charLimit.toLocaleString()}字）を超えています。プランをアップグレードしてください。`,
        },
        { status: 400 }
      )
    }

    // 記事を作成
    const { article, job } = await createSeoArticleWithinLimit({
      userId, guestId: null, plan, trialActive, createJob: true,
      articleData: {
        ...validated,
        referenceImages: validated.referenceImages ?? undefined,
      },
      afterCreate: async (tx, created) => {
        await tx.swipeSession.update({
          where: { sessionId },
          data: {
            finalConditions: finalConditions as any,
            primaryInfo: primaryInfo as any,
            generatedArticleId: created.id,
            updatedAt: new Date(),
          },
        })
      },
    })

    const res = NextResponse.json({
      success: true,
      articleId: article.id,
      jobId: job!.id,
    })

    return res
  } catch (error: unknown) {
    if (error instanceof SeoArticleQuotaError) {
      return NextResponse.json({ code: 'SEO_ARTICLE_LIMIT',
        error: error.guest ? '記事を生成するにはログインしてください。' : `今月の生成回数の上限に達しました（${error.limit}回/月）。プランをアップグレードすると増やせます。`,
      }, { status: 429 })
    }
    console.error('[seo/template/generate] failed')
    return NextResponse.json(
      { error: '記事の作成に失敗しました。時間をおいて再試行してください。' },
      { status: 503 }
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
