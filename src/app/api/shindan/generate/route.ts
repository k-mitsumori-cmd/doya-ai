// ========================================
// ドヤ診断AI - ビジネス診断API（選択カテゴリ対応）
// ========================================
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  SHINDAN_PRICING,
  getShindanDailyLimitByUserPlan,
  shouldResetDailyUsage,
  getTodayDateJST,
  isWithinFreeHour,
} from '@/lib/pricing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ===== HTML解析ユーティリティ =====
function extractTextFromHTML(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000)
}

function extractMetaTags(html: string): Record<string, string> {
  const meta: Record<string, string> = {}
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleMatch) meta.title = titleMatch[1].trim()
  const metaRegex = /<meta[^>]+>/gi
  let match
  while ((match = metaRegex.exec(html)) !== null) {
    const tag = match[0]
    const nameMatch = tag.match(/(?:name|property)=["']([^"']+)["']/i)
    const contentMatch = tag.match(/content=["']([^"']+)["']/i)
    if (nameMatch && contentMatch) meta[nameMatch[1]] = contentMatch[1]
  }
  return meta
}

function extractHeadings(html: string): string[] {
  const headings: string[] = []
  const regex = /<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi
  let match
  while ((match = regex.exec(html)) !== null) headings.push(match[1].trim())
  return headings.slice(0, 10)
}

// ===== JSON修復 =====
function repairJson(str: string): string {
  let jsonStr = str.trim()
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) jsonStr = jsonMatch[1].trim()
  const firstBrace = jsonStr.indexOf('{')
  const lastBrace = jsonStr.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonStr = jsonStr.slice(firstBrace, lastBrace + 1)
  }
  const ob = (jsonStr.match(/{/g) || []).length
  const cb = (jsonStr.match(/}/g) || []).length
  const oB = (jsonStr.match(/\[/g) || []).length
  const cB = (jsonStr.match(/]/g) || []).length
  if (oB > cB) jsonStr += ']'.repeat(oB - cB)
  if (ob > cb) jsonStr += '}'.repeat(ob - cb)
  jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1')
  return jsonStr
}

// ===== カテゴリ定義 =====
const CATEGORY_LABELS: Record<string, string> = {
  marketing: '集客力',
  sales: '営業力',
  customer: '顧客対応力',
  organization: '組織力',
  finance: '財務健全性',
  digital: 'デジタル活用',
  strategy: '経営戦略',
}

const CATEGORY_WEIGHTS: Record<string, number> = {
  marketing: 0.20,
  sales: 0.18,
  customer: 0.15,
  organization: 0.15,
  finance: 0.12,
  digital: 0.10,
  strategy: 0.10,
}

// ===== スコアリング =====
const SCALE5_OPTIONS: Record<string, string[]> = {
  leadCount: ['ほぼなし', '月1〜10件', '月11〜50件', '月51〜100件', '月100件以上'],
  measurementMaturity: ['未実施', '一部実施', '定期測定', '分析→改善', '高度に最適化'],
  contentMarketing: ['未着手', '検討中', '開始済み', '定期発信中', '成果実績あり'],
  closeRate: ['〜10%', '11〜20%', '21〜40%', '41〜60%', '60%以上'],
  salesProcess: ['完全に属人的', '一部共有', 'マニュアル化', 'CRM/SFA活用', 'AI活用'],
  leadTime: ['3ヶ月以上', '2〜3ヶ月', '1〜2ヶ月', '2週間〜1ヶ月', '2週間未満'],
  salesAnalysis: ['未実施', '勘と経験', 'Excel管理', 'BI活用', '予測分析'],
  repeatRate: ['〜10%', '11〜30%', '31〜50%', '51〜70%', '70%以上'],
  feedbackCollection: ['未実施', '不定期', '定期収集', 'NPS等で定量化', '改善サイクル連動'],
  afterFollow: ['体制なし', '問合せ対応のみ', '定期連絡', '専任CS担当', '自動+個別最適化'],
  hiringDifficulty: ['非常に困難', 'やや困難', '普通', '比較的容易', '問題なし'],
  roleClarity: ['不明確', '一部不明確', 'おおむね明確', '明確', '評価制度と連動'],
  training: ['制度なし', 'OJTのみ', '年数回の研修', '体系的プログラム', '個別最適化'],
  visionAlignment: ['未策定', '経営層のみ', '一部共有', '全社浸透', '行動指針と連動'],
  growthTrend: ['大幅減少', 'やや減少', '横ばい', '成長中', '急成長'],
  profitMargin: ['赤字', '薄利', '業界並み', 'やや高い', '高い'],
  customerConcentration: ['1社依存', '上位3社で過半', 'やや集中', '分散', '高度に分散'],
  automationLevel: ['ほぼ手作業', '一部自動化', '主要業務を自動化', '全体最適化', 'AI活用自動化'],
  dataAccess: ['バラバラ管理', '一部統合', 'ダッシュボードあり', 'リアルタイム可視化', '予測分析可能'],
  competitiveAdvantage: ['特になし', '価格競争力', '品質・技術力', 'スピード・柔軟性', 'ブランド+独自性'],
}

