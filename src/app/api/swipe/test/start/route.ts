import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { geminiGenerateText, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { v4 as uuidv4 } from 'uuid'

/**
 * テスト用スワイプセッション開始API
 * - キーワードを入力して初期質問をAIで生成
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const body = await req.json().catch(() => ({}))
    const { keywords } = body

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: 'keywords is required (array)' }, { status: 400 })
    }

    // session_idを生成
    const sessionId = uuidv4()

    // ゲストIDを取得（未ログイン時）
    const guestId = session?.user?.id
      ? undefined
      : req.cookies.get('guest_id')?.value || uuidv4()

    // セッションをDBに保存
    await prisma.swipeSession.create({
      data: {
        sessionId,
        userId: session?.user?.id || null,
        guestId: session?.user?.id ? null : guestId,
        mainKeyword: keywords.join(', '),
        swipes: [],
      },
    })

    // 初期質問をAIで生成
    const prompt = `あなたはSEO記事作成のための質問を生成するAIです。
入力されたキーワードを分析し、記事を作成するために必要な情報を収集するための最初の質問を1つ生成してください。

入力キーワード: ${keywords.join(', ')}

要件:
- 質問はYes/Noで答えられる形式にしてください
- 記事の種類、ターゲット読者、記事の方向性などに関連する質問にしてください
- 具体的で明確な質問にしてください
- 日本語で質問してください

出力形式:
{
  "question": "質問文",
  "description": "質問の説明（任意）",
  "category": "質問のカテゴリ（例: 記事タイプ、ターゲット、コンテンツ）"
}

JSONのみを出力してください。`

    const aiResponse = await geminiGenerateText({
      model: GEMINI_TEXT_MODEL_DEFAULT,
      parts: [{ text: prompt }],
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.7,
      },
    })

    // JSONをパース
    let questionData: any
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        questionData = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('JSON not found')
      }
    } catch (e) {
      // フォールバック: デフォルトの質問を生成
      questionData = {
        question: `「${keywords[0]}」について比較記事にしますか？`,
        description: '複数のサービスやツールを比較する形式の記事を作成する場合、右にスワイプしてください。',
        category: '記事タイプ',
      }
    }

    const question = {
      id: uuidv4(),
      question: questionData.question || `「${keywords[0]}」について比較記事にしますか？`,
      description: questionData.description,
      category: questionData.category || '記事タイプ',
    }

    return NextResponse.json({
      success: true,
      sessionId,
      question,
      guestId: session?.user?.id ? undefined : guestId,
    })
  } catch (error: any) {
    console.error('[swipe/test/start] error:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
