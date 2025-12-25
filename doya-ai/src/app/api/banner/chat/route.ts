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

function ensureQuestionEnding(text: string): string {
  const s = String(text || '').trim()
  if (!s) return 'キャッチコピーはどうしますか？'
  if (/[？?]\s*$/.test(s)) return s
  return `${s} どんなキャッチコピーにしますか？`
}

function buildSuggestedUserMessages(params: {
  category?: string
  purpose?: string
  hintQuestion?: string
}): string[] {
  const category = String(params.category || '').toLowerCase()
  const purpose = String(params.purpose || '').toLowerCase()
  const q = String(params.hintQuestion || '').trim()

  // 業種別の“そのまま送れる”例（短文・実務寄り）
  const byCategory: Record<string, string[]> = {
    beauty: [
      'キャッチコピーは「初回20%OFF」にします。画像は清潔感のあるモデル写真＋白背景でお願いします。',
      'キャッチコピーは「毛穴、3日で変わる。」にします。自然光の明るいビフォーアフター風でお願いします。',
      'キャッチコピーは「今だけ送料無料」にします。パッケージを大きく、価格感を強めてください。',
    ],
    recruit: [
      'キャッチコピーは「未経験から正社員へ」にします。笑顔の人物写真＋安心感のある配色でお願いします。',
      'キャッチコピーは「残業なし・土日休み」にします。働くイメージが湧く写真でお願いします。',
      'キャッチコピーは「まずは話を聞くだけOK」にします。CTAは「応募する」でお願いします。',
    ],
    it: [
      'キャッチコピーは「手作業を50%削減」にします。モダンなUI画面風でお願いします。',
      'キャッチコピーは「属人化をなくす」にします。青/白基調で信頼感あるトーンにしてください。',
      'キャッチコピーは「最短3日で導入」にします。CTAは「無料で試す」でお願いします。',
    ],
    realestate: [
      'キャッチコピーは「失敗しない家選び」にします。生活イメージの写真で安心感を出してください。',
      'キャッチコピーは「納得できる物件だけ」にします。落ち着いた上質トーンでお願いします。',
      'キャッチコピーは「選ばれている理由、公開」にします。CTAは「無料相談」でお願いします。',
    ],
    ec: [
      'キャッチコピーは「今だけ30%OFF」にします。商品を主役に、割引を大きくお願いします。',
      'キャッチコピーは「先着100名、限定価格」にします。CTAは「今すぐ買う」でお願いします。',
      'キャッチコピーは「3分で完了、定期便」にします。分かりやすくシンプルにしてください。',
    ],
    education: [
      'キャッチコピーは「初心者でも3ヶ月で習得」にします。何が学べるか一目で分かる構成でお願いします。',
      'キャッチコピーは「今日から学べる○○」にします。信頼感のある配色でお願いします。',
      'キャッチコピーは「無料体験からスタート」にします。CTAは「無料で体験」でお願いします。',
    ],
    food: [
      'キャッチコピーは「今夜、絶対食べたい。」にします。シズル感のある写真でお願いします。',
      'キャッチコピーは「ランチ限定、500円OFF」にします。CTAは「予約する」でお願いします。',
      'キャッチコピーは「テイクアウトOK」にします。メニュー写真を大きくしてください。',
    ],
  }

  const generic = [
    '用途はSNS広告、サイズは1080×1080でお願いします。キャッチコピーは「今だけ○○」にします。',
    'キャッチコピーは「○○で悩む人へ」にします。画像は人物写真メインでお願いします。',
    '色は青/白基調でお願いします。CTAは「今すぐチェック」にします。',
  ]

  const fromCat = byCategory[category] || generic
  const picked = fromCat.slice(0, 3)
  // 用途がYouTubeならサムネ寄りの例も差し込む
  if (purpose === 'youtube') {
    return [
      'YouTubeサムネ用です。キャッチは短く「知らないと損」にします。表情強めの人物でお願いします。',
      ...picked.slice(0, 2),
    ]
  }
  if (q) {
    // 質問に寄せた例を先頭に足す（長くしすぎない）
    return [picked[0], picked[1], picked[2]].filter(Boolean)
  }
  return picked
}

