// ============================================
// POST /api/interview/articles/generate
// ============================================
// AI記事生成 — SSE (Server-Sent Events) ストリーミング
// Gemini API のストリーミング出力をリアルタイムでクライアントに配信
//
// リクエスト: { projectId, recipeId, customInstructions?, displayFormat? }
// レスポンス: SSE stream (data: JSON\n\n)
//   - { type: 'progress', step: string }
//   - { type: 'chunk', text: string }
//   - { type: 'done', draftId: string, wordCount: number }
//   - { type: 'error', message: string }

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewUser, getGuestIdFromRequest, checkOwnership, requireDatabase } from '@/lib/interview/access'
import { buildArticlePrompt } from '@/lib/interview/prompts'

function getGeminiApiKey(): string {
  const key =
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GEMINI_API_KEY
  if (!key) throw new Error('Gemini APIキーが設定されていません')
  return key.trim()
}

function getModel(): string {
  return (
    process.env.INTERVIEW_GEMINI_MODEL ||
    process.env.GEMINI_TEXT_MODEL ||
    'gemini-2.0-flash'
  )
}

export async function POST(req: NextRequest) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  const encoder = new TextEncoder()

  // SSE ヘルパー
  function sseEvent(data: Record<string, any>): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // ====== 認証 ======
        const { userId } = await getInterviewUser()
        const guestId = !userId ? getGuestIdFromRequest(req) : null

        const body = await req.json()
        const { projectId, recipeId, customInstructions, displayFormat } = body as {
          projectId: string
          recipeId: string
          customInstructions?: string
          displayFormat?: string
        }

        if (!projectId || !recipeId) {
          controller.enqueue(sseEvent({ type: 'error', message: 'projectId と recipeId は必須です' }))
          controller.close()
          return
        }

        controller.enqueue(sseEvent({ type: 'progress', step: 'プロジェクト情報を読み込み中...' }))

        // ====== プロジェクト取得 ======
        const project = await prisma.interviewProject.findUnique({
          where: { id: projectId },
          include: {
            transcriptions: {
              where: { status: 'COMPLETED' },
              select: { text: true, materialId: true },
            },
            materials: {
              where: { status: 'COMPLETED' },
              select: { id: true, type: true, extractedText: true },
            },
          },
        })

        if (!project) {
          controller.enqueue(sseEvent({ type: 'error', message: 'プロジェクトが見つかりません' }))
          controller.close()
          return
        }

        const ownerErr = checkOwnership(project, userId, guestId)
        if (ownerErr) {
          controller.enqueue(sseEvent({ type: 'error', message: '権限がありません' }))
          controller.close()
          return
        }

        // ====== レシピ取得 ======
        const recipe = await prisma.interviewRecipe.findUnique({ where: { id: recipeId } })
        if (!recipe) {
          controller.enqueue(sseEvent({ type: 'error', message: 'レシピが見つかりません' }))
          controller.close()
          return
        }

        controller.enqueue(sseEvent({ type: 'progress', step: '素材を分析中...' }))

        // ====== 素材テキスト収集 ======
        const transcriptionTexts = project.transcriptions.map((t) => t.text).filter(Boolean)
        const extractedTexts = project.materials
          .filter((m) => m.extractedText)
          .map((m) => m.extractedText!)

        if (transcriptionTexts.length === 0 && extractedTexts.length === 0) {
          controller.enqueue(sseEvent({
            type: 'error',
            message: '文字起こし済みの素材がありません。先に素材をアップロードして文字起こしを実行してください。',
          }))
          controller.close()
          return
        }

        controller.enqueue(sseEvent({ type: 'progress', step: 'AI記事を生成中...' }))

        // ====== プロンプト構築 ======
        const prompt = buildArticlePrompt({
          recipe: {
            name: recipe.name,
            editingGuidelines: recipe.editingGuidelines,
            category: recipe.category,
          },
          project: {
            title: project.title,
            intervieweeName: project.intervieweeName,
            intervieweeRole: project.intervieweeRole,
            intervieweeCompany: project.intervieweeCompany,
            intervieweeBio: project.intervieweeBio,
            genre: project.genre,
            theme: project.theme,
            purpose: project.purpose,
            targetAudience: project.targetAudience,
            tone: project.tone,
          },
          transcriptionTexts,
          extractedTexts,
          customInstructions: customInstructions || null,
          displayFormat: displayFormat || null,
        })

        // ====== Gemini ストリーミング API 呼び出し ======
        const apiKey = getGeminiApiKey()
        const model = getModel()
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`

        const geminiRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 65536,
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
          console.error('[interview] Gemini API error:', geminiRes.status, errText)
          controller.enqueue(sseEvent({
            type: 'error',
            message: `AI API エラー (${geminiRes.status})`,
          }))
          controller.close()
          return
        }

        // ====== SSE ストリームをパースしてクライアントに転送 ======
        let fullText = ''
        const reader = geminiRes.body?.getReader()
        if (!reader) {
          controller.enqueue(sseEvent({ type: 'error', message: 'ストリーム読み取り失敗' }))
          controller.close()
          return
        }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // SSE形式のレスポンスを行ごとにパース
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // 最後の不完全な行をバッファに戻す

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const jsonStr = line.slice(6).trim()
            if (!jsonStr || jsonStr === '[DONE]') continue

            try {
              const parsed = JSON.parse(jsonStr)
              const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text
              if (text) {
                fullText += text
                controller.enqueue(sseEvent({ type: 'chunk', text }))
              }
            } catch {
              // JSON パース失敗は無視 (不完全なチャンク)
            }
          }
        }

        // ====== 記事をDBに保存 ======
        controller.enqueue(sseEvent({ type: 'progress', step: '記事を保存中...' }))

        // 既存ドラフトの最大バージョンを取得
        const maxVersion = await prisma.interviewDraft.aggregate({
          where: { projectId },
          _max: { version: true },
        })
        const nextVersion = (maxVersion._max?.version || 0) + 1

        const draft = await prisma.interviewDraft.create({
          data: {
            projectId,
            version: nextVersion,
            title: project.title,
            content: fullText,
            displayFormat: displayFormat || 'MONOLOGUE',
            wordCount: fullText.length,
            readingTime: Math.ceil(fullText.length / 600),
            status: 'DRAFT',
          },
        })

        // プロジェクトにレシピを紐付け＋ステータス更新
        await prisma.interviewProject.update({
          where: { id: projectId },
          data: {
            recipeId: recipeId,
            status: 'EDITING',
          },
        })

        // レシピの使用回数をインクリメント
        await prisma.interviewRecipe.update({
          where: { id: recipeId },
          data: { usageCount: { increment: 1 } },
        })

        controller.enqueue(sseEvent({
          type: 'done',
          draftId: draft.id,
          wordCount: fullText.length,
          version: nextVersion,
        }))

        controller.close()
      } catch (e: any) {
        console.error('[interview] generate error:', e?.message)
        try {
          controller.enqueue(sseEvent({ type: 'error', message: e?.message || '記事生成に失敗しました' }))
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