// カテゴリごとのスコア計算に使う質問ID
const CATEGORY_QUESTION_IDS: Record<string, { scale5: string[]; multiselect: string[] }> = {
  marketing: { scale5: ['leadCount', 'measurementMaturity', 'contentMarketing'], multiselect: ['channels'] },
  sales: { scale5: ['closeRate', 'salesProcess', 'leadTime', 'salesAnalysis'], multiselect: [] },
  customer: { scale5: ['repeatRate', 'feedbackCollection', 'afterFollow'], multiselect: [] },
  organization: { scale5: ['hiringDifficulty', 'roleClarity', 'training', 'visionAlignment'], multiselect: [] },
  finance: { scale5: ['growthTrend', 'profitMargin', 'customerConcentration'], multiselect: [] },
  digital: { scale5: ['automationLevel', 'dataAccess'], multiselect: ['toolsUsed'] },
  strategy: { scale5: ['competitiveAdvantage'], multiselect: [] },
}

function scale5Score(value: string, qId: string): number {
  const opts = SCALE5_OPTIONS[qId]
  if (!opts) return 50
  const idx = opts.indexOf(value)
  return idx >= 0 ? idx * 25 : 50
}

function multiselectScore(selected: string | string[]): number {
  if (!selected || !Array.isArray(selected) || selected.length === 0) return 0
  if (selected.includes('特になし')) return 0
  return Math.round((selected.filter((v) => v !== '特になし').length / 6) * 100)
}

function avg(...values: number[]): number {
  return values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0
}

function calculateCategoryScore(catId: string, answers: Record<string, string | string[]>): number {
  const def = CATEGORY_QUESTION_IDS[catId]
  if (!def) return 0
  const scores: number[] = []
  for (const qId of def.scale5) scores.push(scale5Score(answers[qId] as string, qId))
  for (const qId of def.multiselect) scores.push(multiselectScore(answers[qId]))
  return avg(...scores)
}

function calculateOverallScore(categoryScores: Record<string, number>, selected: string[]): number {
  let totalWeight = 0
  let weightedSum = 0
  for (const id of selected) {
    const w = CATEGORY_WEIGHTS[id] || 0
    weightedSum += (categoryScores[id] || 0) * w
    totalWeight += w
  }
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0
}

// ===== Gemini API =====
async function geminiGenerateJson<T>(prompt: string): Promise<T> {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_GENAI_API_KEY not configured')
  const models = ['gemini-2.0-flash', 'gemini-1.5-flash']
  let lastError: Error | null = null
  for (const model of models) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 4096, responseMimeType: 'application/json' },
        }),
      })
      if (!res.ok) {
        lastError = new Error(`Gemini ${model}: ${res.status} ${(await res.text()).slice(0, 200)}`)
        continue
      }
      const data = await res.json()
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!rawText) { lastError = new Error(`Gemini ${model}: empty`); continue }
      return JSON.parse(repairJson(rawText)) as T
    } catch (e: any) { lastError = e; continue }
  }
  throw lastError || new Error('All Gemini models failed')
}

// ===== ヘルパー =====
function fmt(val: string | string[] | undefined): string {
  if (!val) return '未回答'
  if (Array.isArray(val)) return val.length > 0 ? val.join(', ') : '未回答'
  return val
}

