import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { geminiGenerateText, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { v4 as uuidv4 } from 'uuid'

// カード生成（質問生成）専用のモデル（gemini-2.0-flashを使用）
const CARD_GENERATION_MODEL = 'gemini-2.0-flash'

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

    // キーワードの関連キーワードを詳細に調査して質問を生成
    const keywordAnalysisPrompt = `あなたはSEOキーワード分析の専門家です。
以下のキーワードについて、関連キーワードや派生キーワードを詳細に分析してください。

主キーワード: ${keywords.join(', ')}

要件:
- 主キーワードに関連するキーワードを20-30個抽出してください
- 関連キーワードには以下を含めてください：
  * 類義語、上位概念、下位概念、関連語、派生語
  * 競合キーワード、代替キーワード
  * 長尾キーワード（「〜とは」「〜方法」「〜おすすめ」「〜比較」「〜違い」など）
  * 疑問形キーワード（「〜ですか」「〜できますか」など）
  * 時系列キーワード（「最新」「2024年」「2025年」など）
  * 具体的なサービス名、製品名、ブランド名など
  * ユーザーインテント別キーワード（情報収集、比較、購入検討など）
- 各関連キーワードについて、主キーワードとの関係性を簡潔に説明してください
- 特に「このキーワードは狙いますか？」という質問で使えるような具体的なキーワードを抽出してください
- 記事作成時に一緒に狙えるキーワード（狙い手キーワード）も含めてください
- キーワードの重要度や関連度も考慮してください

出力形式:
{
  "relatedKeywords": [
    {
      "keyword": "関連キーワード1",
      "relationship": "関係性の説明",
      "type": "類義語|長尾|疑問形|時系列|具体例など"
    }
  ],
  "targetKeywords": [
    {
      "keyword": "狙い手キーワード1",
      "relationship": "関係性の説明",
      "type": "類義語|長尾|疑問形|時系列|具体例など"
    }
  ],
  "longTailKeywords": [
    {
      "keyword": "長尾キーワード1",
      "relationship": "関係性の説明"
    }
  ],
  "competitorKeywords": [
    {
      "keyword": "競合キーワード1",
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
          maxOutputTokens: 2000, // 20-30個のキーワード抽出のため増やす
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
        // 長尾キーワードも追加
        if (Array.isArray(analysisData.longTailKeywords)) {
          relatedKeywords = [...relatedKeywords, ...analysisData.longTailKeywords]
        }
        // 競合キーワードも追加
        if (Array.isArray(analysisData.competitorKeywords)) {
          relatedKeywords = [...relatedKeywords, ...analysisData.competitorKeywords]
        }
      }
    } catch (e) {
      console.warn('[keyword analysis] error:', e)
      // エラー時は空配列のまま
    }

    // 初期質問を8問まとめてAIで生成（カード表示用）
    const relatedKeywordsText = relatedKeywords.length > 0
      ? `\n関連キーワード・狙い手キーワード:\n${relatedKeywords.map((k: any) => `- ${k.keyword} (${k.relationship || ''})`).join('\n')}`
      : ''
    
    const prompt = `あなたはSEO記事作成のための質問を生成するAIです。
入力されたキーワードを分析し、記事を作成するために必要な情報を収集するための最初の質問を必ず8問生成してください。

主キーワード: ${keywords.join(', ')}${relatedKeywordsText}

要件:
- 質問は必ず8問生成してください（必須）
- 質問はYes/Noで答えられる形式にしてください
- 具体的なキーワード名を含めた質問を作成してください：
  * 「「[具体的なキーワード名]」も狙いますか？」
  * 「「[長尾キーワード]」について説明しますか？」
  * 「「[競合キーワード]」と比較しますか？」
  * 「「[疑問形キーワード]」に対応しますか？」
- 関連キーワードリストから特に重要そうなキーワードを選んで具体的な質問にしてください
- 以下の観点から質問を生成してください：
  * メインキーワードの扱い方
  * 長尾キーワードの取り込み（「〜とは」「〜方法」「〜おすすめ」など）
  * 関連キーワード・競合キーワードの扱い
  * ターゲット読者層（初心者向け、上級者向けなど）
  * 記事の種類（比較記事、解説記事、レビュー記事など）
  * 具体的なサービス名・製品名・ブランド名の扱い
  * 時系列情報の扱い（最新情報、2024年版など）
- 極力短く、はっきり分かりやすい質問にしてください（30文字以内を推奨）
- 長文は禁止。1文で簡潔に表現してください
- 各質問は独立して答えられるようにしてください
- 日本語で質問してください
- 改行は禁止です（質問文に改行を含めないでください）
- 必ず8問すべてを生成してください

出力形式:
{
  "questions": [
    {
      "question": "短い質問文1",
      "category": "質問のカテゴリ"
    },
    {
      "question": "短い質問文2",
      "category": "質問のカテゴリ"
    },
    {
      "question": "短い質問文3",
      "category": "質問のカテゴリ"
    },
    {
      "question": "短い質問文4",
      "category": "質問のカテゴリ"
    },
    {
      "question": "短い質問文5",
      "category": "質問のカテゴリ"
    },
    {
      "question": "短い質問文6",
      "category": "質問のカテゴリ"
    },
    {
      "question": "短い質問文7",
      "category": "質問のカテゴリ"
    },
    {
      "question": "短い質問文8",
      "category": "質問のカテゴリ"
    }
  ]
}

JSONのみを出力してください。必ず8問すべてを生成してください。`

    // 質問生成（エラー時はエラーを返す）
    // カード生成専用のモデル（gemini-2.0-flash）を使用
    let questionData: any
    let aiGenerationError: string | null = null
    
    try {
    const aiResponse = await geminiGenerateText({
        model: CARD_GENERATION_MODEL, // カード生成はgemini-2.0-flashを使用
      parts: [{ text: prompt }],
      generationConfig: {
          maxOutputTokens: 1000, // 8問生成するため増やす
        temperature: 0.7,
      },
    })

      // AIレスポンスが空の場合はエラー
      if (!aiResponse || aiResponse.trim() === '') {
        throw new Error('AI質問生成が空のレスポンスを返しました')
      }

    // JSONをパース
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        questionData = JSON.parse(jsonMatch[0])
        // questionsが空配列または存在しない場合もエラー
        if (!questionData.questions || !Array.isArray(questionData.questions) || questionData.questions.length === 0) {
          throw new Error('AI質問生成が有効な質問を生成できませんでした')
        }
      } else {
        throw new Error('AI質問生成のレスポンスからJSONを抽出できませんでした')
      }
    } catch (e: any) {
      console.error('[swipe/test/start] AI question generation failed:', e?.message)
      aiGenerationError = e?.message || 'AI質問生成に失敗しました'
      
      // エラーをクライアントに返す
      return NextResponse.json(
        { 
          error: 'AI質問生成に失敗しました', 
          details: aiGenerationError,
          sessionId, // セッションIDは返す（リトライ用）
        }, 
        { status: 500 }
      )
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
