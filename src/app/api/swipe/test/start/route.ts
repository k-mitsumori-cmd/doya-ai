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

    // 初期質問を3-4問まとめてAIで生成
    const prompt = `あなたはSEO記事作成のための質問を生成するAIです。
入力されたキーワードを分析し、記事を作成するために必要な情報を収集するための最初の質問を3-4問まとめて生成してください。

入力キーワード: ${keywords.join(', ')}

要件:
- 質問はYes/Noで答えられる形式にしてください
- 極力短く、はっきり分かりやすい質問にしてください（30文字以内を推奨）
- 長文は禁止。1文で簡潔に表現してください
- 記事の種類、ターゲット読者、記事の方向性などに関連する質問にしてください
- 各質問は独立して答えられるようにしてください
- 日本語で質問してください
- 適切な位置で改行ができるよう、自然な区切りを意識してください

出力形式:
{
  "questions": [
    {
      "question": "短い質問文",
      "category": "質問のカテゴリ"
    },
    {
      "question": "短い質問文",
      "category": "質問のカテゴリ"
    },
    {
      "question": "短い質問文",
      "category": "質問のカテゴリ"
    }
  ]
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
        questions: [
          { question: `「${keywords[0]}」について比較記事にしますか？`, category: '記事タイプ' },
          { question: `初心者向けに説明しますか？`, category: 'ターゲット' },
          { question: `導入事例を含めますか？`, category: 'コンテンツ' },
        ],
      }
    }

    const questions = Array.isArray(questionData.questions)
      ? questionData.questions.map((q: any) => ({
          id: uuidv4(),
          question: q.question || `「${keywords[0]}」について比較記事にしますか？`,
          category: q.category || '記事タイプ',
        }))
      : [
          {
            id: uuidv4(),
            question: `「${keywords[0]}」について比較記事にしますか？`,
            category: '記事タイプ',
          },
        ]

    return NextResponse.json({
      success: true,
      sessionId,
      questions,
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
