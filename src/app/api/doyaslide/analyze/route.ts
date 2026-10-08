export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { getUserId } from '@/lib/doyaslide/access'
import { scrapeUrlText } from '@/lib/doyaslide/scrape'
import { buildAnalyzePrompt } from '@/lib/doyaslide/prompts'
import { beginUrlAnalysisOperation, recoverUrlAnalysisOperation, settleUrlAnalysisOperation, UrlAnalysisOperationError, type UrlAnalysisOperation } from '@/lib/doyaslide/url-analysis-operation'

const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
function json(value: unknown, status = 200) { return NextResponse.json(value, { status, headers: privateHeaders }) }
function saved(operation: UrlAnalysisOperation) {
  const status = operation.state === 'pending' ? 202 : operation.state === 'busy' ? 409
    : operation.state === 'failed' ? (operation.code === 'DOYASLIDE_TEXT_DAILY_LIMIT' ? 429 : 400) : 200
  return json(operation, status)
}
function failure(error: unknown) {
  if (error instanceof UrlAnalysisOperationError) return json({ code: error.code, error: error.message }, error.status)
  console.error('[doyaslide/analyze] operation unavailable')
  return json({ code: 'RESULT_UNCONFIRMED', error: '結果を確認できません。再解析せず、時間をおいて結果を確認してください。' }, 503)
}
async function readOperation(req: NextRequest, cancel: boolean) {
  try {
    const actor = await getUserId()
    if (!actor) return json({ error: 'ログインが必要です' }, 401)
    const operationId = new URL(req.url).searchParams.get('operationId') || ''
    return saved(await recoverUrlAnalysisOperation({ actor, operationId }, cancel))
  } catch (error) { return failure(error) }
}
// Recovery and cancellation never scrape a URL or start another provider call.
export async function GET(req: NextRequest) { return readOperation(req, false) }
export async function DELETE(req: NextRequest) { return readOperation(req, true) }

export async function POST(req: NextRequest) {
  try {
    const actor = await getUserId()
    if (!actor) return json({ error: 'ログインが必要です' }, 401)
    // Bound untrusted input before parsing. A reference URL and UUID fit in 16 KiB.
    if (!req.body || Number(req.headers.get('content-length')) > 16384) return json({ error: '入力内容を確認してください' }, 400)
    const reader = req.body.getReader()
    let body: unknown
    try {
      const chunks: Uint8Array[] = []; let size = 0
      while (true) {
        const part = await reader.read()
        if (part.done) break
        size += part.value.byteLength
        if (size > 16384) return json({ error: '入力内容を確認してください' }, 400)
        chunks.push(part.value)
      }
      const bytes = new Uint8Array(size); let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
      body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    } catch { return json({ error: '入力内容を確認してください' }, 400) }
    finally { void reader.cancel().catch(() => {}); reader.releaseLock() }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: '入力内容を確認してください' }, 400)
    const row = body as Record<string, unknown>
    if (typeof row.url !== 'string' || !row.url.trim()) return json({ error: 'URLを入力してください' }, 400)
    if (typeof row.operationId !== 'string' || !row.operationId) return json({ code: 'CLIENT_UPDATE_REQUIRED', error: '画面を再読み込みしてから解析してください。' }, 409)
    const input = { actor, operationId: row.operationId, url: typeof row.url === 'string' ? row.url.trim() : '' }
    const admission = await beginUrlAnalysisOperation(input)
    if (admission.state !== 'started') return saved(admission)

    let scraped
    try { scraped = await scrapeUrlText(input.url) }
    catch { return saved(await settleUrlAnalysisOperation(input, null)) }
    const result = await geminiGenerateJson<{ title: string; brief: string }>(
      { prompt: buildAnalyzePrompt(scraped), model: GEMINI_TEXT_MODEL_DEFAULT }, 'UrlAnalysis'
    ).catch(() => {
      console.warn('[doyaslide/analyze] AI proposal unavailable; using page content')
      return null
    })
    const proposedTitle = typeof result?.title === 'string' ? result.title.trim().slice(0, 120) : ''
    const proposedBrief = typeof result?.brief === 'string' ? result.brief.trim().slice(0, 2000) : ''
    const referenceText = scraped.text.slice(0, 6000)
    // Store before replying. A lost acknowledgement can be recovered by the same UUID.
    return saved(await settleUrlAnalysisOperation(input, referenceText.trim() ? {
      title: proposedTitle || scraped.title.slice(0, 120),
      brief: proposedBrief || scraped.description.slice(0, 2000),
      referenceText,
      aiAnalyzed: !!(proposedTitle || proposedBrief),
    } : null))
  } catch (error) { return failure(error) }
}
