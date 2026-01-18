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

    // キーワードの関連キーワードを調査して質問を生成
    const keywordAnalysisPrompt = `あなたはSEOキーワード分析の専門家です。
以下のキーワードについて、関連キーワードや派生キーワードを詳細に分析してください。

主キーワード: ${keywords.join(', ')}

要件:
- 主キーワードに関連するキーワードを10-20個抽出してください
- 関連キーワードには、類義語、上位概念、下位概念、関連語、派生語、競合キーワードなどを含めてください
- 各関連キーワードについて、主キーワードとの関係性を簡潔に説明してください
- 特に「このキーワードは狙いますか？」という質問で使えるような具体的なキーワードを抽出してください
- 記事作成時に一緒に狙えるキーワード（狙い手キーワード）も含めてください

出力形式:
{
  "relatedKeywords": [
    {
      "keyword": "関連キーワード1",
      "relationship": "関係性の説明"
    },
    {
      "keyword": "関連キーワード2",
      "relationship": "関係性の説明"
    }
  ],
  "targetKeywords": [
    {
      "keyword": "狙い手キーワード1",
      "relationship": "関係性の説明"
    }
  ]
}

JSONのみを出力してください。`

    let relatedKeywords: any[] = []
    try {
      const analysisResponse = await geminiGenerateText({
        model: GEMINI_TEXT_MODEL_DEFAULT,
        parts: [{ text: keywordAnalysisPrompt }],
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.7,
        },
      })
      
      const analysisMatch = analysisResponse.match(/\{[\s\S]*\}/)
      if (analysisMatch) {
        const analysisData = JSON.parse(analysisMatch[0])
        relatedKeywords = Array.isArray(analysisData.relatedKeywords) ? analysisData.relatedKeywords : []
        // 狙い手キーワードも追加
        if (Array.isArray(analysisData.targetKeywords)) {
          relatedKeywords = [...relatedKeywords, ...analysisData.targetKeywords]
        }
      }
    } catch (e) {
      console.warn('[keyword analysis] error:', e)
      // エラー時は空配列のまま
    }

    // 初期質問を3-4問まとめてAIで生成
    const relatedKeywordsText = relatedKeywords.length > 0
      ? `\n関連キーワード・狙い手キーワード:\n${relatedKeywords.map((k: any) => `- ${k.keyword} (${k.relationship || ''})`).join('\n')}`
      : ''
    
    const prompt = `あなたはSEO記事作成のための質問を生成するAIです。
入力されたキーワードを分析し、記事を作成するために必要な情報を収集するための最初の質問を3-4問まとめて生成してください。

主キーワード: ${keywords.join(', ')}${relatedKeywordsText}

要件:
- 質問はYes/Noで答えられる形式にしてください
- 「このキーワードは狙いますか？」「この関連キーワードも含めますか？」のような形で、キーワードや関連キーワードを具体的に質問に含めてください
- 極力短く、はっきり分かりやすい質問にしてください（30文字以内を推奨）
- 長文は禁止。1文で簡潔に表現してください
- 記事の種類、ターゲット読者、記事の方向性、関連キーワードの扱いなどに関連する質問にしてください
- 各質問は独立して答えられるようにしてください
- 日本語で質問してください
- 改行は禁止です（質問文に改行を含めないでください）

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
          question: String(q.question || `「${keywords[0]}」について比較記事にしますか？`).replace(/\s*\n+\s*/g, ''),
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
