export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'
import { scoreLead } from '@/lib/sfa/ai'
import { sfaAiLimitResponse } from '@/lib/sfa/ai-limit'
import { canManageSfaBilling } from '@/lib/sfa/limits'
import { SfaMutationError } from '@/lib/sfa/mutation-authority'
import { scoreOperationInput, claimLeadScore, settleLeadScore, failLeadScore, recoverLeadScore } from '@/lib/sfa/score-operation'

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
const failure = (e: unknown) => json({ error: e instanceof SfaMutationError ? e.message : 'AI操作の結果を確認できませんでした。保存結果をご確認ください。' }, e instanceof SfaMutationError ? e.status : 500)

export async function POST(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return json({ error: 'ログイン/組織が必要です。' }, 401)
  try {
    const input = scoreOperationInput(await req.json().catch(() => null))
    const claim = await claimLeadScore(ctx, input)
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
    if (!claim.claimed) throw new Error('Missing score claim')
    const { lead, reservationId } = claim.claimed
    try {
      const raw = lead.raw && typeof lead.raw === 'object' && !Array.isArray(lead.raw) ? lead.raw as Record<string, unknown> : {}
      const number = (v: unknown) => (typeof v === 'number' || typeof v === 'string' && v.trim()) && Number.isFinite(Number(v)) ? Number(v) : null
      const text = (v: unknown) => typeof v === 'string' ? v : null
      const result = await scoreLead({ name: lead.name, industry: text(raw.industry), prefecture: text(raw.prefecture),
        employeeCount: number(raw.employeeCount ?? raw.employee_number), capital: number(raw.capital ?? raw.capital_stock),
        status: lead.status, note: lead.note, source: lead.source })
      const saved = await settleLeadScore(ctx, input, reservationId, result)
      return json({ state: 'found', score: saved })
    } catch (error) {
      // If cleanup is uncertain, retain the client's recovery fence rather than claim a safe retry.
      try { await failLeadScore(ctx, input, reservationId) } catch { return json({ error: 'AI操作の結果を確認できませんでした。保存結果をご確認ください。' }, 503) }
      return failure(error)
    }
  } catch (error) { return failure(error) }
}
async function recover(req: NextRequest, cancel: boolean) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return json({ error: 'ログイン/組織が必要です。' }, 401)
  try {
    const params = new URL(req.url).searchParams, leads = params.getAll('leadId'), operations = params.getAll('operationId')
    if (leads.length !== 1 || operations.length !== 1) throw new SfaMutationError(400, 'リードと操作情報を指定してください。')
    return json(await recoverLeadScore(ctx, leads[0], operations[0], cancel))
  } catch (error) { return failure(error) }
}
export async function GET(req: NextRequest) { return recover(req, false) }
// Fences only an operation not yet claimed. A running provider request is never reported as cancelled.
export async function DELETE(req: NextRequest) { return recover(req, true) }
