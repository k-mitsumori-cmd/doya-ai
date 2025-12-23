import { NextRequest, NextResponse } from 'next/server'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

/**
 * テキスト生成モデルの優先順位
 * - gemini-2.0-flash が安定かつ高速
 * - gemini-1.5-flash はレガシーだが確実に存在
 */
function getTextModels(): string[] {
  const envModel =
    process.env.DOYA_BANNER_TEXT_MODEL ||
    process.env.GEMINI_PRO3_MODEL ||
    process.env.GEMINI_TEXT_MODEL ||
    null
  const defaults = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']
  return envModel ? [envModel, ...defaults] : defaults
}

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

/**
 * AIアドバイザーのペルソナ（提案型＋質問で終わる）
 */
const AI_ADVISOR_SYSTEM_PROMPT = `あなたは「ドヤバナーAI」の専属バナー制作アドバイザーです。
プロのマーケターとして、ユーザーの要望に「提案」で応え、必ず「バナー制作に関する質問」で返答を終えてください。

【あなたの役割】
- 要望を受け取ったら、すぐに具体的なバナー案を"提案"する
- 「〜がおすすめです」「〜はいかがでしょう？」など提案トーンで話す
- 返答の最後は必ず「バナーに載せるキャッチコピーはどうしますか？」「どんな写真やイメージを使いましょう？」など、バナー制作を前に進める質問で締める

【許可される値】
- purpose: ${ALLOWED_PURPOSES.join(', ')}
- category: ${ALLOWED_CATEGORIES.join(', ')}
- size: "幅x高さ" (例: "1080x1080")
- keyword: 200文字以内（バナーに載せる訴求コピー）
- imageDescription: 300文字以内（画像イメージの説明。任意）
- brandColors: ["#RRGGBB", ...] 最大8色（任意）

【出力JSONスキーマ】
{
  "needsMoreInfo": boolean,
  "questions": string[] | null,
  "reply": string,
  "spec": { "purpose": string, "category": string, "size": string, "keyword": string, "imageDescription"?: string, "brandColors"?: string[] } | null
}

【重要ルール】
- needsMoreInfo が true の場合は spec を null にして、questionsに具体的な選択肢を入れる
- reply は日本語で短く、必ず「？」で終わる質問文にする
- JSON以外は一切出力しない（\`\`\`も禁止）
- 情報が足りなくても"仮の提案"を返し、質問で確認を促す

【返答例（必ず質問で終わる）】
- 「Instagram向けの美容系バナーですね。バナーに入れる『キャッチコピー』や『写真のイメージ』を教えていただけますか？」
- 「採用向けバナーなら、1200×628サイズがおすすめです。『未経験歓迎』のような訴求コピーを入れますか？」
- 「ECサイト向けのセールバナーですね。割引率や商品名など、目立たせたい情報はありますか？」
`

type BannerSpec = {
  purpose: (typeof ALLOWED_PURPOSES)[number]
  category: (typeof ALLOWED_CATEGORIES)[number]
  size: string
  keyword: string
  imageDescription?: string
  brandColors?: string[]
}

