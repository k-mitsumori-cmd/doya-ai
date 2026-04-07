// ============================================
// ドヤ広告シミュレーションAI - LP URL + 予算 → 全自動生成
// ============================================
// LP URL と月額予算のみ受け取り、Gemini に「シニア広告プランナー」として
// 業種・ターゲット・KPI・媒体配分などすべての項目を判断させる。

import * as cheerio from 'cheerio'
import { generateTextWithGemini } from '../gemini-text'
import { INDUSTRY_BENCHMARKS, MediaId, MEDIA_OPTIONS } from './benchmark'

export interface AutoGenerateInput {
  lpUrl: string
  monthlyBudget: number
  periodMonths?: number
}

export interface AutoGenerateResult {
  clientName: string
  productName: string
  industry: string
  industryName: string
  lpSummary: string
  targetAudience: {
    age: string
    gender: string
    region: string
    interests: string[]
  }
  goals: string[]
  periodMonths: number
  mediaAllocation: Partial<Record<MediaId, number>>
  targetCv: number | null
  targetCpa: number | null
  targetRoas: number | null
  rationale: string
}

// ----------------------------------------
// LP スクレイピング（cheerio）
// ----------------------------------------
async function scrapeLp(url: string): Promise<{
  title: string
  description: string
  h1s: string[]
  bodyText: string
}> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; DoyaAdSimBot/1.0; +https://doya-ai.surisuta.jp/adsim)',
    },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`LP fetch failed: ${res.status}`)
  const html = await res.text()
  const $ = cheerio.load(html)

  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('title').first().text().trim() ||
    ''
  const description =
    $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') ||
    ''
  const h1s: string[] = []
  $('h1, h2').each((_, el) => {
    const t = $(el).text().trim()
    if (t && t.length < 200) h1s.push(t)
  })

  // 本文テキスト（最大4000文字）
  $('script, style, nav, footer, header').remove()
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 4000)

  return {
    title: title.substring(0, 200),
    description: description.substring(0, 400),
    h1s: h1s.slice(0, 10),
    bodyText,
  }
}

// ----------------------------------------
// Gemini プロンプト
// ----------------------------------------
function buildPrompt(
  lp: { title: string; description: string; h1s: string[]; bodyText: string },
  monthlyBudget: number,
  periodMonths: number
): string {
  const industryList = INDUSTRY_BENCHMARKS.map((b) => `${b.id}:${b.name}`).join(', ')
  const mediaList = MEDIA_OPTIONS.map((m) => m.id).join(', ')

  return `あなたは日本のトップ広告代理店で15年以上の経験を持つシニアメディアプランナーです。
クライアントから LP URL と月額予算を提示され、「全部任せるからベストな広告提案を作って」と言われました。
以下の LP 情報を読み解き、最適な提案構成を JSON 形式で返してください。

【LP 情報】
タイトル: ${lp.title}
説明: ${lp.description}
見出し: ${lp.h1s.join(' / ')}
本文抜粋:
${lp.bodyText.substring(0, 2500)}

【予算条件】
月額予算: ¥${monthlyBudget.toLocaleString()}
提案期間: ${periodMonths}ヶ月

【出力ルール】
- 必ず以下の JSON 形式のみで返答（前置き・後置き・コードフェンス禁止）
- industry は次のIDから1つ選ぶ: ${industryList}
- mediaAllocation の合計は必ず100。媒体ID: ${mediaList}
- 商材特性（BtoB/BtoC、視覚訴求/論理訴求）を踏まえて媒体を選定
- ターゲットは LP の文脈から推定
- targetCpa は業界相場と予算から逆算
- rationale は「なぜこの戦略か」を3〜5文で簡潔に

【出力JSONスキーマ】
{
  "clientName": "クライアント名（LPから推定。なければ商材名）",
  "productName": "商品/サービス名",
  "industry": "上記IDから1つ",
  "lpSummary": "LP の内容を1〜2文で要約",
  "targetAudience": {
    "age": "例: 30-45",
    "gender": "例: 女性 / 男女",
    "region": "例: 全国 / 関東",
    "interests": ["興味1", "興味2", "興味3"]
  },
  "goals": ["認知拡大", "リード獲得", "直接購入", "アプリインストール", "来店促進", "ブランディング" のうち1〜3つ],
  "mediaAllocation": {
    "google": 数値, "meta": 数値, "line": 数値, "x": 数値, "tiktok": 数値, "yahoo": 数値
  },
  "targetCv": 数値（月間想定CV数、整数）,
  "targetCpa": 数値（円、整数）,
  "targetRoas": 数値（%、整数。例: 300）,
  "rationale": "戦略理由（3〜5文）"
}
`
}

