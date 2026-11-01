export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/adimage/concepts/[id]/feedback — 実画像を見て採点し、構造化された改善指示を作る
// ⚠️ 前身 /adbanner はプロンプト文字列だけを見て採点していた（画像を見ていなかった）。
//    ここでは必ず生成済みの画像そのものを渡す。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getIdentity, ownerWhere, requireUser } from '@/lib/adimage/access'
import { evaluateCreative, REFINE_CHIPS } from '@/lib/adimage/feedback'
import { downloadBuffer } from '@/lib/adimage/storage'
import { findPlacement } from '@/lib/adimage/placements'
import { AdImageFeedbackInputError, readAdImageFeedbackBody } from '@/lib/adimage/feedback-input'
import { adImageTargetHash, beginAdImageOperation, recoverAdImageOperation, settleAdImageFeedbackOperation, failAdImageOperation } from '@/lib/adimage/image-operation'
import { adImagePostInput, adImageOperationReply, adImageOperationErrorReply } from '@/lib/adimage/image-operation-http'
import type { AdCopy } from '@/lib/adimage/types'

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff' } })
}

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctxParam: Ctx) {
  let input: ReturnType<typeof adImagePostInput> | undefined
  let started = false
  try {
    const p = await ctxParam.params
    const identity = await getIdentity(req)
    const auth = requireUser(identity)
    if (!auth.ok) return reply({ error: auth.reason }, 401)
    const where = ownerWhere(identity)
    if (!where) return reply({ error: '利用者を識別できませんでした' }, 400)
    const body = await readAdImageFeedbackBody(req)
    input = adImagePostInput(identity.userId, 'feedback', p.id, body.operationId)
    if (!body.creativeId) return reply({ error: '採点対象を選択してください。' }, 400)
    const immutableBody = { creativeId: body.creativeId, chips: body.chips, note: body.note }
    // Replay precedes source reads, storage downloads and every provider call.
    const prior = await recoverAdImageOperation(input, false, immutableBody)
    if (prior.state !== 'missing') return await adImageOperationReply(input, prior)
    const concept = await prisma.adImageConcept.findFirst({
      where: { id: p.id, campaign: { ...where, brand: where } },
      include: { creatives: true, campaign: { include: { brand: true } } },
    })
    if (!concept) return reply({ error: 'コンセプトが見つかりません' }, 404)
    const target = concept.creatives.find(c => c.id === body.creativeId)
    if (!target) return reply({ error: '対象の画像がありません' }, 404)
    const admission = await beginAdImageOperation(input, immutableBody, 0, adImageTargetHash('feedback', concept))
    if (admission.state !== 'started') return await adImageOperationReply(input, admission)
    started = true
    const buf = await downloadBuffer(target.imagePath)
    if (!buf) return reply({ error: '画像を読み込めませんでした' }, 502)
    const userRequests = REFINE_CHIPS.filter(c => body.chips.includes(c.key)).map(c => c.request)
    if (body.note) userRequests.push(body.note)
    const result = await evaluateCreative({
      pngBase64: buf.toString('base64'), copy: concept.copy as unknown as AdCopy,
      brandName: concept.campaign.brand.name,
      placementName: findPlacement(target.placementKey)?.name ?? target.placementKey,
      userRequests,
    })
    // The ownership/source check, feedback row and completion receipt share one commit.
    const receipt = await settleAdImageFeedbackOperation(input, (tx, creativeId) => tx.adImageFeedback.create({
      data: { conceptId: concept.id, creativeId, source: userRequests.length ? 'user_chip' : 'ai_vision', scores: result.scores as any, advice: result.advice, directive: result.directives as any },
      select: { id: true },
    }))
    return await adImageOperationReply(input, { state: 'completed', receipt })
  } catch (error) {
    if (error instanceof AdImageFeedbackInputError) return reply({ error: error.message }, error.status)
    return adImageOperationErrorReply(error)
  } finally {
    // Completed rows survive a lost response; only an owned pending operation may fail.
    if (started && input) await failAdImageOperation(input).catch(() => {})
  }
}