// カテゴリごとの回答セクション生成
const CATEGORY_ANSWER_SECTIONS: Record<string, (a: Record<string, string | string[]>) => string> = {
  marketing: (a) => `■ 集客・マーケティング
- 主な集客チャネル: ${fmt(a.channels)}
- 月間リード獲得数: ${fmt(a.leadCount)}
- マーケティング効果測定: ${fmt(a.measurementMaturity)}
- コンテンツマーケティング: ${fmt(a.contentMarketing)}`,
  sales: (a) => `■ 営業・商談プロセス
- 商談成約率: ${fmt(a.closeRate)}
- 営業プロセス標準化: ${fmt(a.salesProcess)}
- 商談リードタイム: ${fmt(a.leadTime)}
- データ営業分析: ${fmt(a.salesAnalysis)}`,
  customer: (a) => `■ 顧客対応・リテンション
- リピート率: ${fmt(a.repeatRate)}
- フィードバック収集: ${fmt(a.feedbackCollection)}
- アフターフォロー: ${fmt(a.afterFollow)}`,
  organization: (a) => `■ 組織・人材
- 採用の課題度: ${fmt(a.hiringDifficulty)}
- 役割・責任の明確さ: ${fmt(a.roleClarity)}
- 教育・研修制度: ${fmt(a.training)}
- ビジョン浸透度: ${fmt(a.visionAlignment)}`,
  finance: (a) => `■ 財務・収益構造
- 売上成長トレンド: ${fmt(a.growthTrend)}
- 利益率: ${fmt(a.profitMargin)}
- 顧客集中度: ${fmt(a.customerConcentration)}`,
  digital: (a) => `■ デジタル・業務効率化
- 利用ツール: ${fmt(a.toolsUsed)}
- 業務自動化レベル: ${fmt(a.automationLevel)}
- データアクセス性: ${fmt(a.dataAccess)}`,
  strategy: (a) => `■ 経営戦略・成長投資
- 最優先の成長目標: ${fmt(a.priorityGoal)}
- 最大の成長障壁: ${fmt(a.growthObstacle)}
- 競争優位性: ${fmt(a.competitiveAdvantage)}`,
}

