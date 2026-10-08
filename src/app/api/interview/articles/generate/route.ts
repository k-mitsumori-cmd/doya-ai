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
import { SUPPORT_CONTACT_URL } from '@/lib/pricing'
import { beginArticleOperation, recoverArticleOperation, completeArticleOperation, failArticleOperation, ArticleOperationError, type ArticleOperation } from '@/lib/interview/article-operation'
import { createHash } from 'node:crypto'
import { readOperationalJson, OperationalBodyError } from '@/lib/operational-json'
import { readInterviewGeminiResponse } from '@/lib/interview/gemini-request'

const ARTICLE_PROVIDER_TIMEOUT_MS = 240_000
const ARTICLE_PROVIDER_STREAM_MAX_BYTES = 8 * 1024 * 1024
const ARTICLE_PROVIDER_EVENT_MAX_CHARS = 512 * 1024
const ARTICLE_TEXT_MAX_CHARS = 512 * 1024

class ProjectOwnerChangedError extends Error {}

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

const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: privateHeaders })
const actorScope = (userId: string | null, guestId: string | null) => createHash('sha256').update('interview-article:v1:' + (userId ? 'user:' + userId : 'guest:' + guestId)).digest('hex')
function failure(error: unknown) {
  if (error instanceof OperationalBodyError) return json({ code: 'INVALID_INPUT', error: '入力内容を確認してください。' }, error.status)
  if (error instanceof ArticleOperationError) return json({ code: error.code, error: error.message }, error.status)
  console.error('[interview] article operation unavailable')
  return json({ code: 'RESULT_UNCONFIRMED', error: '処理状況を確認できません。再生成せず、保存済みの記事を確認してください。' }, 503)
}
function saved(operation: ArticleOperation, scope: string, plan: string) {
  const status = operation.state === 'pending' || operation.state === 'cancelling' ? 202 : operation.state === 'busy' ? 409
    : operation.state === 'failed' ? operation.code === 'ARTICLE_LIMIT' ? 429 : 400 : 200
  return json({ ...operation, actorScope: scope, ...(operation.code === 'ARTICLE_LIMIT' ? { message: `本日の記事生成上限（${operation.limit}回）に達しました。`, ...(plan === 'PRO' || plan === 'ENTERPRISE' ? { contactUrl: SUPPORT_CONTACT_URL } : { upgradePath: '/interview/pricing' }) } : {}) }, status)
}
async function ownedResult(operation: ArticleOperation, userId: string | null, guestId: string | null, projectId: string) {
  if (operation.state !== 'completed' || !operation.result) return
  const draft = await prisma.interviewDraft.findFirst({ where: {
    id: operation.result.draftId, projectId,
    project: userId ? { userId } : { userId: null, guestId },
  }, select: { id: true, wordCount: true, version: true } })
  if (!draft || draft.wordCount !== operation.result.wordCount || draft.version !== operation.result.version) throw new ArticleOperationError('RESULT_UNAVAILABLE', 410)
}
async function readOperation(req: NextRequest, cancel: boolean) {
  try {
    const origin = req.headers.get('origin')
    if (cancel && ((origin && origin !== new URL(req.url).origin) || req.headers.get('sec-fetch-site') === 'cross-site')) return json({ error: '操作元を確認できません。' }, 403)
    const { userId, plan } = await getInterviewUser(), guestId = userId ? null : getGuestIdFromRequest(req)
    if (!userId && !guestId) return json({ error: 'ログイン状態を確認してください。' }, 401)
    if (requireDatabase()) return json({ error: '処理状況を確認できません。' }, 503)
    const query = new URL(req.url).searchParams, projectId = query.get('projectId') || '', operationId = query.get('operationId') || ''
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(projectId) || query.getAll('projectId').length !== 1 || query.getAll('operationId').length > 1) throw new ArticleOperationError('INVALID_OPERATION', 400)
    const scope = actorScope(userId, guestId)
    if (!operationId && !cancel) {
      const project = await prisma.interviewProject.findUnique({ where: { id: projectId }, select: { userId: true, guestId: true } })
      if (!project || checkOwnership(project, userId, guestId)) throw new ArticleOperationError('OWNER_CHANGED', 404)
      return json({ actorScope: scope, projectId })
    }
    const operation = await recoverArticleOperation({ userId, guestId, projectId, operationId }, cancel)
    await ownedResult(operation, userId, guestId, projectId)
    return saved(operation, scope, plan)
  } catch (error) { return failure(error) }
}
export async function GET(req: NextRequest) { return readOperation(req, false) }
export async function DELETE(req: NextRequest) { return readOperation(req, true) }

