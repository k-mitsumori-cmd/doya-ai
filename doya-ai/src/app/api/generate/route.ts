import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SAMPLE_TEMPLATES } from '@/lib/templates'
import { generateText } from '@/lib/openai'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // 未ログインでも使用可能（フリーミアムモデル）
    // ただし、使用回数制限はフロントエンドで管理

    const { templateId, inputs, tone, length } = await req.json()

    // テンプレートを取得
    const template = SAMPLE_TEMPLATES.find(t => t.id === templateId)

    if (!template) {
      return NextResponse.json({ error: 'テンプレートが見つかりません' }, { status: 404 })
    }

    // プロンプトを構築
    let prompt = template.prompt
    
    // 入力値でプロンプトの変数を置換
    for (const [key, value] of Object.entries(inputs)) {
      prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), value as string)
    }

    // トーン調整の指示を追加
    if (tone) {
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
    if (length) {
      const lengthInstructions: Record<string, string> = {
        'short': '簡潔に、短めに（500文字以内で）書いてください。',
        'medium': '適度な長さで（1000文字程度で）書いてください。',
        'long': '詳細に、長めに（2000文字以上で）書いてください。',
      }
      if (lengthInstructions[length]) {
        prompt += `\n\n${lengthInstructions[length]}`
      }
    }

    // OpenAI APIを使用してテキスト生成
    const output = await generateText(prompt, inputs)

    return NextResponse.json({
      success: true,
      output,
      generation: {
        id: `gen-${Date.now()}`,
        output,
        outputType: 'TEXT',
        templateId,
        userId: session?.user?.id || 'anonymous',
        createdAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Generation error:', error)
    return NextResponse.json(
      { error: 'コンテンツの生成中にエラーが発生しました。しばらくしてからもう一度お試しください。' },
      { status: 500 }
    )
  }
}
