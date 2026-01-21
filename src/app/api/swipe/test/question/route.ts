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
- 主キーワードに関連するキーワードを20-30個抽出してください
- 関連キーワードには以下を含めてください：
  * 類義語、上位概念、下位概念、関連語、派生語
  * 競合キーワード、代替キーワード
  * 長尾キーワード（「〜とは」「〜方法」「〜おすすめ」「〜比較」「〜違い」など）
  * 疑問形キーワード（「〜ですか」「〜できますか」など）
  * 時系列キーワード（「最新」「2024年」「2025年」など）
  * 具体的なサービス名、製品名、ブランド名など
  * ユーザーインテント別キーワード（情報収集、比較、購入検討など）
- 特に「このキーワードは狙いますか？」という質問で使えるような具体的なキーワードを抽出してください
- 記事作成時に一緒に狙えるキーワードも含めてください

出力形式:
{
  "relatedKeywords": ["関連キーワード1", "関連キーワード2", ...],
  "targetKeywords": ["狙い手キーワード1", "狙い手キーワード2", ...],
  "longTailKeywords": ["長尾キーワード1", "長尾キーワード2", ...],
  "competitorKeywords": ["競合キーワード1", "競合キーワード2", ...]
}

JSONのみを出力してください。`

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
          const relatedKeywords = Array.isArray(analysisData.relatedKeywords) ? analysisData.relatedKeywords : []
          const targetKeywords = Array.isArray(analysisData.targetKeywords) ? analysisData.targetKeywords : []
          const longTailKeywords = Array.isArray(analysisData.longTailKeywords) ? analysisData.longTailKeywords : []
          const competitorKeywords = Array.isArray(analysisData.competitorKeywords) ? analysisData.competitorKeywords : []
          const allKeywords = [...relatedKeywords, ...targetKeywords, ...longTailKeywords, ...competitorKeywords]
          if (allKeywords.length > 0) {
            relatedKeywordsText = `\n関連キーワード・狙い手キーワード・長尾キーワード・競合キーワード: ${allKeywords.join(', ')}`
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
   - 具体的なキーワード名を含めた質問を作成してください：
     * 「「[具体的なキーワード名]」も狙いますか？」
     * 「「[長尾キーワード]」について説明しますか？」
     * 「「[競合キーワード]」と比較しますか？」
     * 「「[疑問形キーワード]」に対応しますか？」
   - 関連キーワードリストから特に重要そうなキーワードを選んで具体的な質問にしてください
   - これまでの回答を考慮して、まだ聞いていない重要なキーワードに関する質問を生成してください
   - 以下の観点から質問を生成してください：
     * まだ扱っていない関連キーワード・長尾キーワード
     * 具体的なサービス名・製品名・ブランド名の扱い
     * 時系列情報の扱い（最新情報、2024年版など）
     * ターゲット読者層（初心者向け、上級者向けなど）
     * 記事の種類（比較記事、解説記事、レビュー記事など）
     * ユーザーインテント（情報収集、比較、購入検討など）
   - 極力短く、はっきり分かりやすい質問にしてください（30文字以内を推奨）
   - 長文は禁止。1文で簡潔に表現してください
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
      
      // 1. 質問回答から要約を生成
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

      // 2. タイトル候補6種類を生成
      const titlePrompt = `あなたはSEO記事のタイトル作成の専門家です。
以下の情報を元に、魅力的な記事タイトルを6種類提案してください。

主キーワード: ${swipeSession.mainKeyword}

質問と回答の要約:
${summary}

要件:
- SEOに最適化されたタイトルを6種類生成してください
- 各タイトルは異なるアプローチで作成してください：
  1. キーワード＋目的別おすすめ系（例：「〇〇比較｜目的別おすすめ＆導入前の注意点」）
  2. 年度＋選び方ガイド系（例：「失敗しない！〇〇【${currentYear}年版】選び方ガイド」）
  3. プロ解説系（例：「プロが解説｜〇〇で見るべきポイント」）
  4. 初心者向け系（例：「〇〇：初心者向け｜無料から始める活用術」）
  5. 落とし穴・注意点系（例：「〇〇｜導入前に知っておくべき落とし穴」）
  6. 事例集・活用系（例：「目的別で選ぶ！〇〇＆活用事例集」）
- タイトルは30〜60文字程度にしてください
- 主キーワードを必ず含めてください
- 日本語で記述してください

出力形式:
{
  "titles": [
    "タイトル1",
    "タイトル2",
    "タイトル3",
    "タイトル4",
    "タイトル5",
    "タイトル6"
  ]
}

JSONのみを出力してください。`

      let titleCandidates: string[] = []
      try {
        const titleResponse = await geminiGenerateText({
          model: CARD_GENERATION_MODEL,
          parts: [{ text: titlePrompt }],
          generationConfig: {
            maxOutputTokens: 1000,
            temperature: 0.8,
          },
        })
        
        const titleJsonMatch = titleResponse.match(/\{[\s\S]*\}/)
        if (titleJsonMatch) {
          const titleResult = JSON.parse(titleJsonMatch[0])
          if (Array.isArray(titleResult.titles)) {
            titleCandidates = titleResult.titles.map((t: string) => normalizeTitleYear(String(t).trim())).filter((t: string) => t.length > 0)
          }
        }
      } catch (e) {
        console.warn('[タイトル候補生成失敗]', e)
      }
      
      // タイトル候補が6個未満の場合はデフォルトを追加
      const defaultTitle = normalizeTitleYear(String(result?.finalData?.title || `「${keywordParts[0]}」完全ガイド【${currentYear}年最新版】`))
      if (titleCandidates.length === 0) {
        titleCandidates = [
          defaultTitle,
          normalizeTitleYear(`${keywordParts[0]}比較｜目的別おすすめ＆導入前の注意点`),
          normalizeTitleYear(`失敗しない！${keywordParts[0]}【${currentYear}年版】選び方ガイド`),
          normalizeTitleYear(`プロが解説｜${keywordParts[0]}で見るべきポイント`),
          normalizeTitleYear(`${keywordParts[0]}：初心者向け｜無料から始める活用術`),
          normalizeTitleYear(`${keywordParts[0]}｜導入前に知っておくべき落とし穴`),
        ]
      }
      while (titleCandidates.length < 6) {
        titleCandidates.push(defaultTitle)
      }

      // 3. 回答の要約（カテゴリ別）を生成
      const answersByCategory: Record<string, { question: string; answer: string }[]> = {}
      answers.forEach((a: any) => {
        const category = a.category || '一般'
        if (!answersByCategory[category]) {
          answersByCategory[category] = []
        }
        answersByCategory[category].push({
          question: a.question,
          answer: a.answer === 'yes' ? 'はい' : 'いいえ',
        })
      })

      return NextResponse.json({
        success: true,
        done: true,
        finalData: {
          ...result.finalData,
          title: titleCandidates[0], // デフォルトは最初のタイトル
          titleCandidates, // 6種類のタイトル候補
          targetChars: Number(result?.finalData?.targetChars || 4000),
          summary,
          answersByCategory, // カテゴリ別の回答要約
          totalAnswers: answers.length,
          yesCount: answers.filter((a: any) => a.answer === 'yes').length,
          noCount: answers.filter((a: any) => a.answer === 'no').length,
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
