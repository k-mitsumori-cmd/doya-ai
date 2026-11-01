export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'
import { crmJson, crmError } from '@/lib/sfa/crm-record-http'
import { listSfaTeams, createSfaTeam, recoverSfaTeam } from '@/lib/sfa/team-management'
import { SfaMutationError } from '@/lib/sfa/mutation-authority'

export async function GET(req: NextRequest) {
  try {
    const ctx = await getSfaContext(orgSlugFrom(req))
    if (!ctx) return crmJson({ error: 'ログイン/組織が必要です' }, { status: 401 })
    const operations = new URL(req.url).searchParams.getAll('operationId')
    if (!operations.length) return crmJson(await listSfaTeams(ctx))
    if (operations.length !== 1) throw new SfaMutationError(400, '操作情報が重複しています。')
    const result = await recoverSfaTeam(ctx, operations[0], false)
    return crmJson({ state: result.state, team: result.row })
  } catch (error) { return crmError(error) }
}
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSfaContext(orgSlugFrom(req))
    if (!ctx) return crmJson({ error: 'ログイン/組織が必要です' }, { status: 401 })
    return crmJson({ team: await createSfaTeam(ctx, await req.json().catch(() => null)) })
  } catch (error) { return teamError(error) }
}
export async function DELETE(req: NextRequest) {
  try {
    const ctx = await getSfaContext(orgSlugFrom(req))
    if (!ctx) return crmJson({ error: 'ログイン/組織が必要です' }, { status: 401 })
    const operations = new URL(req.url).searchParams.getAll('operationId')
    if (operations.length !== 1) throw new SfaMutationError(400, '操作情報を指定してください。')
    const result = await recoverSfaTeam(ctx, operations[0], true)
    return crmJson({ state: result.state, team: result.row })
  } catch (error) { return crmError(error) }
}
function teamError(error: unknown) {
  if ((error as { code?: string })?.code === 'P2002') return crmJson({ error: '同じ名前のチームがあります。別の名前を入力してください。' }, { status: 409 })
  return crmError(error)
}
