// ========================================
// ドヤペルソナAI - シーン画像生成API
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
    const resolved = await resolvePersonaImageInput(session.user.id, body, 'scene')
    if ('response' in resolved) return resolved.response
    const { persona, scenePrompt } = resolved.input

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

    return await generateAndSavePersonaImage(resolved.input, requestBody)
  } catch (error) {
    console.error('Scene generation error:', error)
    return NextResponse.json(
      { error: 'シーン画像生成中にエラーが発生しました' },
      { status: 500 }
    )
  }
}
