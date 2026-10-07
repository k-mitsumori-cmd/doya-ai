import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { randomUUID } from 'node:crypto'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendErrorNotification } from '@/lib/notifications'
import { resolveImageModel } from '@/lib/resolve-image-model'
import { HIGH_USAGE_CONTACT_URL } from '@/lib/pricing'
import { bannerHistoryCutoff } from '@/lib/banner/history-access'
import { readBannerRefineInput, compressBannerRefineInput, normalizeBannerRefineOutput } from '@/lib/banner/refine-input'
import { BannerOperationError, bannerRefineOperationId, bannerRefineFingerprint, beginBannerRefinement, completeBannerRefinement, failBannerRefinement, recoverBannerRefinement, cancelMissingBannerRefinement } from '@/lib/banner/refine-operation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const REFINE_TIMEOUT_MS = 170_000
const REFINE_IMAGE_RESPONSE_MAX_BYTES = 32 * 1024 * 1024
const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
function json(value: Record<string, unknown>, status = 200) { return NextResponse.json(value, { status, headers: privateHeaders }) }
function getApiKey(): string {
  const key = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.NANOBANNER_API_KEY
  if (!key) throw new Error('Banner image configuration unavailable')
  return key
}

async function readGeminiRefineResponse(res: Response, maxBytes: number): Promise<string> {
  if (Number(res.headers.get('content-length')) > maxBytes) {
    void res.body?.cancel().catch(() => {})
    throw new Error('バナー修正の応答が大きすぎます')
  }
  if (!res.body) return ''
  const reader = res.body.getReader()
  const chunks: Buffer[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > maxBytes) throw new Error('バナー修正の応答が大きすぎます')
      chunks.push(Buffer.from(value))
    }
    return Buffer.concat(chunks, length).toString('utf8')
  } finally {
    void reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}


function savedResult(operationId: string, generation: { id: string; output: string } | null) {
  if (!generation) return json({ success: false, state: 'unavailable', code: 'REFINE_RESULT_UNAVAILABLE', operationId, error: '保存結果は保存期間外か、削除されています。この操作は再実行されません。' }, 410)
  return json({ success: true, state: 'completed', operationId, generationId: generation.id, refinedImage: generation.output })
}
async function readOperation(request: NextRequest, cancel: boolean) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return json({ success: false, error: 'ログインが必要です。' }, 401)
    const operationId = bannerRefineOperationId(new URL(request.url).searchParams.get('operationId'))
    const cutoff = await bannerHistoryCutoff(session.user.id, session.user.firstLoginAt)
    const result = cancel
      ? await cancelMissingBannerRefinement(session.user.id, operationId, cutoff)
      : await recoverBannerRefinement(session.user.id, operationId, cutoff)
    if (result.state === 'completed') return savedResult(operationId, result.generation)
    return json({ success: false, state: result.state, operationId })
  } catch (error) {
    return json({ success: false, error: error instanceof BannerOperationError ? error.message : '修正結果を確認できませんでした。再生成せず、時間をおいて確認してください。' }, error instanceof BannerOperationError ? error.status : 503)
  }
}
export async function GET(request: NextRequest) { return readOperation(request, false) }
export async function DELETE(request: NextRequest) { return readOperation(request, true) }

