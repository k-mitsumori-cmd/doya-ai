import { NextRequest, NextResponse } from 'next/server'

// ========================================
// AIバナーコーチ（画像FB）
// ========================================
// POST /api/banner/coach/image
// 選択された生成バナー画像を元に、改善フィードバックと「修正指示文」を作る
//
// モデル: gemini-3-flash-preview（高速/安価に画像理解）
// 参考: https://ai.google.dev/gemini-api/docs/gemini-3?hl=ja
//       https://ai.google.dev/gemini-api/docs/image-generation?hl=ja

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_3_FLASH_MODEL = 'gemini-3-flash-preview'

interface CoachImageRequest {
  image: string // data URL
  category: string
  useCase: string
  variant?: 'A' | 'B' | 'C'
  keyword?: string
}

interface CoachImageResponse {
  success: boolean
  data?: {
    summary: string
    strengths: string[]
    issues: string[]
    quickWins: string[]
    suggestedCopy: string
    suggestedOverlay: {
      headline: string
      subhead: string
      cta: string
    }
    // /api/banner/refine にそのまま投げられる「修正指示」
    refineInstruction: string
  }
  error?: string
}

function getApiKey(): string {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_GENAI_API_KEY が設定されていません')
  return apiKey
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!m) throw new Error('image の形式が不正です（data URLを期待）')
  return { mimeType: m[1], data: m[2] }
}

function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<CoachImageResponse>> {
  try {
    const body: CoachImageRequest = await request.json()
    const { image, category, useCase, variant, keyword } = body

    if (!image || typeof image !== 'string') {
      return NextResponse.json({ success: false, error: '画像がありません' }, { status: 400 })
    }
    if (!category || !useCase) {
      return NextResponse.json({ success: false, error: 'category と useCase は必須です' }, { status: 400 })
    }

    const apiKey = getApiKey()
    const parsed = parseDataUrl(image)

    const endpoint = `${GEMINI_API_BASE}/models/${GEMINI_3_FLASH_MODEL}:generateContent`

    const prompt = `
You are an expert ad creative director and conversion copywriter.
Analyze the provided banner image for Japanese marketing.

Context:
- Category: ${category}
- Use case: ${useCase}
- Variant: ${variant || 'unknown'}
- Keyword/copy (if provided): ${keyword || '(none)'}

Output STRICT JSON only. No markdown. No extra text.

JSON schema:
{
  "summary": "one sentence",
  "strengths": ["..."],
  "issues": ["..."],
  "quickWins": ["..."],
  "suggestedCopy": "a higher-CTR Japanese catchcopy (<= 60 chars)",
  "suggestedOverlay": { "headline": "...", "subhead": "...", "cta": "..." },
  "refineInstruction": "Japanese instruction to regenerate/refine the image (no logos, no watermarks)."
}

Rules:
- Focus on readability at mobile size, clear hierarchy, CTA clarity, contrast, whitespace, and ad compliance.
- Do NOT recommend adding any invented logos/emblems/watermarks/brand marks.
- Prefer leaving a solid area for text overlay and a clear CTA shape.
`

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inlineData: { mimeType: parsed.mimeType, data: parsed.data } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1200,
        },
      }),
    })

    if (!res.ok) {
      const t = await res.text()
      return NextResponse.json(
        { success: false, error: `API Error: ${res.status} - ${t.substring(0, 300)}` },
        { status: 500 }
      )
    }

    const json = await res.json()
    const parts = json?.candidates?.[0]?.content?.parts
    const text = Array.isArray(parts)
      ? parts.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).join('\n').trim()
      : ''

    const parsedOut = safeJsonParse<CoachImageResponse['data']>(text)
    if (!parsedOut) {
      return NextResponse.json(
        { success: false, error: 'FBのJSON解析に失敗しました（モデル出力が不正）' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: parsedOut })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 500 })
  }
}


