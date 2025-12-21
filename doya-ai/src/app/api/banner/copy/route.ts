import { NextRequest, NextResponse } from 'next/server'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
function getPrimaryTextModel(): string {
  return (
    process.env.DOYA_BANNER_TEXT_MODEL ||
    process.env.GEMINI_PRO3_MODEL ||
    process.env.GEMINI_PRO_3_MODEL ||
    process.env.GEMINI_TEXT_MODEL ||
    'gemini-2.0-flash'
  )
}
const GEMINI_FALLBACK_MODEL = 'gemini-1.5-flash'

const ALLOWED_PURPOSES = ['sns_ad', 'youtube', 'display', 'webinar', 'lp_hero', 'email', 'campaign'] as const
const ALLOWED_CATEGORIES = [
  'telecom',
  'marketing',
  'ec',
  'recruit',
  'beauty',
  'food',
  'realestate',
  'education',
  'finance',
  'health',
  'it',
  'other',
] as const

type CopyRequest = {
  category: string
  purpose: string
  base?: string
  companyName?: string
}

function getGeminiKey(): string | null {
  return (
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    null
  )
}

function extractJsonObject(text: string): any | null {
  const trimmed = String(text || '').trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) return null
    const slice = trimmed.slice(start, end + 1)
    try {
      return JSON.parse(slice)
    } catch {
      return null
    }
  }
}

function uniqStrings(arr: string[]) {
  return Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)))
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const models = [getPrimaryTextModel(), GEMINI_FALLBACK_MODEL]
  let lastError: string | null = null

  for (const model of models) {
    try {
      const endpoint = `${GEMINI_API_BASE}/models/${model}:generateContent`
      const res = await fetch(`${endpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 800, topP: 0.95, topK: 40 },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
          ],
        }),
      })

      if (!res.ok) {
        const t = await res.text()
        lastError = `Gemini ${model} error: ${res.status} - ${t.substring(0, 240)}`
        continue
      }

      const json = await res.json()
      const text = Array.isArray(json?.candidates?.[0]?.content?.parts)
        ? json.candidates[0].content.parts.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).join('\n').trim()
        : ''
      if (!text) {
        lastError = `Gemini ${model} returned empty`
        continue
      }
      return text
    } catch (e: any) {
      lastError = `Gemini ${model} failed: ${e?.message || e}`
      continue
    }
  }

  throw new Error(lastError || 'Gemini failed')
}

function buildCopyPrompt(input: CopyRequest) {
  const purpose = (ALLOWED_PURPOSES as readonly string[]).includes(input.purpose) ? input.purpose : 'sns_ad'
  const category = (ALLOWED_CATEGORIES as readonly string[]).includes(input.category) ? input.category : 'other'
  const base = String(input.base || '').trim()
  const companyName = String(input.companyName || '').trim()

  const purposeHint =
    purpose === 'youtube'
      ? 'YouTubeサムネ用。強いフック（驚き/検証/暴露/保存版）を優先。括弧【】OK。'
      : purpose === 'webinar'
        ? 'ウェビナー告知。参加無料/資料/限定公開/残席などを織り交ぜる。'
        : purpose === 'campaign'
          ? 'セール/キャンペーン。%OFF/期間限定/本日まで/数量限定を優先。'
          : purpose === 'email'
            ? 'メール件名/ヘッダー寄り。短く強く、煽りすぎず。'
            : purpose === 'lp_hero'
              ? 'LPファーストビュー。価値提案を明快に、信頼感も。'
              : purpose === 'display'
                ? '小サイズでも読める短文。3〜10文字の強い核を作る。'
                : 'SNS広告。スクロール停止のため、数字/具体/ベネフィットを優先。'

  const categoryHintMap: Record<string, string> = {
    telecom: '通信費削減/乗り換え/速度/キャッシュバック',
    marketing: 'CV改善/広告費削減/成果/無料診断/事例',
    ec: '割引/送料無料/限定/人気No.1/レビュー',
    recruit: '未経験OK/年収UP/福利厚生/リモート/面談',
    beauty: '初回/体験/透明感/毛穴/時短/上品',
    food: '限定/今だけ/セット/送料無料/シズル',
    realestate: '来場特典/内見/安心/理想/相談',
    education: '最短/合格/無料体験/ロードマップ/転職',
    finance: '家計改善/手数料/無料相談/安心/将来',
    health: '予約/相談/安心/専門/負担軽減',
    it: '業務効率/自動化/AI/導入/無料トライアル',
    other: '成果/時短/無料/今だけ/安心',
  }
  const categoryHint = categoryHintMap[category] || categoryHintMap.other

  const system = [
    'あなたは日本の広告代理店でCTR改善に強いコピーライターです。',
    '以下の条件で「クリックされやすい広告コピー（見出し）」を生成します。',
    '',
    '【絶対ルール】',
    '- 出力はJSONのみ（文章や```は禁止）',
    '- 誇大/虚偽/断定的な医療効果など、規約違反になりうる表現は避ける',
    '- 1行が長すぎると読まれないため、基本は 12〜28文字を中心（最大40文字）',
    '- 数字・具体・限定・ベネフィットのいずれかを必ず入れる（可能なら2つ以上）',
    '- 同じ言い回しの量産は禁止。アングルを変えて差別化する',
    '',
    `【用途ヒント】${purposeHint}`,
    `【業種ヒント】${categoryHint}`,
    companyName ? `【ブランド名】${companyName}（入れる場合は短く）` : '',
    base ? `【現在の文言】${base}（これをベースに改善してOK）` : '',
    '',
    '【生成するアングル（全て混ぜて12案）】',
    '- ベネフィット直球（例：予約が増える/時間が減る）',
    '- 数字訴求（%OFF/回数/時間/金額）',
    '- 限定/緊急（本日まで/先着/残席）',
    '- 不安解消（無料/簡単/失敗しない/返金）',
    '- 社会的証明（人気No.1/導入社数/実績）',
    '- 好奇心（知らないと損/裏ワザ/結論）※YouTubeは強め',
    '',
    '【出力JSONスキーマ】',
    '{ "suggestions": string[] }',
  ]
    .filter(Boolean)
    .join('\n')

  return system
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = getGeminiKey()
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AIコピー用のAPIキーが設定されていません（GOOGLE_AI_API_KEY / GEMINI_API_KEY / GOOGLE_GENAI_API_KEY）。' },
        { status: 503 }
      )
    }

    const body = (await req.json()) as CopyRequest
    const prompt = buildCopyPrompt(body)
    const raw = await callGemini(prompt, apiKey)
    const parsed = extractJsonObject(raw)
    const suggestionsRaw = Array.isArray(parsed?.suggestions) ? parsed.suggestions : []
    const suggestions = uniqStrings(
      suggestionsRaw.map((s: any) => String(s || '').trim()).filter(Boolean)
    ).slice(0, 12)

    if (suggestions.length === 0) {
      return NextResponse.json(
        { error: 'AIの出力を解析できませんでした。', raw },
        { status: 502 }
      )
    }

    return NextResponse.json({ suggestions })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'AIコピー生成に失敗しました。' },
      { status: 500 }
    )
  }
}



