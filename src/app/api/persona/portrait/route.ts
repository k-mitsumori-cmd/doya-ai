// ========================================
// ドヤペルソナAI - ポートレート画像生成API
// ========================================
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { resolvePersonaImageInput, generateAndSavePersonaImage } from '@/lib/persona/image-generation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '画像生成にはログインが必要です。', code: 'LOGIN_REQUIRED' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: '入力内容を確認してください。' }, { status: 400 })
    }
    const resolved = await resolvePersonaImageInput(session.user.id, body, 'portrait')
    if ('response' in resolved) return resolved.response
    const { persona } = resolved.input

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

    return await generateAndSavePersonaImage(resolved.input, requestBody)
  } catch (error) {
    console.error('Portrait generation error:', error)
    return NextResponse.json(
      { error: 'ポートレート生成中にエラーが発生しました' },
      { status: 500 }
    )
  }
}

