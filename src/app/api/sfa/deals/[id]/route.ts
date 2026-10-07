export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'
import { bigIntToNumber } from '@/lib/sfa/format'
import { dealBody, dealVersion, lockDeal, lockDealStage, dealStageChange } from '@/lib/sfa/deal-mutation'
import { lockSfaMutationActor, lockSfaRelation, SfaMutationError } from '@/lib/sfa/mutation-authority'

type Ctx = { params: Promise<{ id: string }> }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
const failure = (error: unknown) => json({ error: error instanceof SfaMutationError ? error.message : '操作結果を確認できませんでした。一覧をご確認ください。', ...(error instanceof SfaMutationError && error.status === 409 ? { code: 'VERSION_CONFLICT' } : {}) }, error instanceof SfaMutationError ? error.status : 500)

export async function GET(req: NextRequest, context: Ctx) {
  const c = await getSfaContext(orgSlugFrom(req))
  if (!c) return json({ error: 'ログインが必要です' }, 401)
  const { id } = await context.params
  try {
    const result = await prisma.$transaction(async tx => {
      await lockSfaMutationActor(tx, c)
      const deal = await lockDeal(tx, c, id, false)
      if (!deal) return { state: 'missing', deal: null, stages: [] }
      const [lineItems, activities, account, stages] = await Promise.all([
        tx.sfaLineItem.findMany({ where: { dealId: deal.id } }),
        tx.sfaActivity.findMany({ where: { organizationId: c.organizationId, dealId: deal.id }, orderBy: { occurredAt: 'desc' }, take: 50 }),
        deal.accountId ? tx.sfaAccount.findFirst({ where: { id: deal.accountId, organizationId: c.organizationId, isActive: true }, select: { id: true, name: true } }) : null,
        tx.sfaStage.findMany({ where: { pipeline: { organizationId: c.organizationId } }, orderBy: { order: 'asc' } }),
      ])
      return { state: 'found', deal: { ...deal, account, lineItems, activities }, stages }
    })
    if (result.state === 'missing' && new URL(req.url).searchParams.get('recovery') !== '1') return json({ error: '見つかりません' }, 404)
    return json(bigIntToNumber(result))
  } catch (error) { return failure(error) }
}

export async function PATCH(req: NextRequest, context: Ctx) {
  const c = await getSfaContext(orgSlugFrom(req))
  if (!c) return json({ error: 'ログインが必要です' }, 401)
  const { id } = await context.params
  try {
    const { body, data } = dealBody(await req.json().catch(() => null))
    const expected = dealVersion(body.expectedUpdatedAt)
    if (data.contactId === null && !expected) throw new SfaMutationError(400, '担当者の紐づけを解除する前に、商談の更新日時を確認してください。')
    const deal = await prisma.$transaction(async tx => {
      await lockSfaMutationActor(tx, c)
      // Shared related-row order: account, stage, deal. Related changes remain locked until commit.
      if (data.accountId) await lockSfaRelation(tx, c, 'sfaAccount', data.accountId)
      const stage = data.stageId ? await lockDealStage(tx, c, data.stageId) : null
      const before = await lockDeal(tx, c, id)
      if (!before) throw new SfaMutationError(404, '商談が見つかりません。')
      if (expected && expected.getTime() !== before.updatedAt.getTime()) throw new SfaMutationError(409, '商談が別の操作で変更されました。一覧を確認してから操作してください。')
      return tx.sfaDeal.update({ where: { id: before.id }, data: { ...data, ...(stage ? dealStageChange(stage, before) : {}), updatedAt: new Date(Math.max(Date.now(), before.updatedAt.getTime() + 1)) } })
    })
    return json({ deal: bigIntToNumber(deal) })
  } catch (error) { return failure(error) }
}

export async function DELETE(req: NextRequest, context: Ctx) {
  const c = await getSfaContext(orgSlugFrom(req))
  if (!c) return json({ error: 'ログインが必要です' }, 401)
  const { id } = await context.params
  try {
    const values = new URL(req.url).searchParams.getAll('expectedUpdatedAt')
    if (values.length > 1) throw new SfaMutationError(400, '更新日時が重複しています。')
    const expected = dealVersion(values[0])
    await prisma.$transaction(async tx => {
      await lockSfaMutationActor(tx, c)
      const before = await lockDeal(tx, c, id)
      if (!before) throw new SfaMutationError(404, '商談が見つかりません。')
      if (expected && expected.getTime() !== before.updatedAt.getTime()) throw new SfaMutationError(409, '商談が別の操作で変更されました。一覧を確認してから操作してください。')
      await tx.sfaDeal.update({ where: { id: before.id }, data: { isActive: false, updatedAt: new Date(Math.max(Date.now(), before.updatedAt.getTime() + 1)) } })
    })
    return json({ ok: true })
  } catch (error) { return failure(error) }
}
