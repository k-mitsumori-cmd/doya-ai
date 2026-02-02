import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { geminiGenerateText, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { v4 as uuidv4 } from 'uuid'

/**
 * 次の質問をAIで生成するAPI
 * - これまでの回答を分析して次の質問を生成
 * - 必要な情報が揃ったら done: true を返す
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const body = await req.json().catch(() => ({}))
    const { sessionId, answers } = body

    if (!sessionId || !Array.isArray(answers)) {
      return NextResponse.json({ error: 'sessionId and answers are required' }, { status: 400 })
    }

    // セッションを取得
    const swipeSession = await prisma.swipeSession.findUnique({
      where: { sessionId },
    })

    if (!swipeSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const currentYear = new Date().getFullYear()
    const normalizeTitleYear = (title: string) => {
      const t = String(title || '').trim()
      if (!t) return t
      return t
        .replace(/【20\d{2}年(最新|最新版)】/g, `【${currentYear}年最新版】`)
        .replace(/20\d{2}年(最新|最新版)/g, `${currentYear}年最新版`)
        .replace(/20\d{2}年/g, `${currentYear}年`)
    }

    // これまでの回答を整理
    const answersText = answers.map((a: any) => `Q: ${a.question}\nA: ${a.answer === 'yes' ? 'はい' : 'いいえ'}`).join('\n\n')

    // 次の質問を3-4問まとめて生成するか、完了判定を行う
    const prompt = `あなたはSEO記事作成のための質問を生成するAIです。
これまでの回答を分析し、記事を作成するために必要な情報が揃っているか判断してください。

主キーワード: ${swipeSession.mainKeyword}

これまでの回答:
${answersText}

要件:
1. まだ必要な情報がある場合は、次の質問を3-4問まとめて生成してください
   - 質問はYes/Noで答えられる形式にしてください
   - 極力短く、はっきり分かりやすい質問にしてください（長文禁止）
   - 記事の種類、ターゲット読者、関連キーワード、記事の方向性などに関連する質問にしてください
   - 各質問は独立して答えられるようにしてください
   - 日本語で質問してください

2. 必要な情報が揃った場合は、記事のタイトルと目標文字数を提案してください
   - タイトルはSEOとCTRを意識した魅力的なタイトルにしてください
   - 目標文字数は2,000、4,000、6,000、8,000、10,000のいずれかにしてください

出力形式（質問を生成する場合）:
{
  "done": false,
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

出力形式（完了する場合）:
{
  "done": true,
  "finalData": {
    "title": "記事タイトル",
    "targetChars": 4000
  }
}

JSONのみを出力してください。`

    const aiResponse = await geminiGenerateText({
      model: GEMINI_TEXT_MODEL_DEFAULT,
      parts: [{ text: prompt }],
      generationConfig: {
        maxOutputTokens: 800,
        temperature: 0.7,
      },
    })

    // JSONをパース
    let result: any
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('JSON not found')
      }
    } catch (e) {
      // フォールバック: デフォルトで完了
      const keywordParts = swipeSession.mainKeyword.split(',').map((k: string) => k.trim())
      result = {
        done: true,
        finalData: {
          title: normalizeTitleYear(`「${keywordParts[0]}」完全ガイド【${currentYear}年最新版】`),
          targetChars: 4000,
        },
      }
    }

    if (result.done) {
      // 完了
      return NextResponse.json({
        success: true,
        done: true,
        finalData: {
          ...result.finalData,
          title: normalizeTitleYear(String(result?.finalData?.title || '')),
          targetChars: Number(result?.finalData?.targetChars || 4000),
        },
      })
    } else {
      // 次の質問を3-4問まとめて生成
      const questions = Array.isArray(result.questions) 
        ? result.questions.map((q: any) => ({
            id: uuidv4(),
            question: String(q.question || 'この内容で進めますか？').replace(/\s*\n+\s*/g, '').trim(),
            category: q.category || '確認',
          }))
        : [{
            id: uuidv4(),
            question: 'この内容で進めますか？',
            category: '確認',
          }]

      return NextResponse.json({
        success: true,
        done: false,
        questions,
      })
    }
  } catch (error: any) {
    console.error('[swipe/test/question] error:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
