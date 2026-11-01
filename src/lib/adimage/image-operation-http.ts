import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getIdentity } from './access'
import { signedUrl } from './storage'
import { findPlacement } from './placements'
import { raceTimeout } from '@/lib/fetch-timeout'
import { adImageTargetHash, AdImageOperationError, recoverAdImageOperation, type AdImageOperationInput, type beginAdImageOperation } from './image-operation'

type Result = Awaited<ReturnType<typeof recoverAdImageOperation>> | Awaited<ReturnType<typeof beginAdImageOperation>>
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const identifier = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v)
export function privateAdImageReply(body: unknown, status = 200, maxBytes = 256 * 1024) {
  if (Buffer.byteLength(JSON.stringify(body)) > maxBytes) throw new AdImageOperationError(502, 'RESULT_TOO_LARGE', '結果を確認できません。再生成せず保存結果を確認してください。')
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff' } })
}
export function adImageOperationErrorReply(error: unknown) {
  if (error instanceof AdImageOperationError) return privateAdImageReply({ error: error.message, code: error.code }, error.status)
  return privateAdImageReply({ error: '処理結果を確認できません。再生成せず「保存結果を確認」を押してください。', code: 'RESULT_UNCONFIRMED' }, 503)
}
export function adImagePostInput(actor: string | null, kind: AdImageOperationInput['kind'], targetId: unknown, operationId: unknown): AdImageOperationInput {
  if (operationId === undefined) throw new AdImageOperationError(409, 'OPERATION_REQUIRED', '画面を再読み込みしてから操作してください。以前の操作を自動で再実行することはありません。')
  if (!identifier(actor) || !identifier(targetId) || typeof operationId !== 'string' || !uuid.test(operationId)) throw new AdImageOperationError(400, 'INVALID_OPERATION', '操作内容を確認してください。')
  return { actor, kind, targetId, operationId: operationId.toLowerCase() }
}
export async function readAdImagePostBody(req: NextRequest, kind: AdImageOperationInput['kind']) {
  if (!req.body) throw new AdImageOperationError(409, 'OPERATION_REQUIRED', '画面を再読み込みしてから操作してください。')
  const length = req.headers.get('content-length')
  if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))) throw new AdImageOperationError(400, 'INVALID_OPERATION', '入力形式を確認してください。')
  if (Number(length) > 32768) throw new AdImageOperationError(413, 'INPUT_TOO_LARGE', '入力が長すぎます。')
  const reader = req.body.getReader()
  let timer: ReturnType<typeof setTimeout> | undefined, abort: (() => void) | undefined
  try {
    const stopped = new Promise<never>((_, reject) => {
      abort = () => reject(new AdImageOperationError(408, 'INPUT_TIMEOUT', '入力を受け取れませんでした。通信状態をご確認ください。'))
      timer = setTimeout(abort, 15000); req.signal.addEventListener('abort', abort, { once: true }); if (req.signal.aborted) abort()
    })
    const reading = (async () => {
      const chunks: Uint8Array[] = []; let size = 0
      while (true) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength; if (size > 32768) throw new AdImageOperationError(413, 'INPUT_TOO_LARGE', '入力が長すぎます。'); chunks.push(next.value) }
      const bytes = new Uint8Array(size); let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
      try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown } catch { throw new AdImageOperationError(400, 'INVALID_OPERATION', '入力形式を確認してください。') }
    })()
    const body = await Promise.race([reading, stopped])
    const allowed = new Set(kind === 'generate' ? ['operationId', 'brandId', 'copy', 'placements', 'variations', 'customPrompt', 'designRefId', 'label', 'appealAxis', 'tone', 'appeal', 'campaignName', 'objective'] : ['operationId', 'chips', 'note'])
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !allowed.has(k))) throw new AdImageOperationError(400, 'INVALID_OPERATION', '操作内容を確認してください。')
    return body as Record<string, unknown>
  } finally { if (timer) clearTimeout(timer); if (abort) req.signal.removeEventListener('abort', abort); void reader.cancel().catch(() => {}) }
}
export function adImageOperationBody(body: Record<string, unknown>) { return Object.fromEntries(Object.entries(body).filter(([k]) => k !== 'operationId')) }
export async function adImageOperationReply(input: AdImageOperationInput, result: Result) {
  const metadata = { operationId: input.operationId, kind: input.kind, targetId: input.targetId }
  if (result.state === 'started') throw new AdImageOperationError(500, 'INVALID_STATE', '処理結果を確認できません。')
  if (result.state === 'limit') { const { ok: _ok, reason, ...quota } = result.quota; return privateAdImageReply({ ...metadata, state: 'limit', error: reason, ...quota }, 429) }
  if (result.state !== 'completed' || !('receipt' in result)) return privateAdImageReply({ ...metadata, state: result.state, ...(input.kind === 'analyze' && 'receipt' in result && result.state === 'failed' ? result.receipt.analysisFailure : {}) }, result.state === 'pending' || result.state === 'busy' ? 202 : 200)
  const receipt = result.receipt
  if (input.kind === 'analyze') {
    const brand = await prisma.adImageBrand.findFirst({ where: { id: receipt.brandId, userId: input.actor } })
    if (!brand || adImageTargetHash('analyze', brand) !== receipt.targetHash) return privateAdImageReply({ ...metadata, state: 'unavailable' })
    const { validAdImageAnalysisOutput } = await import('./analysis-result')
    if (!validAdImageAnalysisOutput(receipt.analysisResult)) throw new AdImageOperationError(409, 'INVALID_RECEIPT', '保存された解析結果を確認できません。')
    return privateAdImageReply({ ...metadata, state: 'completed', brandId: receipt.brandId, ...receipt.analysisResult })
  }
  const concept = await prisma.adImageConcept.findFirst({ where: { id: receipt.conceptId!, campaign: { userId: input.actor, brand: { userId: input.actor } } }, include: { creatives: true, ...(input.kind === 'feedback' ? { campaign: { include: { brand: true } } } : {}) } })
  if (!concept || (input.kind === 'feedback' ? adImageTargetHash('feedback', concept) !== receipt.targetHash : concept.creatives.length !== receipt.produced)) return privateAdImageReply({ ...metadata, state: 'unavailable' })
  let feedbackResult: Record<string, unknown> = {}
  if (input.kind === 'feedback') {
    const feedback = await prisma.adImageFeedback.findFirst({ where: { id: receipt.feedbackId, conceptId: receipt.conceptId!, creativeId: receipt.creativeId, concept: { campaign: { userId: input.actor, brand: { userId: input.actor } } }, creative: { conceptId: input.targetId } }, select: { id: true, creativeId: true, scores: true, advice: true, directive: true } })
    if (!feedback) return privateAdImageReply({ ...metadata, state: 'unavailable' })
    const { parseAdImageFeedback } = await import('./feedback')
    feedbackResult = { feedbackId: feedback.id, creativeId: feedback.creativeId, ...parseAdImageFeedback({ scores: feedback.scores, advice: feedback.advice, directives: feedback.directive }) }
  }
  const previousId = input.kind === 'refine' ? input.targetId : input.kind === 'feedback' ? concept.parentId : null
  const previous = previousId ? await prisma.adImageConcept.findFirst({ where: { id: previousId, campaignId: concept.campaignId, campaign: { userId: input.actor, brand: { userId: input.actor } } }, include: { creatives: true } }) : null
  const creativeDto = async (cr: (typeof concept.creatives)[number]) => {
    const url = await signedUrl(cr.imagePath)
    try { const parsed = new URL(url || ''); if (!url || url.length > 8192 || !['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error() }
    catch { throw new AdImageOperationError(503, 'RESULT_UNCONFIRMED', '画像のURLを発行できませんでした。再生成せず保存結果を確認してください。') }
    const p = findPlacement(cr.placementKey)
    return { id: cr.id, placementKey: cr.placementKey, placementName: p?.name || cr.placementKey, media: p?.media || '', size: cr.size, verify: cr.verify, url }
  }
  const [creatives, previousCreatives] = await raceTimeout('adimage result URLs', 15000, Promise.all([Promise.all(concept.creatives.map(creativeDto)), Promise.all((previous?.creatives || []).map(creativeDto))]))
  // Storage signing awaits external work. Revalidate current ownership and receipt availability before returning private data.
  if ((await recoverAdImageOperation(input)).state !== 'completed') return privateAdImageReply({ ...metadata, state: 'unavailable' })
  const shown = [concept, ...(previous ? [previous] : [])]
  const currentImages = await prisma.adImageConcept.findMany({ where: { id: { in: shown.map(row => row.id) }, campaignId: concept.campaignId, campaign: { userId: input.actor, brand: { userId: input.actor } } }, select: { id: true, generation: true, creatives: { select: { id: true, imagePath: true } } } })
  if (shown.some(row => {
    const current = currentImages.find(saved => saved.id === row.id)
    return !current || current.generation !== row.generation || current.creatives.length !== row.creatives.length || row.creatives.some(creative => !current.creatives.some(saved => saved.id === creative.id && saved.imagePath === creative.imagePath))
  })) return privateAdImageReply({ ...metadata, state: 'unavailable' })
  return privateAdImageReply({ ...metadata, ...feedbackResult, state: 'completed', conceptId: concept.id, campaignId: concept.campaignId, copy: concept.copy, generation: concept.generation, creatives, previousCreatives, previousGeneration: previous?.generation ?? null, appliedDirectives: receipt.appliedDirectives, failedPlacements: receipt.failedPlacements, needsReview: creatives.some(c => Boolean((c.verify as { needsReview?: boolean } | null)?.needsReview)) })
}
export async function readAdImageOperation(req: NextRequest, cancelMissing: boolean) {
  try {
    const identity = await getIdentity(req)
    if (!identity.userId) return privateAdImageReply({ error: 'ログインが必要です。' }, 401)
    const params = req.nextUrl.searchParams, allowed = new Set(['operationId', 'kind', 'targetId'])
    if (['logo-upload', 'logo-remove'].includes(params.get('kind') || '')) {
      if ([...params.keys()].some(k => !allowed.has(k) || params.getAll(k).length !== 1)) throw new AdImageOperationError(400, 'INVALID_OPERATION', '操作内容を確認してください。')
      const { recoverAdImageLogo, AdImageLogoError } = await import('./logo-operation')
      try {
        const value = await recoverAdImageLogo({ actor: identity.userId, operationId: params.get('operationId') || '', targetId: params.get('targetId') || '', kind: params.get('kind') as 'logo-upload' | 'logo-remove' }, cancelMissing)
        const { adImageLogoReply } = await import('./logo-operation-http')
        return await adImageLogoReply({ actor: identity.userId, operationId: params.get('operationId') || '', targetId: params.get('targetId') || '', kind: params.get('kind') as 'logo-upload' | 'logo-remove' }, value)
      } catch (error) {
        if (error instanceof AdImageLogoError) return privateAdImageReply({ error: error.message }, error.status)
        throw error
      }
    }
    if ([...params.keys()].some(k => !allowed.has(k) || params.getAll(k).length !== 1) || !['generate', 'refine', 'feedback', 'analyze'].includes(params.get('kind') || '')) throw new AdImageOperationError(400, 'INVALID_OPERATION', '操作内容を確認してください。')
    const input = adImagePostInput(identity.userId, params.get('kind') as AdImageOperationInput['kind'], params.get('targetId'), params.get('operationId'))
    return await adImageOperationReply(input, await recoverAdImageOperation(input, cancelMissing))
  } catch (error) { return adImageOperationErrorReply(error) }
}
