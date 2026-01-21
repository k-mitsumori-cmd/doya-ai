import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { geminiGenerateText, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { v4 as uuidv4 } from 'uuid'

// カード生成（質問生成）専用のモデル（gemini-2.0-flashを使用）
const CARD_GENERATION_MODEL = 'gemini-2.0-flash'

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

    // 最大30問まで（30問に達したら完了）
    if (answers.length >= 30) {
      // 完了判定へ進む
      const keywordParts = swipeSession.mainKeyword.split(',').map((k: string) => k.trim())
      const result = {
        done: true,
        finalData: {
          title: normalizeTitleYear(`「${keywordParts[0]}」完全ガイド【${currentYear}年最新版】`),
          targetChars: 4000,
        },
      }
      return NextResponse.json({
        success: true,
        done: true,
        finalData: result.finalData,
      })
    }

    // これまでの回答を整理
    const answersText = answers.map((a: any) => `Q: ${a.question}\nA: ${a.answer === 'yes' ? 'はい' : 'いいえ'}`).join('\n\n')

    // キーワードの関連キーワードを調査（必要に応じて）
    const keywordParts = swipeSession.mainKeyword.split(',').map((k: string) => k.trim())
    let relatedKeywordsText = ''
    
    // 回答数が少ない場合（初期段階）は関連キーワードを調査
    if (answers.length < 15) {
      try {
        const keywordAnalysisPrompt = `あなたはSEOキーワード分析の専門家です。
以下のキーワードについて、関連キーワードや派生キーワードを詳細に分析してください。

主キーワード: ${keywordParts.join(', ')}

要件:
- 主キーワードに関連するキーワードを10-20個抽出してください
- 関連キーワードには、類義語、上位概念、下位概念、関連語、派生語、競合キーワードなどを含めてください
- 特に「このキーワードは狙いますか？」という質問で使えるような具体的なキーワードを抽出してください
- 記事作成時に一緒に狙えるキーワードも含めてください

出力形式:
{
  "relatedKeywords": ["関連キーワード1", "関連キーワード2", ...],
  "targetKeywords": ["狙い手キーワード1", "狙い手キーワード2", ...]
}

JSONのみを出力してください。`

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
          const relatedKeywords = Array.isArray(analysisData.relatedKeywords) ? analysisData.relatedKeywords : []
          const targetKeywords = Array.isArray(analysisData.targetKeywords) ? analysisData.targetKeywords : []
          const allKeywords = [...relatedKeywords, ...targetKeywords]
          if (allKeywords.length > 0) {
            relatedKeywordsText = `\n関連キーワード・狙い手キーワード: ${allKeywords.join(', ')}`
          }
        }
      } catch (e) {
        console.warn('[keyword analysis] error:', e)
        // エラー時は無視
      }
    }

    // 次の質問を8問まとめて生成するか、完了判定を行う
    const prompt = `あなたはSEO記事作成のための質問を生成するAIです。
これまでの回答を分析し、記事を作成するために必要な情報が揃っているか判断してください。

主キーワード: ${swipeSession.mainKeyword}${relatedKeywordsText}

これまでの回答:
${answersText}

要件:
1. まだ必要な情報がある場合は、次の質問を必ず8問生成してください
   - 質問はYes/Noで答えられる形式にしてください
   - 「このキーワードは狙いますか？」「この関連キーワードも含めますか？」のような形で、キーワードや関連キーワードを具体的に質問に含めてください
   - 極力短く、はっきり分かりやすい質問にしてください（30文字以内を推奨）
   - 長文は禁止。1文で簡潔に表現してください
   - 記事の種類、ターゲット読者、関連キーワード、記事の方向性などに関連する質問にしてください
   - 各質問は独立して答えられるようにしてください
   - 日本語で質問してください
   - 改行は禁止です（質問文に改行を含めないでください）

2. 必要な情報が揃った場合は、記事のタイトルと目標文字数を提案してください
   - タイトルはSEOとCTRを意識した魅力的なタイトルにしてください
   - タイトルの年号は必ず${currentYear}年にしてください（例: 【${currentYear}年最新版】）
   - 目標文字数は2,000、4,000、6,000、8,000、10,000のいずれかにしてください

出力形式（質問を生成する場合）:
{
  "done": false,
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

出力形式（完了する場合）:
{
  "done": true,
  "finalData": {
    "title": "記事タイトル",
    "targetChars": 4000
  }
}

JSONのみを出力してください。`

    // カード生成（質問生成）はgemini-2.0-flashを使用
    const aiResponse = await geminiGenerateText({
      model: CARD_GENERATION_MODEL, // カード生成はgemini-2.0-flashを使用
      parts: [{ text: prompt }],
      generationConfig: {
        maxOutputTokens: 1200, // 8問生成するため増やす
        temperature: 0.7,
      },
    })

    // JSONをパース（リトライ機能付き）
    let result: any
    let parseAttempts = 0
    const maxParseAttempts = 3
    
    while (parseAttempts < maxParseAttempts) {
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0])
          // バリデーション: questionsが配列で、少なくとも1つはあること
          if (!result.done && (!Array.isArray(result.questions) || result.questions.length === 0)) {
            throw new Error('Invalid questions array')
          }
          break // 成功したらループを抜ける
        } else {
          throw new Error('JSON not found')
        }
      } catch (e) {
        parseAttempts++
        if (parseAttempts >= maxParseAttempts) {
          // 最終的にパースに失敗した場合は、質問を再生成するか、デフォルトの質問を返す
          console.warn('[JSON parse failed] Attempting to generate fallback questions')
          
          // フォールバック: デフォルトの質問を生成
          const keywordParts = swipeSession.mainKeyword.split(',').map((k: string) => k.trim())
          if (answers.length < 30) {
            // まだ質問が続く場合はデフォルトの質問を返す
            result = {
              done: false,
              questions: [
                { question: `「${keywordParts[0]}」について詳しく説明しますか？`, category: '記事の方向性' },
                { question: `初心者向けの内容にしますか？`, category: 'ターゲット読者' },
                { question: `比較記事の形式にしますか？`, category: '記事タイプ' },
              ],
            }
          } else {
            // 30問に達した場合は完了
            result = {
              done: true,
              finalData: {
                title: normalizeTitleYear(`「${keywordParts[0]}」完全ガイド【${currentYear}年最新版】`),
                targetChars: 4000,
              },
            }
          }
          break
        }
        // リトライ前に少し待つ
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    if (result.done || answers.length >= 30) {
      // 完了（30問に達した場合も完了）
      // 質問回答から要約を生成
      const summaryPrompt = `あなたはSEO記事作成のための質問回答を分析するAIです。
以下の質問と回答から、記事の方向性・内容・ターゲットなどを要約してください。

主キーワード: ${swipeSession.mainKeyword}

質問と回答:
${answersText}

要件:
- 質問回答から得た情報を元に、記事の方向性・内容・ターゲットなどを長文で要約してください
- 「この質問から、この情報を得たので、こういう風にしました」という形式で説明してください
- 具体的で分かりやすい文章にしてください
- 日本語で記述してください

要約文のみを出力してください（JSON形式は不要）。`

      let summary = ''
      try {
        summary = await geminiGenerateText({
          model: GEMINI_TEXT_MODEL_DEFAULT,
          parts: [{ text: summaryPrompt }],
          generationConfig: {
            maxOutputTokens: 2000,
            temperature: 0.7,
          },
        })
      } catch (e) {
        summary = '質問回答を分析した結果、記事の方向性を決定しました。'
      }

      return NextResponse.json({
        success: true,
        done: true,
        finalData: {
          ...result.finalData,
          title: normalizeTitleYear(String(result?.finalData?.title || '')),
          targetChars: Number(result?.finalData?.targetChars || 4000),
          summary,
        },
      })
    } else {
      // 次の質問を3-4問まとめて生成
      const questions = Array.isArray(result.questions) && result.questions.length > 0
        ? result.questions.map((q: any) => ({
            id: uuidv4(),
            question: String(q.question || 'この内容で進めますか？').replace(/\s*\n+\s*/g, '').trim(),
            category: String(q.category || '確認').trim(),
          })).filter((q: any) => q.question.length > 0) // 空の質問を除外
        : [
            {
              id: uuidv4(),
              question: 'この内容で進めますか？',
              category: '確認',
            },
          ]

      // 質問が空の場合はエラー
      if (questions.length === 0) {
        throw new Error('質問が生成されませんでした')
      }

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
