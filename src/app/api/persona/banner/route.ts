// ========================================
// ドヤペルソナAI - バナー画像生成API
// ========================================
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { resolvePersonaImageInput, generateAndSavePersonaImage } from '@/lib/persona/image-generation'
import { PERSONA_BANNER_SIZES as BANNER_SIZES, resolvePersonaBannerSize } from '@/lib/persona/banner-size'

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
    const resolved = await resolvePersonaImageInput(session.user.id, body, 'banner')
    if ('response' in resolved) return resolved.response
    const { persona } = resolved.input
    const { serviceName, catchphrase } = body
    if (typeof catchphrase !== 'string' || !catchphrase.trim() || catchphrase.length > 2000 ||
        (serviceName != null && (typeof serviceName !== 'string' || serviceName.length > 300))) {
      return NextResponse.json({ error: 'キャッチコピーと画像サイズを確認してください。' }, { status: 400 })
    }

    let size: { width: number; height: number; label: string }
    try { size = resolvePersonaBannerSize(body) }
    catch { return NextResponse.json({ error: '有効なサイズを選択してください。カスタムサイズは縦横それぞれ200〜2048の整数で指定してください。' }, { status: 400 }) }
    const { width, height, label: sizeLabel } = size

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
8. The final image will be center-cropped to the specified aspect ratio. Keep all text, logos and the CTA inside the central safe area matching that aspect ratio; use expendable background only outside it.

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

    return await generateAndSavePersonaImage(resolved.input, requestBody, { size }, { width, height })
  } catch (error) {
    console.error('Banner generation error:', error)
    return NextResponse.json(
      { error: 'バナー生成中にエラーが発生しました' },
      { status: 500 }
    )
  }
}

// サイズ一覧を取得するGETエンドポイント
export async function GET() {
  return NextResponse.json({ sizes: BANNER_SIZES })
}

