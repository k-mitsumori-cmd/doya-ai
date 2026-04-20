// ========================================
// ドヤペルソナAI - シーン画像生成API
// ========================================
import { NextRequest, NextResponse } from 'next/server'
import { callGeminiImageAPI } from '@/lib/resolve-image-model'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { scenePrompt, persona } = body

    if (!scenePrompt) {
      return NextResponse.json({ error: 'シーンの説明が必要です' }, { status: 400 })
    }

    if (!persona) {
      return NextResponse.json({ error: 'ペルソナ情報が必要です' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_GENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'APIキーが設定されていません' }, { status: 500 })
    }

    const { age, gender, occupation, name, personalityTraits, lifestyle } = persona

    const genderEn = gender === '男性' ? 'male' : gender === '女性' ? 'female' : gender
    const traitsDesc = Array.isArray(personalityTraits) ? personalityTraits.join(', ') : ''

    const prompt = `
Generate a warm, atmospheric lifestyle photograph depicting the following scene:

${scenePrompt}

CRITICAL - CHARACTER CONSISTENCY:
The person in this image MUST look like the SAME person across all generated images for this persona.
- Age: approximately ${age} years old
- Gender: ${genderEn}, Japanese
- Occupation: ${occupation}
${traitsDesc ? `- Personality reflected in expression/posture: ${traitsDesc}` : ''}
${lifestyle ? `- Lifestyle context: ${lifestyle}` : ''}
- IMPORTANT: Keep the same face shape, hairstyle, body build, and overall appearance as the portrait headshot photo
- The person should be recognizable as the same individual in every scene

STYLE REQUIREMENTS:
- Warm, editorial lifestyle photography with natural lighting
- Authentic, relatable daily life moment
- High quality, magazine-style photography
- Well-framed, cinematic composition
- Warm color tones, soft lighting preferred
- NO text or watermarks in the image

IMPORTANT:
- This is for a fictional marketing persona, not a real person
- Make the scene look natural and authentic
- Face should be clearly visible when possible

Output a single high-quality lifestyle photograph.
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
        return NextResponse.json({
          success: true,
          image: `data:${mimeType};base64,${inline.data}`,
        })
      }
    }

    return NextResponse.json({ error: '画像の抽出に失敗しました' }, { status: 500 })
  } catch (error) {
    console.error('Scene generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'シーン画像生成中にエラーが発生しました' },
      { status: 500 }
    )
  }
}