export async function POST(req: NextRequest) {
  let admitted: { userId: string | null; guestId: string | null; projectId: string; operationId: string; recipeId: string; displayFormat: string; customInstructions?: string }
  let scope: string
  try {
    const origin = req.headers.get('origin')
    if ((origin && origin !== new URL(req.url).origin) || req.headers.get('sec-fetch-site') === 'cross-site') return json({ error: '操作元を確認できません。' }, 403)
    const { userId, plan } = await getInterviewUser(), guestId = userId ? null : getGuestIdFromRequest(req)
    if (!userId && !guestId) return json({ error: 'ログイン状態を確認してください。' }, 401)
    if (requireDatabase()) return json({ error: '処理状況を確認できません。' }, 503)
    const body = await readOperationalJson(req, 128 * 1024)
    if (typeof body.operationId !== 'string' || !body.operationId) return json({ code: 'CLIENT_UPDATE_REQUIRED', error: '画面を再読み込みして、保存状況を確認してください。' }, 409)
    if (typeof body.projectId !== 'string' || typeof body.recipeId !== 'string'
      || (body.displayFormat !== undefined && typeof body.displayFormat !== 'string')
      || (body.customInstructions !== undefined && typeof body.customInstructions !== 'string')) throw new ArticleOperationError('INVALID_OPERATION', 400)
    admitted = { userId, guestId, projectId: body.projectId, operationId: body.operationId.toLowerCase(), recipeId: body.recipeId,
      displayFormat: body.displayFormat as string || 'MONOLOGUE', ...(body.customInstructions === undefined ? {} : { customInstructions: body.customInstructions as string }) }
    scope = actorScope(userId, guestId)
    const previous = await recoverArticleOperation(admitted)
    if (previous.state === 'missing') {
      const recipe = await prisma.interviewRecipe.findUnique({ where: { id: admitted.recipeId } })
      if (!recipe || (!recipe.isTemplate && !recipe.isPublic && !(userId && recipe.userId === userId))) return json({ error: 'レシピが見つかりません' }, 404)
    }
    const admission = await beginArticleOperation({ ...admitted, plan })
    if (admission.state !== 'started') {
      await ownedResult(admission, userId, guestId, admitted.projectId)
      return saved(admission, scope, plan)
    }
  } catch (error) { return failure(error) }

  const encoder = new TextEncoder()

  // SSE ヘルパー
  function sseEvent(data: Record<string, any>): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
  }

  let cancelled = false
  const providerAbort = new AbortController()
  const stream = new ReadableStream({
    async start(controller) {
      let draftSaved = false
      let providerReader: ReadableStreamDefaultReader<Uint8Array> | undefined
      let polling = false
      const close = () => { try { controller.close() } catch {} }
      // Cancellation from another tab must also stop the admitted worker.
      const cancellationPoll = setInterval(() => {
        if (polling || providerAbort.signal.aborted) return
        polling = true
        void recoverArticleOperation(admitted).then(operation => {
          if (operation.state !== 'pending') providerAbort.abort()
        }).catch(() => { providerAbort.abort() }).finally(() => { polling = false })
      }, 2000)
      try {
        const { userId, guestId, projectId, recipeId, customInstructions, displayFormat } = admitted
        if (cancelled || providerAbort.signal.aborted) throw new Error('Generation stopped')

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
          close()
          return
        }

        const ownerErr = checkOwnership(project, userId, guestId)
        if (ownerErr) {
          controller.enqueue(sseEvent({ type: 'error', message: '権限がありません' }))
          close()
          return
        }

        // ====== レシピ取得 ======
        const recipe = await prisma.interviewRecipe.findUnique({ where: { id: recipeId } })
        if (!recipe || (!recipe.isTemplate && !recipe.isPublic && !(userId && recipe.userId === userId))) {
          controller.enqueue(sseEvent({ type: 'error', message: 'レシピが見つかりません' }))
          close()
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
          close()
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
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`

        if (cancelled || providerAbort.signal.aborted) throw new Error('Generation stopped')
        const geminiRes = await fetch(endpoint, {
          method: 'POST',
          signal: AbortSignal.any([providerAbort.signal, AbortSignal.timeout(ARTICLE_PROVIDER_TIMEOUT_MS)]),
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
            const providerError = await readInterviewGeminiResponse(geminiRes, 64 * 1024)
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
          close()
          return
        }

        // ====== SSE ストリームをパースしてクライアントに転送 ======
        let fullText = ''
        const reader = geminiRes.body?.getReader()
        providerReader = reader
        if (!reader) {
          controller.enqueue(sseEvent({ type: 'error', message: 'ストリーム読み取り失敗' }))
          close()
          return
        }

        const decoder = new TextDecoder('utf-8', { fatal: true })
        let buffer = ''
        let receivedBytes = 0
        let providerCompleted = false
        const consumeLine = (line: string) => {
          if (!line.startsWith('data:')) return
          const jsonStr = line.slice(5).trim()
          if (!jsonStr || jsonStr === '[DONE]') return
          if (jsonStr.length > ARTICLE_PROVIDER_EVENT_MAX_CHARS) throw new Error('Article provider event is too large')
          let parsed: any
          try {
            parsed = JSON.parse(jsonStr)
          } catch {
            throw new Error('Invalid article provider event')
          }
          const candidate = parsed?.candidates?.[0]
          const finishReason = candidate?.finishReason
          if (finishReason !== undefined && finishReason !== 'STOP') {
            throw new Error('Article provider did not finish normally')
          }
          const parts = candidate?.content?.parts
          const text = Array.isArray(parts)
            ? parts.map((part: any) => part?.thought !== true && typeof part?.text === 'string' ? part.text : '').join('')
            : ''
          if (providerCompleted && (text || finishReason !== undefined)) {
            throw new Error('Article provider sent content after completion')
          }
          if (text) {
            if (fullText.length + text.length > ARTICLE_TEXT_MAX_CHARS) throw new Error('Article text is too large')
            fullText += text
            controller.enqueue(sseEvent({ type: 'chunk', text }))
          }
          if (finishReason === 'STOP') providerCompleted = true
        }

        while (true) {
          if (providerAbort.signal.aborted) throw new Error('Generation stopped')
          const { done, value } = await reader.read()
          if (providerAbort.signal.aborted) throw new Error('Generation stopped')
          if (done) break
          receivedBytes += value.byteLength
          if (receivedBytes > ARTICLE_PROVIDER_STREAM_MAX_BYTES) throw new Error('Article provider stream is too large')

          buffer += decoder.decode(value, { stream: true })

          // SSE形式のレスポンスを行ごとにパース
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // 最後の不完全な行をバッファに戻す

          for (const line of lines) consumeLine(line)
          if (buffer.length > ARTICLE_PROVIDER_EVENT_MAX_CHARS) throw new Error('Article provider event is too large')
        }
        buffer += decoder.decode()
        for (const line of buffer.split('\n')) consumeLine(line)
        if (!providerCompleted) throw new Error('Article provider completion is missing')

        // ====== 記事をDBに保存 ======
        if (cancelled) return
        if (!fullText.trim()) {
          controller.enqueue(sseEvent({ type: 'error', message: '記事本文を生成できませんでした。再試行してください。' }))
          close()
          return
        }
        controller.enqueue(sseEvent({ type: 'progress', step: '記事を保存中...' }))

        // 同じプロジェクトの版番号採番と関連更新を一緒に確定する。
        const completion = await completeArticleOperation(admitted, async (tx) => {
          // ゲスト引き継ぎ・削除と同じロックを使い、生成中に所有者が変わった
          // プロジェクトへ古いゲスト枠の記事を書き込まない。
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('interview-project-lifecycle'), hashtext(${projectId}))`
          const currentProject = await tx.interviewProject.findUnique({
            where: { id: projectId }, select: { userId: true, guestId: true },
          })
          if (!currentProject || checkOwnership(currentProject, userId, guestId)) throw new ProjectOwnerChangedError()
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
          return { draftId: draft.id, wordCount: fullText.length, version: nextVersion }
        })
        if (completion.state !== 'completed' || !completion.result) {
          controller.enqueue(sseEvent({ type: 'error', code: 'ARTICLE_OPERATION_STOPPED', message: '生成処理は停止されました。処理状況を確認してください。' }))
          close()
          return
        }
        const { draftId, version: nextVersion } = completion.result
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
          draftId,
          wordCount: fullText.length,
          version: nextVersion,
        }))

        close()
      } catch (error) {
        providerAbort.abort()
        if (!cancelled) {
          console.error('[interview] article generation failed')
          try {
            controller.enqueue(sseEvent(error instanceof ProjectOwnerChangedError || error instanceof ArticleOperationError && error.code === 'OWNER_CHANGED'
              ? { type: 'error', code: 'PROJECT_OWNER_CHANGED', message: '生成中にプロジェクトの所有者が変更されました。再読み込みしてから再度お試しください。' }
              : { type: 'error', message: '記事生成に失敗しました。時間をおいて再試行してください。' }))
          } catch {
            // controller already closed
          }
          close()
        }
      } finally {
        clearInterval(cancellationPoll)
        providerAbort.abort()
        if (providerReader) { try { await providerReader.cancel() } catch {} }
        if (!draftSaved) {
          try { await failArticleOperation(admitted) }
          catch { console.error('[interview] article cleanup unconfirmed') }
        }
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
      ...privateHeaders,
      'X-Article-Operation-Id': admitted.operationId,
      'X-Article-Actor-Scope': scope,
      Connection: 'keep-alive',
    },
  })
}