// ===== POST ハンドラ =====
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { answers, selectedCategories, websiteUrl } = body as {
      answers: Record<string, string | string[]>
      selectedCategories: string[]
      websiteUrl?: string
    }

    if (!answers || !answers.industry) {
      return NextResponse.json({ error: '業種は必須です' }, { status: 400 })
    }
    if (!selectedCategories || selectedCategories.length === 0) {
      return NextResponse.json({ error: '診断項目を1つ以上選択してください' }, { status: 400 })
    }

    // 認証 + 回数制限
    const session = await getServerSession(authOptions)
    const isLoggedIn = !!session?.user?.id

    if (isLoggedIn) {
      const user = session.user as any
      const isFreeHour = isWithinFreeHour(user.firstLoginAt)
      if (!isFreeHour) {
        const dailyLimit = getShindanDailyLimitByUserPlan(user.plan)
        if (dailyLimit !== -1) {
          const sub = await prisma.userServiceSubscription.findUnique({
            where: { userId_serviceId: { userId: user.id, serviceId: 'shindan' } },
          })
          const needsReset = !sub || shouldResetDailyUsage(sub.lastUsageReset)
          const currentUsage = needsReset ? 0 : (sub?.dailyUsage ?? 0)
          if (currentUsage >= dailyLimit) {
            return NextResponse.json(
              { error: `本日の診断上限（${dailyLimit}回）に達しました。明日またご利用ください。` },
              { status: 429 }
            )
          }
          const todayJST = new Date(getTodayDateJST())
          await prisma.userServiceSubscription.upsert({
            where: { userId_serviceId: { userId: user.id, serviceId: 'shindan' } },
            update: { dailyUsage: needsReset ? 1 : { increment: 1 }, lastUsageReset: needsReset ? todayJST : undefined },
            create: { userId: user.id, serviceId: 'shindan', plan: 'FREE', dailyUsage: 1, lastUsageReset: todayJST },
          })
        }
      }
    }
    // ゲスト回数制限: 一時的に無効化

    // カテゴリスコア計算（選択カテゴリのみ）
    const categoryScores: Record<string, number> = {}
    for (const catId of selectedCategories) {
      categoryScores[catId] = calculateCategoryScore(catId, answers)
    }
    const overallScore = calculateOverallScore(categoryScores, selectedCategories)

    // WebサイトURL解析
    let websiteInfo = ''
    if (websiteUrl) {
      try {
        const fetchRes = await fetch(websiteUrl, {
          headers: { 'User-Agent': 'DoyaShindanBot/1.0' },
          signal: AbortSignal.timeout(10000),
        })
        if (fetchRes.ok) {
          const html = await fetchRes.text()
          const text = extractTextFromHTML(html)
          const meta = extractMetaTags(html)
          const headings = extractHeadings(html)
          websiteInfo = `\n【Webサイト情報】\nURL: ${websiteUrl}\nタイトル: ${meta.title || '不明'}\n説明: ${meta.description || meta['og:description'] || '不明'}\n見出し: ${headings.join(' / ')}\n本文抜粋: ${text.slice(0, 2000)}\n`
        }
      } catch {}
    }

    // 動的プロンプト構築
    const scoreLines = selectedCategories
      .map((id) => `- ${CATEGORY_LABELS[id]}: ${categoryScores[id]}/100`)
      .join('\n')

    const answerSections = selectedCategories
      .map((id) => CATEGORY_ANSWER_SECTIONS[id]?.(answers) || '')
      .filter(Boolean)
      .join('\n\n')

    const axesTemplate = selectedCategories
      .map((id) => `    { "label": "${CATEGORY_LABELS[id]}", "score": <0-100>, "comment": "<回答データに基づく具体的な短評>" }`)
      .join(',\n')

    const benchmarkTemplate = selectedCategories
      .map((id) => `    { "category": "${CATEGORY_LABELS[id]}", "yourScore": <0-100>, "industryAverage": <0-100> }`)
      .join(',\n')

    const prompt = `あなたは一流のビジネスコンサルタントAIです。以下の診断データをもとに、ビジネスの現状を詳細に診断してください。

【企業プロフィール】
- 業種: ${fmt(answers.industry)}
- 年間売上規模: ${fmt(answers.revenueScale)}
- 従業員数: ${fmt(answers.employeeCount)}
- 創業年数: ${fmt(answers.companyAge)}

【診断対象カテゴリ】
${selectedCategories.map((id) => `- ${CATEGORY_LABELS[id]}`).join('\n')}

【カテゴリ別自己評価スコア（質問回答から算出）】
${scoreLines}
- 加重平均総合スコア: ${overallScore}/100

【具体的な回答内容】
${answerSections}
${websiteInfo}

以下のJSON形式で診断結果を返してください。すべて日本語で記述してください。
診断対象カテゴリのみのaxesとbenchmarkを返してください。

{
  "overallScore": <0-100の総合スコア>,
  "overallGrade": "<S/A/B/C/Dのいずれか。S=90以上, A=75-89, B=60-74, C=40-59, D=39以下>",
  "summary": "<総合的な診断コメント。3-4文で。業種・規模を踏まえた具体的な強みと最重要改善点を含める>",
  "axes": [
${axesTemplate}
  ],
  "strengths": [
    { "title": "<強み1>", "description": "<回答データから読み取れる具体的な強み>", "score": <0-100> },
    { "title": "<強み2>", "description": "<説明>", "score": <0-100> },
    { "title": "<強み3>", "description": "<説明>", "score": <0-100> }
  ],
  "bottlenecks": [
    { "title": "<ボトルネック1>", "description": "<回答から特定された具体的な問題>", "severity": "high", "impact": "<ビジネスへの影響>" },
    { "title": "<ボトルネック2>", "description": "<説明>", "severity": "medium", "impact": "<影響>" },
    { "title": "<ボトルネック3>", "description": "<説明>", "severity": "low", "impact": "<影響>" }
  ],
  "recommendations": [
    { "title": "<アクション1>", "description": "<具体的な施策>", "priority": "high", "estimatedCost": "<コスト>", "estimatedEffect": "<効果>", "timeframe": "<期間>" },
    { "title": "<アクション2>", "description": "<施策>", "priority": "high", "estimatedCost": "<コスト>", "estimatedEffect": "<効果>", "timeframe": "<期間>" },
    { "title": "<アクション3>", "description": "<施策>", "priority": "medium", "estimatedCost": "<コスト>", "estimatedEffect": "<効果>", "timeframe": "<期間>" },
    { "title": "<アクション4>", "description": "<施策>", "priority": "medium", "estimatedCost": "<コスト>", "estimatedEffect": "<効果>", "timeframe": "<期間>" },
    { "title": "<アクション5>", "description": "<施策>", "priority": "low", "estimatedCost": "<コスト>", "estimatedEffect": "<効果>", "timeframe": "<期間>" }
  ],
  "benchmark": [
${benchmarkTemplate}
  ]
}

重要:
- 回答データの具体的な内容に基づいて、この企業固有の診断をしてください
- 自己評価スコアを参考にしつつ、AI独自の分析を加味してスコアを調整
- 売上規模・従業員数に見合った現実的なコスト・効果を提案
- benchmarkの業界平均は日本の同業種・同規模の水準を想定
- JSONのみを返してください`

    const result = await geminiGenerateJson(prompt)

    // ゲストCookie更新
    if (!isLoggedIn) {
      const today = getTodayDateJST()
      const cookieName = 'doya_shindan_guest_usage'
      const cookieVal = req.cookies.get(cookieName)?.value
      let guestCount = 0
      try {
        const parsed = JSON.parse(cookieVal || '{}')
        if (parsed.date === today) guestCount = parsed.count || 0
      } catch {}
      const response = NextResponse.json({ result })
      response.cookies.set(cookieName, JSON.stringify({ date: today, count: guestCount + 1 }), {
        path: '/', maxAge: 86400, httpOnly: false, sameSite: 'lax',
      })
      return response
    }

    return NextResponse.json({ result })
  } catch (err: any) {
    console.error('[shindan/generate] Error:', err)
    return NextResponse.json(
      { error: err?.message || '診断に失敗しました。もう一度お試しください。' },
      { status: 500 }
    )
  }
}
