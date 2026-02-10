// ========================================
// ドヤペルソナAI - バナー画像生成API
// ========================================
import { NextRequest, NextResponse } from 'next/server'
import { callGeminiImageAPI } from '@/lib/resolve-image-model'

// バナーサイズプリセット
const BANNER_SIZES: Record<string, { width: number; height: number; label: string }> = {
  'google-responsive': { width: 1200, height: 628, label: 'Google レスポンシブ' },
  'google-square': { width: 1200, height: 1200, label: 'Google スクエア' },
  'google-landscape': { width: 1200, height: 900, label: 'Google 横長' },
  'meta-feed': { width: 1080, height: 1080, label: 'Meta フィード' },
  'meta-story': { width: 1080, height: 1920, label: 'Meta ストーリー' },
  'twitter': { width: 1200, height: 675, label: 'Twitter/X' },
  'youtube': { width: 1280, height: 720, label: 'YouTube サムネイル' },
  'display-leaderboard': { width: 728, height: 90, label: 'リーダーボード' },
  'display-rectangle': { width: 300, height: 250, label: 'レクタングル' },
  'display-skyscraper': { width: 160, height: 600, label: 'スカイスクレイパー' },
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { persona, serviceName, catchphrase, sizeKey, customWidth, customHeight } = body

    if (!persona || !catchphrase) {
      return NextResponse.json({ error: 'ペルソナとキャッチコピーが必要です' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_GENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'APIキーが設定されていません' }, { status: 500 })
    }

    // サイズ決定
    let width = 1200
    let height = 628
    let sizeLabel = 'カスタム'

    if (sizeKey && BANNER_SIZES[sizeKey]) {
      const preset = BANNER_SIZES[sizeKey]
      width = preset.width
      height = preset.height
      sizeLabel = preset.label
    } else if (customWidth && customHeight) {
      width = Math.min(2048, Math.max(200, Number(customWidth)))
      height = Math.min(2048, Math.max(200, Number(customHeight)))
    }

    const { name, age, gender, occupation, challenges, goals } = persona

    // バナー生成プロンプト
    const prompt = `
Create a high-converting Japanese advertisement banner.

=== BANNER SPECIFICATIONS ===
Size: ${width}x${height} pixels
Aspect Ratio: ${width > height ? 'landscape' : width < height ? 'portrait' : 'square'}
Platform: ${sizeLabel}

=== TARGET PERSONA ===
- Name: ${name}
- Age: ${age}
- Gender: ${gender}
- Occupation: ${occupation}
- Challenges: ${Array.isArray(challenges) ? challenges.slice(0, 3).join(', ') : 'not specified'}
- Goals: ${Array.isArray(goals) ? goals.slice(0, 2).join(', ') : 'not specified'}

=== CONTENT TO RENDER ===
Headline (MUST BE EXACT): ${catchphrase}
${serviceName ? `Brand/Service: ${serviceName}` : ''}

=== DESIGN REQUIREMENTS ===
1. Japanese text must be perfectly legible (no garbling)
2. Use clean, modern Japanese font style
3. High contrast between text and background
4. Professional, premium look
5. Eye-catching for the target persona
6. Include a clear CTA button area
7. Fill entire canvas - NO letterboxing or empty margins

=== STYLE GUIDELINES ===
- Modern, clean design suitable for Japanese market
- Color scheme appropriate for ${occupation} professional
- Visual elements that resonate with ${age}-year-old ${gender}
- Premium feel, not cheap or generic

=== OUTPUT ===
Single high-quality banner image at exactly ${width}x${height} pixels.
`

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseModalities: ['IMAGE'],
        temperature: 0.5,
        candidateCount: 1,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      ],
    }

    const { response } = await callGeminiImageAPI(apiKey, requestBody)

    const result = await response.json()

    // 画像データを抽出
    const parts = result?.candidates?.[0]?.content?.parts
    if (!Array.isArray(parts)) {
      return NextResponse.json({ error: '画像データが見つかりません' }, { status: 500 })
    }

    for (const part of parts) {
      const inline = part?.inlineData || part?.inline_data
      if (inline?.data && typeof inline.data === 'string') {
        const mimeType = inline?.mimeType || 'image/png'
        const res = NextResponse.json({
          success: true,
          image: `data:${mimeType};base64,${inline.data}`,
          size: { width, height, label: sizeLabel },
        })

        return res
      }
    }

    return NextResponse.json({ error: '画像の抽出に失敗しました' }, { status: 500 })
  } catch (error) {
    console.error('Banner generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'バナー生成中にエラーが発生しました' },
      { status: 500 }
    )
  }
}

// サイズ一覧を取得するGETエンドポイント
export async function GET() {
  return NextResponse.json({ sizes: BANNER_SIZES })
}

