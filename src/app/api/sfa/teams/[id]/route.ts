export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'
import { crmJson, crmError } from '@/lib/sfa/crm-record-http'
import { updateSfaTeam, deleteSfaTeam, readSfaTeam } from '@/lib/sfa/team-management'
import { SfaMutationError } from '@/lib/sfa/mutation-authority'

type Context = { params: Promise<{ id: string }> }
export async function GET(req: NextRequest, context: Context) {
  try {
    const ctx = await getSfaContext(orgSlugFrom(req))
    if (!ctx) return crmJson({ error: 'ログイン/組織が必要です' }, { status: 401 })
    return crmJson(await readSfaTeam(ctx, (await context.params).id))
  } catch (error) { return crmError(error) }
}
export async function PATCH(req: NextRequest, context: Context) {
  try {
    const ctx = await getSfaContext(orgSlugFrom(req))
    if (!ctx) return crmJson({ error: 'ログイン/組織が必要です' }, { status: 401 })
    return crmJson({ team: await updateSfaTeam(ctx, (await context.params).id, await req.json().catch(() => null)) })
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') return crmJson({ error: '同じ名前のチームがあります。別の名前を入力してください。' }, { status: 409 })
    return crmError(error)
  }
}
export async function DELETE(req: NextRequest, context: Context) {
  try {
    const ctx = await getSfaContext(orgSlugFrom(req))
    if (!ctx) return crmJson({ error: 'ログイン/組織が必要です' }, { status: 401 })
    const versions = new URL(req.url).searchParams.getAll('expectedUpdatedAt')
    if (versions.length !== 1) throw new SfaMutationError(400, '更新日時を確認できません。')
    return crmJson(await deleteSfaTeam(ctx, (await context.params).id, versions[0]))
  } catch (error) { return crmError(error) }
}
