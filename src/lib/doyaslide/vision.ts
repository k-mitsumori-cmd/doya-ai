// ============================================
// ドヤスライド 修正用 Vision リプロンプト
// ============================================
// 現在のスライド画像を Gemini(マルチモーダル) に見せ、「その画像を忠実に再現しつつ
// 指示部分だけ変えた」gpt-image-2 用プロンプトを作らせる。
// （geminiGenerateText は Claude 優先で画像を捨てるため、ここは Gemini に直接画像を渡す）
import { withTimeout } from '@/lib/fetch-timeout'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const VISION_MODEL = process.env.DOYA_VISION_MODEL || 'gemini-2.0-flash'

/** 現在のスライド画像＋修正指示 → gpt-image-2 用の英語プロンプト（忠実再現＋指示反映） */
export async function reviseSlidePrompt(params: {
  imageBase64: string
  mimeType: string
  userInstruction: string
  themeColor: string
}): Promise<string> {
  const apiKey =
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_GENAI_API_KEY (Gemini) が設定されていません')

  const instruction = [
    'あなたはプレゼンスライドの編集アシスタントです。添付は「現在のスライド画像」です。',
    `ユーザーの修正指示: 「${params.userInstruction}」`,
    'この画像を可能な限り忠実に再現しつつ、指示された箇所だけを変更した、gpt-image-2 用の英語の画像生成プロンプトを1つだけ作ってください。',
    '制約:',
    '- 現在のレイアウト・構図・配色・タイポグラフィの雰囲気・要素配置・テキスト内容と位置を維持し、指示された部分のみ変更する',
    `- ブランドカラー ${params.themeColor} を基調にする`,
    '- QRコード/バーコード等のコードは絶対に含めない',
    '- URL/メール/電話/SNSは元画像に写っているもの以外を新たに作らない',
    '- 出力は英語のプロンプト本文のみ（説明・前置き・コードブロックは不要）',
  ].join('\n')

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: params.mimeType, data: params.imageBase64 } },
          { text: instruction },
        ],
      },
    ],
    generationConfig: { temperature: 0.4 },
  }

  return withTimeout(`${VISION_MODEL} vision`, 45000, async (signal) => {
    const res = await fetch(`${GEMINI_API_BASE}/models/${VISION_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal,
    })
    if (!res.ok) {
      throw new Error(`vision reprompt failed (${res.status}): ${(await res.text()).slice(0, 200)}`)
    }
    const json = await res.json()
    const text = ((json?.candidates?.[0]?.content?.parts as any[]) || [])
      .map((p) => (typeof p?.text === 'string' ? p.text : ''))
      .join('')
      .trim()
    if (!text) throw new Error('vision reprompt returned empty')
    return text
  })
}