export async function POST(request: NextRequest) {
  let operation: { userId: string; operationId: string; inputHash: string; cutoff: Date | null } | null = null
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return json({ success: false, error: 'ログインが必要です。' }, 401)
    const input = await readBannerRefineInput(request)
    // Older open tabs receive a server operation ID and durable history as well.
    // New clients persist their UUID before sending; only those can recover a lost response by UUID.
    const operationId = input.operationId ?? randomUUID()
    const compressed = await compressBannerRefineInput(input.originalImage)
    const inputHash = bannerRefineFingerprint(input)
    const cutoff = await bannerHistoryCutoff(session.user.id, session.user.firstLoginAt)
    const admission = await beginBannerRefinement(session.user.id, operationId, inputHash, cutoff, process.env.DOYA_DISABLE_LIMITS === '1')
    if (admission.state === 'completed') return savedResult(operationId, admission.generation)
    if (admission.state === 'pending') return json({ success: false, state: 'pending', code: 'REFINE_PENDING', operationId, error: 'この修正は処理中か、保存結果の確認が必要です。再生成せず保存結果を確認してください。' }, 202)
    if (admission.state === 'failed' || admission.state === 'cancelled') return json({ success: false, state: admission.state, code: 'REFINE_NOT_RESTARTED', operationId, error: 'この操作は再実行されません。結果を確認してから、新しい操作として修正してください。' }, 409)
    if (admission.state === 'limit') return json({ success: false, code: 'MONTHLY_LIMIT_REACHED', usage: admission.usage, upgradeUrl: admission.plan === 'FREE' ? '/banner/pricing' : (HIGH_USAGE_CONTACT_URL || '/banner/pricing'), error: '今月の生成上限に達しました。利用枠をご確認ください。' }, 429)
    operation = { userId: session.user.id, operationId, inputHash, cutoff }
    const apiKey = getApiKey()
    const models = await resolveImageModel(apiKey)
    const deadline = Date.now() + REFINE_TIMEOUT_MS
    const image = /^data:([^;]+);base64,(.+)$/.exec(compressed)
    if (!image || !models.length) throw new Error('Banner image preparation unavailable')
    for (let index = 0; index < models.length; index++) {
      const remaining = deadline - Date.now()
      if (remaining <= 0) throw new Error('Banner image deadline exceeded')
      const response = await fetch(`${GEMINI_API_BASE}/models/${models[index]}:generateContent`, {
        method: 'POST', signal: AbortSignal.timeout(remaining),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({ contents: [{ parts: [{ inlineData: { mimeType: image[1], data: image[2] } }, { text: createEditPrompt(input.instruction, input.category, input.size) }] }], generationConfig: { responseModalities: ['IMAGE'] } }),
      })
      // Only a definitive model-not-found rejection may use the configured Pro fallback.
      // Never repeat an uncertain network request or a request that returned image data.
      if (response.status === 404 && index + 1 < models.length) { void response.body?.cancel().catch(() => {}); continue }
      if (!response.ok) { void response.body?.cancel().catch(() => {}); throw new Error('Banner image provider rejected request') }
      const data = JSON.parse(await readGeminiRefineResponse(response, REFINE_IMAGE_RESPONSE_MAX_BYTES))
      const parts = data?.candidates?.[0]?.content?.parts
      const part = Array.isArray(parts) ? parts.find((value: { inlineData?: { data?: unknown } }) => typeof value?.inlineData?.data === 'string') : null
      if (!part || typeof part.inlineData.mimeType !== 'string') throw new Error('Banner image result unavailable')
      const refined = await normalizeBannerRefineOutput(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`, input.size)
      // Retry only the same in-memory image persistence, never the provider request.
      let lastSaveError: unknown
      for (let attempt = 0; attempt < 3; attempt++) {
        try { return savedResult(operationId, await completeBannerRefinement(session.user.id, operationId, inputHash, refined, input)) }
        catch (error) { lastSaveError = error }
      }
      throw lastSaveError
    }
    throw new Error('Banner image provider unavailable')
  } catch (error) {
    if (!operation && error instanceof BannerOperationError) return json({ success: false, error: error.message }, error.status)
    let state = 'pending'
    if (operation) {
      try {
        // This locked transaction refunds only if neither a completed receipt nor
        // a persisted result exists. An unavailable database leaves the outcome unknown.
        state = await failBannerRefinement(operation.userId, operation.operationId, operation.inputHash)
        if (state === 'completed') {
          const recovered = await recoverBannerRefinement(operation.userId, operation.operationId, operation.cutoff)
          if (recovered.state === 'completed') return savedResult(operation.operationId, recovered.generation)
        }
      }
      catch { console.warn('Banner refine failure transition unconfirmed') }
    }
    try {
    const notification = sendErrorNotification({ errorMessage: 'Banner refine failed', pathname: '/api/banner/refine', requestMethod: 'POST', timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) })
    try { waitUntil(notification) } catch { await notification.catch(() => {}) }
    } catch { console.warn('Banner refine notification unavailable') }
    return json({ success: false, ...(operation ? { operationId: operation.operationId, state, code: state === 'failed' ? 'REFINE_FAILED' : 'REFINE_UNCONFIRMED' } : {}), error: operation ? '修正結果を確認できませんでした。再生成せず保存結果を確認してください。' : 'バナーの修正を開始できませんでした。時間をおいて再試行してください。' }, operation ? 503 : 500)
  }
}

function createEditPrompt(instruction: string, category?: string, size?: string): string {
  // サイズ情報から余白なし指定を作成
  const [w, h] = (size || '').split('x').map(Number)
  const sizeNote = w && h ? `Output dimensions: EXACTLY ${w}x${h} px. Do NOT change aspect ratio. NO padding, NO letterboxing, NO borders.` : ''
  const tightTextNote =
    w && h && (h <= 120 || w / h >= 3.5)
      ? `SMALL/THIN FORMAT (CRITICAL):
- This is a small-height / extreme-wide banner. NEVER let any text be clipped.
- If space is tight, reduce font size and simplify decorative elements. Keep text inside safe margins (>= 6% from edges).
- Prefer 1-line headline; if unavoidable, 2 short lines with smaller font.`
      : ''
  return `Edit the provided Japanese marketing banner image.

USER INSTRUCTION:
${instruction}

${category ? `INDUSTRY: ${category}` : ''}
${sizeNote}
${tightTextNote}

=== DESIGN RULES ===
- STYLE: High-CTR Japanese paid-ad creative (SNS, Display, Landing page).
- LAYOUT: Keep text intact and readable. Update layout ONLY if user explicitly requests.
- TEXT: If user asks to change text, render the NEW Japanese text clearly with legible font, solid/gradient panel for contrast, and NO pseudo-characters.
- NO DUPLICATION: Do NOT repeat the same phrase. Never place identical text twice (e.g., no duplicated catchphrase/CTA).
- DIMENSIONS: Fill the ENTIRE canvas edge-to-edge. **ZERO** white-space or margin.
- NO logos, emblems, seals, watermarks, or invented brand marks unless user explicitly provides or requests.
- If user asks to add/remove elements, do so while maintaining visual hierarchy and text readability.
- Output ONE refined image (PNG).
`
}
