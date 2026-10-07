export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'
import { bigIntToNumber } from '@/lib/sfa/format'
import { lockSfaMutationActor, SfaMutationError } from '@/lib/sfa/mutation-authority'
import { leadId, leadInput, lockLead, assertLeadVersion, nextLeadVersion } from '@/lib/sfa/lead-mutation'
import { dealVersion } from '@/lib/sfa/deal-mutation'
import { withSfaAdmission } from '@/lib/sfa/limits'

type Ctx = { params: Promise<{ id: string }> }
const json = (body: unknown, status = 200) => NextResponse.json(bigIntToNumber(body), { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
const fail = (error: unknown) => json({ error: error instanceof SfaMutationError ? error.message : '操作結果を確認できませんでした。一覧をご確認ください。' }, error instanceof SfaMutationError ? error.status : 500)

// Recovery reports current presence only; absence does not identify the actor who deleted it.
export async function GET(req: NextRequest, ctx: Ctx) {
  const c = await getSfaContext(orgSlugFrom(req))
  if (!c) return json({ error: 'ログインが必要です' }, 401)
  try {
    const id = leadId((await ctx.params).id)
    const lead = await prisma.$transaction(async tx => { await lockSfaMutationActor(tx, c); return lockLead(tx, c, id, false) })
    return json({ state: lead ? 'found' : 'missing', lead })
  } catch (error) { return fail(error) }
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const c = await getSfaContext(orgSlugFrom(req))
  if (!c) return json({ error: 'ログインが必要です' }, 401)
  try {
    const id = leadId((await ctx.params).id)
    const { data, expectedUpdatedAt } = leadInput(await req.json().catch(() => null))
    const result = await withSfaAdmission(c.organizationId, {}, async tx => {
      await lockSfaMutationActor(tx, c)
      const lead = await lockLead(tx, c, id)
      if (!lead) throw new SfaMutationError(404, 'リードが見つかりません。')
      assertLeadVersion(expectedUpdatedAt, lead.updatedAt)
      if (data.status === 'converted' && lead.status !== 'converted') throw new SfaMutationError(400, '転換済への変更は「取引先に転換」から行ってください。')
      if (data.status !== undefined && data.status !== 'converted' && (lead.status === 'converted' || lead.convertedAccountId)) throw new SfaMutationError(409, '転換済のリードは状態を戻せません。')
      const changed = await tx.sfaLead.updateMany({
        where: { id, organizationId: c.organizationId, isActive: true,
          ...(data.status !== undefined && data.status !== 'converted' ? { status: { not: 'converted' }, convertedAccountId: null } : {}),
          ...(expectedUpdatedAt ? { updatedAt: expectedUpdatedAt } : {}),
        }, data: { ...data, updatedAt: nextLeadVersion(lead.updatedAt) },
      })
      if (changed.count !== 1) throw new SfaMutationError(409, 'リードの状態が変わっています。一覧を確認してください。')
      return tx.sfaLead.findFirstOrThrow({ where: { id, organizationId: c.organizationId, isActive: true } })
    })
    if (result.limit) throw new Error('Unexpected lead admission limit')
    return json({ lead: result.created })
  } catch (error) { return fail(error) }
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const c = await getSfaContext(orgSlugFrom(req))
  if (!c) return json({ error: 'ログインが必要です' }, 401)
  try {
    const id = leadId((await ctx.params).id)
    const versions = new URL(req.url).searchParams.getAll('expectedUpdatedAt')
    if (versions.length !== 1) throw new SfaMutationError(400, '更新日時を確認できません。画面を再読み込みしてから操作してください。')
    const expected = dealVersion(versions.length ? versions[0] : undefined)
    const result = await withSfaAdmission(c.organizationId, {}, async tx => {
      await lockSfaMutationActor(tx, c)
      const lead = await lockLead(tx, c, id)
      if (!lead) throw new SfaMutationError(404, 'リードが見つかりません。')
      assertLeadVersion(expected, lead.updatedAt)
      await tx.sfaLead.update({ where: { id }, data: { isActive: false, updatedAt: nextLeadVersion(lead.updatedAt) } })
      return { ok: true }
    })
    if (result.limit) throw new Error('Unexpected lead admission limit')
    return json(result.created)
  } catch (error) { return fail(error) }
}
