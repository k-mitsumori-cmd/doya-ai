export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'
import { crmJson, crmError } from '@/lib/sfa/crm-record-http'
import { readSfaRecordAccess, updateSfaRecordAccess } from '@/lib/sfa/record-access'
import { SfaMutationError } from '@/lib/sfa/mutation-authority'

export async function GET(req: NextRequest) {
  try {
    const ctx = await getSfaContext(orgSlugFrom(req))
    if (!ctx) return crmJson({ error: 'ログイン/組織が必要です' }, { status: 401 })
    const params = new URL(req.url).searchParams
    if (params.getAll('kind').length !== 1 || params.getAll('id').length !== 1) throw new SfaMutationError(400, 'データを指定してください。')
    return crmJson(await readSfaRecordAccess(ctx, params.get('kind'), params.get('id')))
  } catch (error) { return crmError(error) }
}
export async function PATCH(req: NextRequest) {
  try {
    const ctx = await getSfaContext(orgSlugFrom(req))
    if (!ctx) return crmJson({ error: 'ログイン/組織が必要です' }, { status: 401 })
    return crmJson(await updateSfaRecordAccess(ctx, await req.json().catch(() => null)))
  } catch (error) { return crmError(error) }
}
