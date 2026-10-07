export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'
import { suggestNextAction } from '@/lib/sfa/ai'
import { sfaAiLimitResponse } from '@/lib/sfa/ai-limit'
import { canManageSfaBilling } from '@/lib/sfa/limits'
import { SfaMutationError } from '@/lib/sfa/mutation-authority'
import { nextActionOperationInput, claimNextAction, settleNextAction, failNextAction, recoverNextAction } from '@/lib/sfa/next-action-operation'

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
const failure = (e: unknown) => json({ error: e instanceof SfaMutationError ? e.message : 'AI操作の結果を確認できませんでした。保存結果をご確認ください。' }, e instanceof SfaMutationError ? e.status : 500)

export async function POST(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return json({ error: 'ログイン/組織が必要です。' }, 401)
  try {
    const input = nextActionOperationInput(await req.json().catch(() => null))
    const claim = await claimNextAction(ctx, input)
    if (claim.quota) {
      const response = sfaAiLimitResponse(claim.quota, await canManageSfaBilling(prisma, ctx.organizationId, ctx.userId))
      response.headers.set('Cache-Control', 'private, no-store'); response.headers.set('Vary', 'Cookie')
      return response
    }
    if (claim.outcome) {
      if (claim.outcome.state === 'found') return json(claim.outcome)
      if (claim.outcome.state === 'pending') return json(claim.outcome, 202)
      throw new SfaMutationError(409, 'このAI操作は完了できません。保存結果を確認してから新しく実行してください。')
    }
    if (!claim.claimed) throw new Error('Missing next-action claim')
    const { providerInput, reservationId, startedAt } = claim.claimed
    try {
      const result = await suggestNextAction(providerInput, new Date(startedAt))
      const saved = await settleNextAction(ctx, input, reservationId, result)
      return json({ state: 'found', suggestion: saved })
    } catch (error) {
      // If cleanup is uncertain, retain the client's recovery fence rather than claim a safe retry.
      try { await failNextAction(ctx, input, reservationId) } catch { return json({ error: 'AI操作の結果を確認できませんでした。保存結果をご確認ください。' }, 503) }
      return failure(error)
    }
  } catch (error) { return failure(error) }
}
async function recover(req: NextRequest, cancel: boolean) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return json({ error: 'ログイン/組織が必要です。' }, 401)
  try {
    const params = new URL(req.url).searchParams, deals = params.getAll('dealId'), operations = params.getAll('operationId')
    if (deals.length !== 1 || operations.length !== 1) throw new SfaMutationError(400, '商談と操作情報を指定してください。')
    return json(await recoverNextAction(ctx, deals[0], operations[0], cancel))
  } catch (error) { return failure(error) }
}
export async function GET(req: NextRequest) { return recover(req, false) }
// Fences only an operation not yet claimed. A running provider request is never reported as cancelled.
export async function DELETE(req: NextRequest) { return recover(req, true) }
