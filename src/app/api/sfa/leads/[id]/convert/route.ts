export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'
import { bigIntToNumber } from '@/lib/sfa/format'
import { lockDealStage, dealStageChange } from '@/lib/sfa/deal-mutation'
import { conversionInput, conversionValues, lockConversionLead, findConversion } from '@/lib/sfa/lead-conversion'
import { createSfaOnce, recoverSfaCreation, cancelSfaCreation, sfaOperationId } from '@/lib/sfa/creation-receipt'
import { lockSfaMutationActor, SfaMutationError } from '@/lib/sfa/mutation-authority'
import { canManageSfaBilling, checkSfaQuota, sfaQuotaResponse, withSfaAdmission, type SfaQuotaExceeded } from '@/lib/sfa/limits'

type Ctx = { params: Promise<{ id: string }> }
const json = (body: unknown, status = 200) => NextResponse.json(bigIntToNumber(body), { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
class ConversionQuotaError extends Error { constructor(readonly limit: SfaQuotaExceeded, readonly billing: boolean) { super('Conversion quota exceeded') } }
const validLeadId = (id: string) => { if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new SfaMutationError(400, 'リードの指定が正しくありません。') }
function failure(error: unknown, fallback: string) {
  if (error instanceof ConversionQuotaError) {
    const response = sfaQuotaResponse(error.limit, error.billing)
    response.headers.set('Cache-Control', 'private, no-store'); response.headers.set('Vary', 'Cookie')
    return response
  }
  return json({ error: error instanceof SfaMutationError ? error.message : fallback }, error instanceof SfaMutationError ? error.status : 500)
}

// Conversion, receipt and both quota reservations commit or roll back together.
export async function POST(req: NextRequest, ctx: Ctx) {
  const c = await getSfaContext(orgSlugFrom(req))
  if (!c) return json({ error: 'ログインが必要です' }, 401)
  try {
    const { id } = await ctx.params; validLeadId(id)
    const { body, text, amount, expectedUpdatedAt } = conversionInput(await req.json().catch(() => null))
    const operationId = sfaOperationId(body.operationId)
    const admitted = await withSfaAdmission(c.organizationId, {}, async tx => {
      await lockSfaMutationActor(tx, c)
      return createSfaOnce(tx, c, `conversion:${id}`, operationId,
        { leadId: id, text, amount: amount.toString(), expectedUpdatedAt: expectedUpdatedAt?.toISOString() || null },
        dealId => findConversion(tx, c, id, dealId), async () => {
          const lead = await lockConversionLead(tx, c, id)
          if (!lead) throw new SfaMutationError(404, 'リードが見つかりません。')
          if (lead.status === 'converted' || lead.convertedAccountId) throw new SfaMutationError(409, '既に転換済みです。一覧を確認してください。')
          if (expectedUpdatedAt && lead.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw new SfaMutationError(409, 'リードが更新されています。一覧を再読み込みして内容を確認してください。')
          const v = conversionValues(lead, text)
          const limit = await checkSfaQuota(tx, c.organizationId, { accounts: 1, deals: 1 })
          if (limit) throw new ConversionQuotaError(limit, await canManageSfaBilling(tx, c.organizationId, c.userId))
          const stage = await lockDealStage(tx, c, null)
          const claimed = await tx.sfaLead.updateMany({
            where: { id, organizationId: c.organizationId, isActive: true, status: { not: 'converted' }, convertedAccountId: null },
            data: { status: 'converted' },
          })
          if (claimed.count !== 1) throw new SfaMutationError(409, 'リードの状態が変わっています。一覧を確認してください。')
          const account = await tx.sfaAccount.create({ data: {
            organizationId: c.organizationId, name: v.accountName, corporateNumber: v.corporateNumber,
            industry: v.industry, prefecture: v.prefecture, url: v.url, note: v.note, ownerMemberId: c.memberId,
          } })
          if (v.contactName) await tx.sfaContact.create({ data: {
            organizationId: c.organizationId, accountId: account.id, name: v.contactName,
            email: v.email, phone: v.phone, isKeyPerson: true,
          } })
          const now = new Date()
          const deal = await tx.sfaDeal.create({ data: {
            organizationId: c.organizationId, accountId: account.id, name: v.dealName, amount,
            assigneeMemberId: c.memberId, startDate: now,
            ...(stage ? dealStageChange(stage) : { stageId: null, probability: 0, status: 'open', wonAt: null, lostAt: null, lastActivityAt: now }),
          } })
          await tx.sfaLead.update({ where: { id }, data: { status: 'converted', convertedAccountId: account.id } })
          return { id: deal.id, leadId: id, account, deal }
        }, { retrySerializableRace: true })
    })
    if (admitted.limit) throw new ConversionQuotaError(admitted.limit, false)
    return json({ ok: true, ...admitted.created })
  } catch (error) { return failure(error, '転換結果を確認できませんでした。一覧をご確認ください。') }
}

async function recover(req: NextRequest, ctx: Ctx, cancel: boolean) {
  const c = await getSfaContext(orgSlugFrom(req))
  if (!c) return json({ error: 'ログインが必要です' }, 401)
  try {
    const { id } = await ctx.params; validLeadId(id)
    const operations = new URL(req.url).searchParams.getAll('operationId')
    if (operations.length !== 1) throw new SfaMutationError(400, '操作情報を指定してください。')
    const operationId = sfaOperationId(operations[0])!
    const recovery = await prisma.$transaction(async tx => {
      await lockSfaMutationActor(tx, c)
      const find = (dealId: string) => findConversion(tx, c, id, dealId)
      return cancel ? cancelSfaCreation(tx, c, `conversion:${id}`, operationId, find)
        : recoverSfaCreation(tx, c, `conversion:${id}`, operationId, find)
    })
    return json({ state: recovery.state, conversion: recovery.row })
  } catch (error) { return failure(error, '転換結果を確認できませんでした。時間をおいて確認してください。') }
}
export async function GET(req: NextRequest, ctx: Ctx) { return recover(req, ctx, false) }
// DELETE fences only the operation receipt. It never deletes a lead, account or deal.
export async function DELETE(req: NextRequest, ctx: Ctx) { return recover(req, ctx, true) }
