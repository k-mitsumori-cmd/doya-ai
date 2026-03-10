// ============================================
// POST /api/interviewx/projects/[id]/generate-questions
// ============================================
// AI質問生成 — SSE (Server-Sent Events) ストリーミング
// Gemini API でプロジェクト設定に基づいた質問を自動生成
//
// レスポンス: SSE stream (data: JSON\n\n)
//   - { type: 'progress', message: string }
//   - { type: 'done', data: { questions: Question[] } }
//   - { type: 'error', message: string }

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewXUser, requireAuth, checkOwnership, requireDatabase } from '@/lib/interviewx/access'

function getGeminiApiKey(): string {
  const key =
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GEMINI_API_KEY
  if (!key) throw new Error('Gemini APIキーが設定されていません')
  return key.trim()
}

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  const encoder = new TextEncoder()

  function sseEvent(data: Record<string, any>): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // ====== 認証 ======
        const { userId } = await getInterviewXUser()
        const authErrRes = requireAuth(userId)
        if (authErrRes) {
          controller.enqueue(sseEvent({ type: 'error', message: 'ログインが必要です' }))
          controller.close()
          return
        }

        const { id } = await params

        controller.enqueue(sseEvent({ type: 'progress', message: 'プロジェクト情報を読み込み中...' }))

        // ====== プロジェクト取得 ======
        const project = await prisma.interviewXProject.findUnique({
          where: { id },
          include: {
            template: true,
          },
        })

        if (!project) {
          controller.enqueue(sseEvent({ type: 'error', message: 'プロジェクトが見つかりません' }))
          controller.close()
          return
        }

        const ownerErr = checkOwnership(project, userId)
        if (ownerErr) {
          controller.enqueue(sseEvent({ type: 'error', message: '権限がありません' }))
          controller.close()
          return
        }

        controller.enqueue(sseEvent({ type: 'progress', message: 'AIで質問を生成中...' }))

        // ====== プロンプト構築 ======
        const templateQuestions = project.template?.defaultQuestions
          ? JSON.stringify(project.template.defaultQuestions, null, 2)
          : '（テンプレート質問なし）'

        const prompt = `あなたはプロのインタビューディレクターです。以下の設定に基づいて、インタビュー記事を作成するためのアンケート質問を8〜12個生成してください。

## プロジェクト設定
- タイトル: ${project.title}
- 記事タイプ: ${project.articleType || 'CASE_STUDY'}
- 目的: ${project.purpose || '未設定'}
- ターゲット読者: ${project.targetAudience || '未設定'}
- トーン: ${project.tone || 'professional'}
- 希望文字数: ${project.wordCountTarget || 3000}文字
${project.companyName ? `- 企業名: ${project.companyName}` : ''}
${project.customInstructions ? `- 追加指示: ${project.customInstructions}` : ''}

## テンプレートのデフォルト質問（参考）
${templateQuestions}

## 生成ルール
1. テンプレートの質問を参考にしつつ、プロジェクト設定に合わせた新しい質問を生成
2. 質問は回答者が答えやすいよう具体的に
3. 記事の流れを意識した順序で（導入→本題→まとめ）
4. 各質問にはdescriptionとして回答のヒントを追加
5. 質問タイプは TEXT, TEXTAREA, SELECT, RATING, YES_NO から選択
6. 基本的にはTEXTAREAを多用し、一部で他のタイプを使い分ける

## 出力形式（JSON配列のみ、他のテキストは含めない）
[
  {
    "text": "質問文",
    "type": "TEXTAREA",
    "required": true,
    "order": 1,
    "description": "回答のヒント・補足説明"
  }
]`

        // ====== Gemini API 呼び出し ======
        const apiKey = getGeminiApiKey()
        const model = 'gemini-2.0-flash'
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

        const geminiRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 8192,
              responseMimeType: 'application/json',
            },
            safetySettings: [
              { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
              { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
              { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
              { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
            ],
          }),
        })

        if (!geminiRes.ok) {
          const errText = await geminiRes.text()
          console.error('[interviewx] Gemini API error:', geminiRes.status, errText)
          controller.enqueue(sseEvent({
            type: 'error',
            message: `AI API エラー (${geminiRes.status})`,
          }))
          controller.close()
          return
        }

        const geminiData = await geminiRes.json()
        const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text
        if (!rawText) {
          controller.enqueue(sseEvent({ type: 'error', message: 'AI応答が空です' }))
          controller.close()
          return
        }

        // ====== JSONパース ======
        controller.enqueue(sseEvent({ type: 'progress', message: '質問を解析中...' }))

        let generatedQuestions: any[]
        try {
          // JSONブロックの抽出（```json ... ``` でラップされている場合を考慮）
          let jsonStr = rawText.trim()
          const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
          if (jsonMatch) {
            jsonStr = jsonMatch[1].trim()
          }
          generatedQuestions = JSON.parse(jsonStr)
        } catch {
          console.error('[interviewx] JSON parse error:', rawText.slice(0, 500))
          controller.enqueue(sseEvent({ type: 'error', message: 'AI応答のパースに失敗しました' }))
          controller.close()
          return
        }

        if (!Array.isArray(generatedQuestions) || generatedQuestions.length === 0) {
          controller.enqueue(sseEvent({ type: 'error', message: '質問が生成されませんでした' }))
          controller.close()
          return
        }

        // ====== DB保存 ======
        controller.enqueue(sseEvent({ type: 'progress', message: '質問を保存中...' }))

        // 既存の質問を削除
        await prisma.interviewXQuestion.deleteMany({
          where: { projectId: id },
        })

        // 新しい質問を作成
        const questions = await Promise.all(
          generatedQuestions.map((q: any, idx: number) =>
            prisma.interviewXQuestion.create({
              data: {
                projectId: id,
                text: String(q.text || ''),
                type: String(q.type || 'TEXTAREA'),
                required: q.required !== false,
                order: q.order || idx + 1,
                description: q.description || null,
                options: q.options || null,
                aiGenerated: true,
              },
            })
          )
        )

        // プロジェクトステータスを更新
        await prisma.interviewXProject.update({
          where: { id },
          data: { status: 'QUESTIONS_READY' },
        })

        controller.enqueue(sseEvent({
          type: 'done',
          message: `${questions.length}個の質問を生成しました`,
          data: { questions },
        }))

        controller.close()
      } catch (e: any) {
        console.error('[interviewx] generate-questions error:', e?.message)
        try {
          controller.enqueue(sseEvent({ type: 'error', message: e?.message || '質問生成に失敗しました' }))
        } catch {
          // controller already closed
        }
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
