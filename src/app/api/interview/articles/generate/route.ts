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
import { recordServiceUsage } from '@/lib/service-usage'
import { claimArticleBudget, refundArticleBudget, type ArticleClaim } from '@/lib/interview/article-budget'

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
    'gemini-2.5-flash'
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

  let cancelled = false
  const providerAbort = new AbortController()
  const stream = new ReadableStream({
    async start(controller) {
      let claim: ArticleClaim | null = null
      let draftSaved = false
      try {
        // ====== 認証 ======
        const { userId, plan } = await getInterviewUser()
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

        const admission = await claimArticleBudget({ userId, guestId, plan })
        if (admission.state !== 'allowed') {
          controller.enqueue(sseEvent(admission.state === 'limit'
            ? { type: 'error', code: 'ARTICLE_LIMIT', message: `本日の記事生成上限（${admission.limit}回）に達しました。`, upgradePath: '/interview/pricing' }
            : { type: 'error', message: '利用状況を確認できません。しばらくしてから再試行してください。' }))
          controller.close()
          return
        }
        claim = admission.claim

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
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`

        const geminiRes = await fetch(endpoint, {
          method: 'POST',
          signal: providerAbort.signal,
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
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
          let invalidKey = false
          try {
            const providerError = await geminiRes.json()
            invalidKey = geminiRes.status === 400 &&
              typeof providerError?.error?.message === 'string' &&
              /API key not valid/i.test(providerError.error.message)
          } catch { /* Provider error format is not guaranteed. */ }
          console.error(invalidKey ? '[interview] Gemini API key invalid' : `[interview] Gemini API error status: ${geminiRes.status}`)
          controller.enqueue(sseEvent({
            type: 'error',
            ...(invalidKey ? {
              code: 'ARTICLE_PROVIDER_CONFIGURATION',
              message: '記事生成の接続設定に問題があります。サポートにお問い合わせください。',
            } : { message: `AI API エラー (${geminiRes.status})` }),
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
        const consumeLine = (line: string) => {
          if (!line.startsWith('data: ')) return
          const jsonStr = line.slice(6).trim()
          if (!jsonStr || jsonStr === '[DONE]') return
          try {
            const parsed = JSON.parse(jsonStr)
            const parts = parsed?.candidates?.[0]?.content?.parts
            const text = Array.isArray(parts)
              ? parts.map((part) => typeof part?.text === 'string' ? part.text : '').join('')
              : ''
            if (text) {
              fullText += text
              controller.enqueue(sseEvent({ type: 'chunk', text }))
            }
          } catch {
            // Ignore malformed provider events without exposing their content.
          }
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // SSE形式のレスポンスを行ごとにパース
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // 最後の不完全な行をバッファに戻す

          for (const line of lines) consumeLine(line)
        }
        buffer += decoder.decode()
        for (const line of buffer.split('\n')) consumeLine(line)

        // ====== 記事をDBに保存 ======
        if (cancelled) return
        if (!fullText.trim()) {
          controller.enqueue(sseEvent({ type: 'error', message: '記事本文を生成できませんでした。再試行してください。' }))
          controller.close()
          return
        }
        controller.enqueue(sseEvent({ type: 'progress', step: '記事を保存中...' }))

        // 同じプロジェクトの版番号採番と関連更新を一緒に確定する。
        const { draft, nextVersion } = await prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${projectId}))`
          const maxVersion = await tx.interviewDraft.aggregate({
            where: { projectId },
            _max: { version: true },
          })
          if (cancelled) throw new Error('Generation cancelled')
          const nextVersion = (maxVersion._max?.version || 0) + 1
          const draft = await tx.interviewDraft.create({
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
          await tx.interviewProject.update({
            where: { id: projectId },
            data: { recipeId, status: 'EDITING' },
          })
          await tx.interviewRecipe.update({
            where: { id: recipeId },
            data: { usageCount: { increment: 1 } },
          })
          return { draft, nextVersion }
        })
        draftSaved = true

        await recordServiceUsage({
          userId,
          serviceId: 'interview',
          action: 'インタビュー記事生成',
          summary: project.title || '',
          input: { projectId, recipeId, displayFormat },
          metadata: { wordCount: fullText.length, version: nextVersion },
        }).catch(() => {
          // Article is already committed; a metrics/notification outage cannot turn it into a failed generation.
          console.warn('[interview] usage tracking unavailable')
        })

        controller.enqueue(sseEvent({
          type: 'done',
          draftId: draft.id,
          wordCount: fullText.length,
          version: nextVersion,
        }))

        controller.close()
      } catch {
        if (!cancelled) {
          console.error('[interview] article generation failed')
          try {
            controller.enqueue(sseEvent({ type: 'error', message: '記事生成に失敗しました。時間をおいて再試行してください。' }))
          } catch {
            // controller already closed
          }
          controller.close()
        }
      } finally {
        if (claim && !draftSaved) await refundArticleBudget(claim)
      }
    },
    cancel() {
      cancelled = true
      providerAbort.abort()
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
