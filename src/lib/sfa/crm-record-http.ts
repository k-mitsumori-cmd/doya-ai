import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, orgSlugFrom } from './access'
import { bigIntToNumber } from './format'
import { lockSfaMutationActor, SfaMutationError } from './mutation-authority'
import { canManageSfaBilling, sfaQuotaResponse, withSfaAdmission } from './limits'
import { createCrmRecord, recoverCrmRecord, mutateCrmRecord, lockCrmRecord, crmRecordId, SfaCrmQuotaError } from './crm-record-mutation'
import type { SfaContext } from './types'

type Kind = 'account' | 'contact'
export const crmJson = (body: unknown, init: ResponseInit = {}) => {
  const headers = new Headers(init.headers)
  headers.set('Cache-Control', 'private, no-store'); headers.set('Vary', 'Cookie')
  return NextResponse.json(bigIntToNumber(body), { ...init, headers })
}
export function crmError(error: unknown) {
  return crmJson({ error: error instanceof SfaMutationError ? error.message : '操作結果を確認できませんでした。一覧をご確認ください。' }, { status: error instanceof SfaMutationError ? error.status : 500 })
}
export async function crmRecovery(req: NextRequest, ctx: SfaContext, kind: Kind, cancel = false) {
  const operations = new URL(req.url).searchParams.getAll('operationId')
  if (operations.length !== 1) throw new SfaMutationError(400, '操作情報を指定してください。')
  const result = await recoverCrmRecord(ctx, kind, operations[0], cancel)
  return crmJson({ state: result.state, [kind]: result.row })
}
export async function crmCreate(req: NextRequest, kind: Kind) {
  try {
    const ctx = await getSfaContext(orgSlugFrom(req))
    if (!ctx) return crmJson({ error: 'ログイン/組織が必要です' }, { status: 401 })
    try {
      const row = await createCrmRecord(ctx, kind, await req.json().catch(() => null))
      return crmJson({ [kind]: row })
    } catch (error) {
      if (!(error instanceof SfaCrmQuotaError)) throw error
      const response = sfaQuotaResponse(error.quota, await canManageSfaBilling(prisma, ctx.organizationId, ctx.userId))
      response.headers.set('Cache-Control', 'private, no-store'); response.headers.set('Vary', 'Cookie')
      return response
    }
  } catch (error) { return crmError(error) }
}
// Cancellation only fences a creation receipt; it never removes a business row.
export async function crmCancel(req: NextRequest, kind: Kind) {
  try {
    const ctx = await getSfaContext(orgSlugFrom(req))
    if (!ctx) return crmJson({ error: 'ログイン/組織が必要です' }, { status: 401 })
    return await crmRecovery(req, ctx, kind, true)
  } catch (error) { return crmError(error) }
}
export async function crmDetail(req: NextRequest, params: Promise<{ id: string }>, kind: Kind, method: 'GET' | 'PATCH' | 'DELETE') {
  try {
    const ctx = await getSfaContext(orgSlugFrom(req))
    if (!ctx) return crmJson({ error: 'ログイン/組織が必要です' }, { status: 401 })
    const id = crmRecordId((await params).id)
    if (method === 'GET') {
      const result = await withSfaAdmission(ctx.organizationId, {}, async tx => {
        await lockSfaMutationActor(tx, ctx)
        return lockCrmRecord(tx, ctx, kind, id, false)
      })
      if (result.limit) throw new Error('Unexpected record read admission limit')
      return crmJson({ state: result.created ? 'found' : 'missing', [kind]: result.created })
    }
    let body: unknown
    if (method === 'DELETE') {
      const versions = new URL(req.url).searchParams.getAll('expectedUpdatedAt')
      if (versions.length !== 1) throw new SfaMutationError(400, '更新日時を確認できません。一覧を更新してください。')
      body = { expectedUpdatedAt: versions[0] }
    } else body = await req.json().catch(() => null)
    const row = await mutateCrmRecord(ctx, kind, id, body, method === 'DELETE')
    return crmJson(method === 'DELETE' ? row : { [kind]: row })
  } catch (error) { return crmError(error) }
}
