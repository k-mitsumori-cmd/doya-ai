import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SAMPLE_TEMPLATES } from '@/lib/templates'
import { generateTextWithGemini, getGeminiModelName } from '@/lib/gemini-text'

// レート制限用（本番環境ではRedisなどを使用することを推奨）
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1分
const RATE_LIMIT_MAX = 10 // 1分あたり最大10リクエスト

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return false
  }
  
  record.count++
  return true
}

export async function POST(req: NextRequest) {
  try {
    const disableLimits = process.env.DOYA_DISABLE_LIMITS === '1'
    // IPアドレスでのレート制限
    const ip = req.headers.get('x-forwarded-for') || 
               req.headers.get('x-real-ip') || 
               'unknown'
    
    if (!disableLimits && !checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'リクエストが多すぎます。しばらくしてからお試しください。' },
        { status: 429 }
      )
    }

    const session = await getServerSession(authOptions)
    
    // 未ログインでも使用可能（フリーミアムモデル）
    // ただし、使用回数制限はフロントエンドで管理

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { error: 'リクエストの形式が正しくありません。' },
        { status: 400 }
      )
    }

    const { templateId, inputs, tone, length } = body

    if (!templateId) {
      return NextResponse.json(
        { error: 'テンプレートIDが必要です。' },
        { status: 400 }
      )
    }

    if (!inputs || typeof inputs !== 'object') {
      return NextResponse.json(
        { error: '入力データが必要です。' },
        { status: 400 }
      )
    }

    // テンプレートを取得
    const template = SAMPLE_TEMPLATES.find(t => t.id === templateId)

    if (!template) {
      return NextResponse.json(
        { error: 'テンプレートが見つかりません。' },
        { status: 404 }
      )
    }

    // プロンプトを構築
    let prompt = template.prompt
    
    // 入力値でプロンプトの変数を置換
    for (const [key, value] of Object.entries(inputs)) {
      if (typeof value === 'string') {
        // XSS対策: 入力値をサニタイズ
        const sanitizedValue = value
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .substring(0, 5000) // 長さ制限
        prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), sanitizedValue)
      }
    }

    // トーン調整の指示を追加
    if (tone && typeof tone === 'string') {
      const toneInstructions: Record<string, string> = {
        'professional': '専門的でビジネスライクなトーンで書いてください。',
        'casual': 'カジュアルで親しみやすいトーンで書いてください。',
        'friendly': 'フレンドリーで温かみのあるトーンで書いてください。',
        'formal': 'フォーマルで丁寧なトーンで書いてください。',
        'energetic': 'エネルギッシュで活気のあるトーンで書いてください。',
      }
      if (toneInstructions[tone]) {
        prompt += `\n\n${toneInstructions[tone]}`
      }
    }

    // 長さ調整の指示を追加
    if (length && typeof length === 'string') {
      const lengthInstructions: Record<string, string> = {
        'short': '簡潔に、短めに（500文字以内で）書いてください。',
        'medium': '適度な長さで（1000文字程度で）書いてください。',
        'long': '詳細に、長めに（2000文字以上で）書いてください。',
      }
      if (lengthInstructions[length]) {
        prompt += `\n\n${lengthInstructions[length]}`
      }
    }

    // Gemini 2.0 Flashを使用してテキスト生成（高速・高品質）
    const output = await generateTextWithGemini(prompt, inputs, {
      temperature: 0.8,
      maxOutputTokens: 8192,
    })

    if (!output) {
      return NextResponse.json(
        { error: 'コンテンツの生成に失敗しました。' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      output,
      model: getGeminiModelName(),
      generation: {
        id: `gen-${Date.now()}`,
        output,
        outputType: 'TEXT',
        templateId,
        userId: session?.user?.id || 'anonymous',
        createdAt: new Date().toISOString(),
        model: getGeminiModelName(),
      },
    })
  } catch (error: any) {
    console.error('Generation error:', error)
    
    // Gemini APIのエラーハンドリング
    if (error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
      return NextResponse.json(
        { error: 'APIの利用制限に達しました。しばらくしてからお試しください。' },
        { status: 503 }
      )
    }
    
    if (error.message?.includes('rate') || error.message?.includes('429')) {
      return NextResponse.json(
        { error: 'リクエストが集中しています。しばらくしてからお試しください。' },
        { status: 429 }
      )
    }
    
    return NextResponse.json(
      { error: 'コンテンツの生成中にエラーが発生しました。しばらくしてからもう一度お試しください。' },
      { status: 500 }
    )
  }
}
