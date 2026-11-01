export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest } from 'next/server'
import { getIdentity } from '@/lib/adimage/access'
import { analyzeBrand, BrandSourceError } from '@/lib/adimage/brand'
import { findRiskyExpressions, generateConcepts } from '@/lib/adimage/copy'
import { readAdImageAnalysisBody, AdImageAnalysisInputError } from '@/lib/adimage/analysis-input'
import { validAdImageAnalysisOutput } from '@/lib/adimage/analysis-result'
import { adImageTargetHash, beginAdImageOperation, recoverAdImageOperation, settleAdImageAnalysisOperation, failAdImageOperation, failAdImageAnalysisOperation, AdImageOperationError, type AdImageOperationInput } from '@/lib/adimage/image-operation'
import { adImagePostInput, adImageOperationBody, adImageOperationReply, adImageOperationErrorReply, privateAdImageReply } from '@/lib/adimage/image-operation-http'

/** Durable operation identity is checked before quota, source fetch or providers. */
export async function POST(req: NextRequest) {
  let input: AdImageOperationInput | undefined
  let started = false
  try {
    const identity = await getIdentity(req)
    if (!identity.userId) return privateAdImageReply({ error: 'ログインが必要です。' }, 401)
    const supplied = await readAdImageAnalysisBody(req)
    input = adImagePostInput(identity.userId, 'analyze', 'analysis', supplied.operationId)
    const body = adImageOperationBody({ ...supplied })
    const prior = await recoverAdImageOperation(input, false, body)
    if (prior.state !== 'missing') return await adImageOperationReply(input, prior)
    const admission = await beginAdImageOperation(input, body, 0, adImageTargetHash('analyze', body))
    if (admission.state !== 'started') return await adImageOperationReply(input, admission)
    started = true
    let brand
    try { brand = await analyzeBrand(supplied.url, supplied.manualText) }
    catch (error) {
      if (error instanceof BrandSourceError) {
        if (error.status === 503) console.error('[adimage] source temporarily unavailable')
        else console.warn('[adimage] source cannot be imported')
        return await adImageOperationReply(input, await failAdImageAnalysisOperation(input, true, { error: error.message, code: 'WEBSITE_UNREADABLE', canUseManualInput: true }))
      }
      console.error('[adimage] analyze failed')
      return await adImageOperationReply(input, await failAdImageAnalysisOperation(input, false, { error: 'ブランド情報の解析に失敗しました。操作を閉じてから再度お試しください。', code: 'ANALYSIS_FAILED' }))
    }
    let concepts
    try { concepts = await generateConcepts({ brand, appeal: supplied.appeal, objective: supplied.objective }) }
    catch { console.error('[adimage] concepts failed'); return await adImageOperationReply(input, await failAdImageAnalysisOperation(input, false, { error: 'コピーの生成に失敗しました。操作を閉じてから再度お試しください。', code: 'COPY_FAILED' })) }
    const output = { brand, concepts: concepts.map(c => ({ ...c, warnings: findRiskyExpressions(c.copy) })) }
    if (!validAdImageAnalysisOutput(output)) return await adImageOperationReply(input, await failAdImageAnalysisOperation(input, false, { error: '解析結果を確認できません。操作を閉じてから再度お試しください。', code: 'ANALYSIS_FAILED' }))
    const receipt = await settleAdImageAnalysisOperation(input, output, tx => tx.adImageBrand.create({
      data: { userId: identity.userId, name: brand.name, sourceUrl: supplied.url, description: brand.description ?? null, valueProps: brand.valueProps, colors: brand.colors, industry: brand.industry ?? null, tone: brand.tone ?? null }, select: { id: true },
    }))
    return await adImageOperationReply(input, { state: 'completed', receipt })
  } catch (error) {
    if (error instanceof AdImageAnalysisInputError) return privateAdImageReply({ error: error.message }, error.status)
    if (!(error instanceof AdImageOperationError)) console.error('[adimage] analysis result unconfirmed')
    return adImageOperationErrorReply(error)
  } finally {
    // Completed results survive signing/response/commit acknowledgement failures.
    if (started && input) {
      try { await failAdImageOperation(input) } catch { console.error('[adimage] analysis final state unconfirmed') }
    }
  }
}
