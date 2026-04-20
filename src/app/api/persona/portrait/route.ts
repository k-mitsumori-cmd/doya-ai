// ========================================
// ドヤペルソナAI - ポートレート画像生成API
// ========================================
import { NextRequest, NextResponse } from 'next/server'
import { callGeminiImageAPI } from '@/lib/resolve-image-model'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { persona } = body

    if (!persona) {
      return NextResponse.json({ error: 'ペルソナ情報が必要です' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_GENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'APIキーが設定されていません' }, { status: 500 })
    }

    // ペルソナ情報からプロンプトを構築
    const { name, age, gender, occupation, lifestyle, personalityTraits } = persona
    
    const prompt = `
Generate a professional headshot portrait photo of a Japanese person for a marketing persona profile.

REQUIREMENTS:
- Age: approximately ${age} years old
- Gender: ${gender === '男性' ? 'male' : gender === '女性' ? 'female' : gender}
- Occupation: ${occupation}
- Personality: ${Array.isArray(personalityTraits) ? personalityTraits.join(', ') : 'professional, friendly'}
- Style: Professional business headshot, clean background, good lighting
- Expression: Confident, approachable smile
- Attire: Business casual appropriate for ${occupation}
- Background: Simple, neutral color (light gray or white)

IMPORTANT:
- This is for a fictional marketing persona, not a real person
- Make the person look authentic and relatable
- High quality, professional photography style
- Face clearly visible, looking at camera
- Upper body / headshot framing

Output a single high-quality portrait image.
`

    // Nano Banana Pro で画像生成（モデル自動解決）
    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseModalities: ['IMAGE'],
        temperature: 0.4,
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
        })

        return res
      }
    }

    return NextResponse.json({ error: '画像の抽出に失敗しました' }, { status: 500 })
  } catch (error) {
    console.error('Portrait generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'ポートレート生成中にエラーが発生しました' },
      { status: 500 }
    )
  }
}