async function callGemini(messages: ChatMessage[], apiKey: string): Promise<string> {
  // 最新12件を使用（古い履歴は切り落とす）
  const recentMessages = (messages || []).slice(-12)

  // まずシステムプロンプトを含むダミー user メッセージを先頭に追加
  const contents: { role: string; parts: { text: string }[] }[] = [
    { role: 'user', parts: [{ text: `${AI_ADVISOR_SYSTEM_PROMPT}\n\n以下はこれまでの会話履歴です。会話の文脈を踏まえて回答してください。` }] },
  ]

  // Gemini は user/model が交互である必要があるため、履歴を追加する前に model の応答を入れる
  if (recentMessages.length > 0) {
    // システムプロンプトへのダミー応答（Geminiが期待する交互パターンを維持）
    contents.push({ role: 'model', parts: [{ text: '承知しました。バナー制作についてお手伝いします。' }] })
  }

  // 過去の会話を追加（user/model を正しくマッピング）
  for (const m of recentMessages) {
    contents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })
  }

  const models = getTextModels()
  let lastError: string | null = null

  for (const model of models) {
    try {
      const endpoint = `${GEMINI_API_BASE}/models/${model}:generateContent`
      const buildBody = (jsonMode: boolean) => ({
        contents,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1000,
          topP: 0.9,
          topK: 40,
          ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
        ],
      })

      const attempt = async (jsonMode: boolean) =>
        fetch(`${endpoint}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildBody(jsonMode)),
        })

      let res = await attempt(true)
      if (res.status === 502 || res.status === 503) {
        await new Promise((r) => setTimeout(r, 700))
        res = await attempt(true)
      }

      if (!res.ok) {
        const t = await res.text()
        // JSONモードが弾かれたら通常モードで再試行
        if (
          res.status === 400 &&
          (t.includes('responseMimeType') || t.includes('response_mime_type') || t.includes('INVALID_ARGUMENT'))
        ) {
          let retry = await attempt(false)
          if (retry.status === 502 || retry.status === 503) {
            await new Promise((r) => setTimeout(r, 700))
            retry = await attempt(false)
          }
          if (retry.ok) {
            const json = await retry.json()
            const text = json?.candidates?.[0]?.content?.parts
              ?.map((p: any) => (p?.text ? String(p.text) : ''))
              .join('\n')
              .trim()
            if (text) return text
          } else {
            const t2 = await retry.text()
            lastError = `Gemini ${model} error (retry): ${retry.status} - ${t2.substring(0, 240)}`
            continue
          }
        }
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

    // パースできない場合でも、ユーザー体験としては「質問で返す」ことを優先（エラーで止めない）
    if (!parsed || typeof parsed !== 'object') {
      const reply = ensureQuestionEnding('いいですね。バナーに載せるキャッチコピーと、使いたい写真/イメージはどんな感じにしますか？')
      const suggestions = buildSuggestedUserMessages({})
      return NextResponse.json({
        needsMoreInfo: true,
        questions: ['キャッチコピー案と、写真/イメージの希望を教えてください。'],
        reply,
        spec: null,
        suggestions,
      })
    }

    // こちらでも最低限の整合性を担保
    const coerced = coerceSpec(parsed)
    if (coerced.needsMoreInfo) {
      const qs = coerced.questions || []
      return NextResponse.json({
        needsMoreInfo: true,
        questions: qs,
        reply: ensureQuestionEnding(parsed.reply || `キャッチコピー案はどうしますか？`),
        spec: null,
        suggestions: buildSuggestedUserMessages({
          category: String(parsed?.spec?.category || parsed?.category || ''),
          purpose: String(parsed?.spec?.purpose || parsed?.purpose || ''),
          hintQuestion: qs[0] || '',
        }),
      })
    }

    return NextResponse.json({
      needsMoreInfo: false,
      questions: null,
      reply: ensureQuestionEnding(parsed.reply || '承知しました。次に、バナーに入れるキャッチコピーはどうしますか？'),
      spec: coerced.spec,
      suggestions: buildSuggestedUserMessages({
        category: coerced.spec?.category,
        purpose: coerced.spec?.purpose,
      }),
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'AIチャット処理に失敗しました。' },
      { status: 500 }
    )
  }
}