// ----------------------------------------
// JSON 抽出（Gemini が前置きを付けても拾えるよう正規表現で）
// ----------------------------------------
function extractJson(raw: string): unknown {
  // コードフェンス除去
  let text = raw.trim()
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
  // 最初の { から最後の } までを抽出
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('JSON が見つかりません')
  const slice = text.substring(start, end + 1)
  return JSON.parse(slice)
}

// ----------------------------------------
// メイン: LP + 予算 → 全項目自動生成
// ----------------------------------------
export async function autoGenerateProposal(
  input: AutoGenerateInput
): Promise<AutoGenerateResult> {
  const periodMonths = input.periodMonths ?? 3

  // 1. LP スクレイピング
  const lp = await scrapeLp(input.lpUrl)

  // 2. Gemini で全項目生成
  const prompt = buildPrompt(lp, input.monthlyBudget, periodMonths)
  const raw = await generateTextWithGemini(prompt, {}, { temperature: 0.4, maxOutputTokens: 2048 })
  const parsed = extractJson(raw) as Record<string, any>

  // 3. バリデーション + 正規化
  const validIndustryIds = INDUSTRY_BENCHMARKS.map((b) => b.id)
  let industry = String(parsed.industry || 'other')
  if (!validIndustryIds.includes(industry)) industry = 'other'
  const industryName = INDUSTRY_BENCHMARKS.find((b) => b.id === industry)?.name || 'その他'

  // mediaAllocation の正規化（合計100に補正）
  const validMediaIds: MediaId[] = ['google', 'meta', 'line', 'x', 'tiktok', 'yahoo']
  const rawAlloc = parsed.mediaAllocation || {}
  const cleanedAlloc: Partial<Record<MediaId, number>> = {}
  let allocSum = 0
  for (const m of validMediaIds) {
    const v = Math.max(0, Math.round(Number(rawAlloc[m]) || 0))
    cleanedAlloc[m] = v
    allocSum += v
  }
  if (allocSum === 0) {
    // フォールバック: Google100%
    cleanedAlloc.google = 100
  } else if (allocSum !== 100) {
    // 合計100に正規化
    const factor = 100 / allocSum
    let adjustedSum = 0
    for (const m of validMediaIds) {
      const adjusted = Math.round((cleanedAlloc[m] || 0) * factor)
      cleanedAlloc[m] = adjusted
      adjustedSum += adjusted
    }
    // 端数調整: 最大配分の媒体に差分を寄せる
    const diff = 100 - adjustedSum
    if (diff !== 0) {
      const maxMedia = validMediaIds.reduce((a, b) =>
        (cleanedAlloc[a] || 0) >= (cleanedAlloc[b] || 0) ? a : b
      )
      cleanedAlloc[maxMedia] = (cleanedAlloc[maxMedia] || 0) + diff
    }
  }

  // goals の正規化
  const validGoals = [
    '認知拡大', 'リード獲得', '直接購入', 'アプリインストール', '来店促進', 'ブランディング',
  ]
  const goals: string[] = Array.isArray(parsed.goals)
    ? parsed.goals.map((g: unknown) => String(g)).filter((g: string) => validGoals.includes(g))
    : []
  if (goals.length === 0) goals.push('認知拡大')

  return {
    clientName: String(parsed.clientName || lp.title || 'クライアント様').substring(0, 100),
    productName: String(parsed.productName || lp.title || '').substring(0, 200),
    industry,
    industryName,
    lpSummary: String(parsed.lpSummary || lp.description || '').substring(0, 500),
    targetAudience: {
      age: String(parsed.targetAudience?.age || '').substring(0, 50),
      gender: String(parsed.targetAudience?.gender || '').substring(0, 50),
      region: String(parsed.targetAudience?.region || '').substring(0, 50),
      interests: Array.isArray(parsed.targetAudience?.interests)
        ? parsed.targetAudience.interests.slice(0, 10).map((s: unknown) => String(s))
        : [],
    },
    goals,
    periodMonths,
    mediaAllocation: cleanedAlloc,
    targetCv: parsed.targetCv ? Number(parsed.targetCv) : null,
    targetCpa: parsed.targetCpa ? Number(parsed.targetCpa) : null,
    targetRoas: parsed.targetRoas ? Number(parsed.targetRoas) : null,
    rationale: String(parsed.rationale || '').substring(0, 1000),
  }
}