function getGeminiKey(): string | null {
  return (
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
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
    // Try to salvage JSON from within markdown or extra text
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

function normalizeHex(v: string): string | null {
  const s = String(v || '').trim()
  const m = s.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
  if (!m) return null
  const raw = m[1]
  const hex = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw
  return `#${hex.toUpperCase()}`
}

function coerceSpec(raw: any): { spec?: BannerSpec; needsMoreInfo: boolean; questions?: string[] } {
  const needs: string[] = []

  const purpose = String(raw?.spec?.purpose || raw?.purpose || 'sns_ad')
  const category = String(raw?.spec?.category || raw?.category || 'other')
  const size = String(raw?.spec?.size || raw?.size || '1080x1080')
  const keyword = String(raw?.spec?.keyword || raw?.keyword || '').trim()
  const imageDescription = String(raw?.spec?.imageDescription || raw?.imageDescription || '').trim()

  const okPurpose = (ALLOWED_PURPOSES as readonly string[]).includes(purpose)
  const okCategory = (ALLOWED_CATEGORIES as readonly string[]).includes(category)

  if (!keyword) needs.push('例えば「初回20%OFF」「今だけ送料無料」などのコピーはいかがでしょう？')

  const brandColors =
    Array.isArray(raw?.spec?.brandColors || raw?.brandColors) ?
      (raw?.spec?.brandColors || raw?.brandColors)
        .map((x: any) => (typeof x === 'string' ? normalizeHex(x) : null))
        .filter((x: string | null): x is string => typeof x === 'string')
        .slice(0, 8) :
      undefined

  if (needs.length > 0) {
    return { needsMoreInfo: true, questions: needs }
  }

  return {
    needsMoreInfo: false,
    spec: {
      purpose: (okPurpose ? purpose : 'sns_ad') as BannerSpec['purpose'],
      category: (okCategory ? category : 'other') as BannerSpec['category'],
      size: size || '1080x1080',
      keyword: keyword.slice(0, 200),
      imageDescription: imageDescription ? imageDescription.slice(0, 300) : undefined,
      brandColors: brandColors && brandColors.length > 0 ? brandColors : undefined,
    },
  }
}

async function callGemini(messages: ChatMessage[], apiKey: string): Promise<string> {
  const contents = (messages || []).slice(-12).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  // system prompt を最初の user に混ぜる
  if (contents.length === 0) {
    contents.push({ role: 'user', parts: [{ text: AI_ADVISOR_SYSTEM_PROMPT }] })
  } else if (contents[0].role === 'user') {
    contents[0].parts[0].text = `${AI_ADVISOR_SYSTEM_PROMPT}\n\n---\n\n${contents[0].parts[0].text}`
  } else {
    contents.unshift({ role: 'user', parts: [{ text: AI_ADVISOR_SYSTEM_PROMPT }] })
  }

  const models = getTextModels()
  let lastError: string | null = null

  for (const model of models) {
    try {
      const endpoint = `${GEMINI_API_BASE}/models/${model}:generateContent`
      const res = await fetch(`${endpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { temperature: 0.4, maxOutputTokens: 1000, topP: 0.9, topK: 40 },
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
      const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => (p?.text ? String(p.text) : '')).join('\n').trim()
      if (!text) {
        lastError = `Gemini ${model} returned empty text`
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

export async function POST(req: NextRequest) {
  try {
    const apiKey = getGeminiKey()
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AIチャット用のAPIキーが設定されていません（GOOGLE_AI_API_KEY / GEMINI_API_KEY / GOOGLE_GENAI_API_KEY）。' },
        { status: 503 }
      )
    }

    const body = await req.json()
    const messages = Array.isArray(body?.messages) ? (body.messages as ChatMessage[]) : []

    if (messages.length === 0) {
      return NextResponse.json(
        { error: 'メッセージが空です。' },
        { status: 400 }
      )
    }

    const rawText = await callGemini(messages, apiKey)
    const parsed = extractJsonObject(rawText)

    if (!parsed || typeof parsed !== 'object') {
      return NextResponse.json(
        { error: 'AIの出力を解析できませんでした。もう一度お試しください。', raw: rawText },
        { status: 502 }
      )
    }

    // こちらでも最低限の整合性を担保
    const coerced = coerceSpec(parsed)
    if (coerced.needsMoreInfo) {
      const qs = coerced.questions || []
      return NextResponse.json({
        needsMoreInfo: true,
        questions: qs,
        reply: parsed.reply || `以下のような内容はいかがでしょう？\n・${qs.join('\n・')}`,
        spec: null,
      })
    }

    return NextResponse.json({
      needsMoreInfo: false,
      questions: null,
      reply: parsed.reply || '承知しました。この条件でバナーを作成します！「生成する」ボタンでスタートしてください。',
      spec: coerced.spec,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'AIチャット処理に失敗しました。' },
      { status: 500 }
    )
  }
}



