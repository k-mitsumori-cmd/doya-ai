import { privateApiJson } from '@/lib/private-api-response'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { getHrContext, hasMinRole } from '@/lib/hr/access'
import { HrMemberRole, type HrContext } from '@/lib/hr/types'
import { ROLE_HIERARCHY } from '@/lib/hr/constants'
import { lowerToolRole } from '@/lib/company-roles/tool-roles'
import { ceilToolRole } from '@/lib/company-roles/access.server'
import { withToolSeatAdmissionInTransaction, pinToolSeatPrincipals, ToolSeatAdmissionError, toolSeatAdmissionFailure } from '@/lib/pricing-v2/tool-seat-admission.server'
import { resolveToolUnionScope, toolUnionScopeIdentity } from '@/lib/pricing-v2/tool-seat-union-scope.server'
import { withSeatRevocationInTransaction } from '@/lib/pricing-v2/seat-operation'
import { getOrgPlan, getOrgPlanLimits } from '@/lib/hr/billing'

type Ctx = { params: Promise<{ id: string }> }

const VALID_ROLES: string[] = [
  HrMemberRole.ADMIN,
  HrMemberRole.MANAGER,
  HrMemberRole.MEMBER,
]
const VALID_STATUSES: string[] = ['ACTIVE', 'INVITED', 'SUSPENDED']

type PatchData = { role?: HrMemberRole; status?: string; employeeId?: string | null }
type Action = { kind: 'patch'; data: PatchData } | { kind: 'delete' }
const rank = (role: string) => ROLE_HIERARCHY[role] ?? 0

type DenialKind = 'missing' | 'forbidden' | 'owner' | 'self' | 'peer' | 'role' | 'employee' | 'occupied'
class MemberMutationDenied extends Error { constructor(readonly kind: DenialKind) { super(kind) } }
class MemberMutationLimit extends Error { constructor(readonly limit: number) { super('HR_ORG_MEMBER_LIMIT') } }
function deny(kind: DenialKind): never { throw new MemberMutationDenied(kind) }
const scopeInput = (ctx: HrContext) => ({ tool: 'hr' as const, organizationId: ctx.organizationId })

async function mutateMember(ctx: HrContext, id: string, action: Action) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      // This is a lock hint only. Current actor, recipient, status and role are
      // re-read under the company fence/User locks and domain row locks below.
      const hint = await prisma.hrOrganizationMember.findFirst({ where: { id, organizationId: ctx.organizationId } })
      const increasing = !!hint && action.kind === 'patch' && action.data.status === 'ACTIVE' && hint.status !== 'ACTIVE'
      return await prisma.$transaction(async tx => {
        const authorize = async (currentTx: Prisma.TransactionClient) => {
          const ceiling = await ceilToolRole({ ...scopeInput(ctx), userId: ctx.userId, toolRole: HrMemberRole.OWNER }, currentTx)
          const org = await currentTx.$queryRaw<{ id: string }[]>`SELECT id FROM hr_organizations WHERE id = ${ctx.organizationId} FOR UPDATE`
          if (!org.length) deny('missing')
          await currentTx.$queryRaw`SELECT id FROM hr_organization_members WHERE "organizationId" = ${ctx.organizationId} AND id IN (${ctx.memberId}, ${id}) ORDER BY id FOR UPDATE`
          const actor = await currentTx.hrOrganizationMember.findFirst({ where: { id: ctx.memberId, organizationId: ctx.organizationId, userId: ctx.userId, status: 'ACTIVE', role: { in: [HrMemberRole.OWNER, HrMemberRole.ADMIN] } }, select: { id: true, role: true } })
          if (!actor || !ceiling) deny('forbidden')
          const limited = lowerToolRole('hr', actor.role, ceiling)
          const actorRole = limited ? lowerToolRole('hr', limited, ctx.role) : null
          if (actorRole !== HrMemberRole.OWNER && actorRole !== HrMemberRole.ADMIN) deny('forbidden')
          const target = await currentTx.hrOrganizationMember.findFirst({ where: { id, organizationId: ctx.organizationId } })
          if (!target) deny('missing')
          if (!hint || hint.userId !== target.userId || hint.status !== target.status || hint.role !== target.role) throw new ToolSeatAdmissionError(409, 'SEAT_CONTEXT_CHANGED', 'retry')
          if (target.role === HrMemberRole.OWNER) deny('owner')
          if (target.id === actor.id) deny('self')
          if (!Object.prototype.hasOwnProperty.call(ROLE_HIERARCHY, target.role) || rank(target.role) >= rank(actorRole)) deny('peer')
          if (action.kind === 'patch') {
            if (action.data.role && rank(action.data.role) >= rank(actorRole)) deny('role')
            if (action.data.employeeId) {
              const employee = await currentTx.hrEmployee.findFirst({ where: { id: action.data.employeeId, organizationId: ctx.organizationId }, select: { id: true } })
              if (!employee) deny('employee')
              const linked = await currentTx.hrOrganizationMember.findFirst({ where: { employeeId: action.data.employeeId, NOT: { id } }, select: { id: true } })
              if (linked) deny('occupied')
            }
          }
          return { role: action.kind === 'patch' ? action.data.role ?? target.role : target.role, value: target }
        }
        type Domain = Awaited<ReturnType<typeof authorize>>['value']
        const apply = async (currentTx: Prisma.TransactionClient, target: Domain) => {
          if (action.kind === 'delete') {
            const deleted = await currentTx.hrOrganizationMember.deleteMany({ where: { id, organizationId: ctx.organizationId, userId: target.userId, role: target.role, status: target.status } })
            return { kind: deleted.count === 1 ? 'deleted' as const : 'changed' as const }
          }
          if (increasing) {
            const plan = await getOrgPlan(ctx.organizationId, currentTx), limit = getOrgPlanLimits(plan).maxMembers
            if (process.env.DOYA_DISABLE_LIMITS !== '1' && limit >= 0 && await currentTx.hrOrganizationMember.count({ where: { organizationId: ctx.organizationId, status: 'ACTIVE' } }) >= limit) throw new MemberMutationLimit(limit)
          }
          const updated = await currentTx.hrOrganizationMember.updateMany({ where: { id, organizationId: ctx.organizationId, userId: target.userId, role: target.role, status: target.status }, data: action.data })
          if (updated.count !== 1) return { kind: 'changed' as const }
          const member = await currentTx.hrOrganizationMember.findUnique({ where: { id } })
          return { kind: 'updated' as const, member }
        }
        if (increasing) return withToolSeatAdmissionInTransaction({ ...scopeInput(ctx), actorUserId: ctx.userId, additionalUserIds: hint ? [hint.userId] : [] }, tx, authorize, apply)
        const initial = await resolveToolUnionScope(scopeInput(ctx), tx)
        const work = async () => {
          if (initial.enabled && 'scope' in initial) {
            await pinToolSeatPrincipals(tx, initial.scope, ctx.userId, hint ? [hint.userId] : [])
            if (toolUnionScopeIdentity(await resolveToolUnionScope(scopeInput(ctx), tx)) !== toolUnionScopeIdentity(initial)) throw new ToolSeatAdmissionError(409, 'SEAT_CONTEXT_CHANGED', 'retry')
          }
          const domain = await authorize(tx), result = await apply(tx, domain.value)
          if (initial.enabled && 'scope' in initial && toolUnionScopeIdentity(await resolveToolUnionScope(scopeInput(ctx), tx)) !== toolUnionScopeIdentity(initial)) throw new ToolSeatAdmissionError(409, 'SEAT_CONTEXT_CHANGED', 'retry')
          return result
        }
        // Removal, suspension and non-increasing metadata changes remain possible
        // during pending/malformed financial work; no purchase or network occurs.
        return initial.enabled && 'scope' in initial ? withSeatRevocationInTransaction(initial.scope.fenceKey, tx, work) : work()
      }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 30000 })
    } catch (error) {
      if (error instanceof MemberMutationDenied) return { kind: error.kind }
      const sql = error as { code?: string; meta?: { code?: string } }
      const retry = sql?.code === 'P2034' || sql?.code === 'P2010' && ['40001', '40P01'].includes(sql?.meta?.code ?? '') || error instanceof ToolSeatAdmissionError && error.code === 'SEAT_CONTEXT_CHANGED'
      if (!retry) throw error
      if (attempt === 4) return { kind: 'changed' as const }
    }
  }
  return { kind: 'changed' as const }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const hrCtx = await getHrContext()
    if (!hrCtx) return privateApiJson({ error: 'ログイン状態か所属する組織を確かめて、もう一度お試しください。' }, { status: 401 })
    if (!hasMinRole(hrCtx.role, HrMemberRole.ADMIN)) return privateApiJson({ error: 'この操作に必要な権限がありません。組織の管理者にご相談ください。' }, { status: 403 })
    const { id } = await ctx.params
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return privateApiJson({ error: '入力内容が正しくありません' }, { status: 400 })
    }
    const { role, status, employeeId } = body
    const data: PatchData = {}
    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) return privateApiJson({ error: '権限の指定が正しくありません' }, { status: 400 })
      data.role = role
    }
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) return privateApiJson({ error: '状態の指定が正しくありません' }, { status: 400 })
      data.status = status
    }
    if (employeeId !== undefined) {
      if (employeeId !== null && (typeof employeeId !== 'string' || !employeeId)) {
        return privateApiJson({ error: '従業員の指定が正しくありません' }, { status: 400 })
      }
      data.employeeId = employeeId
    }
    if (Object.keys(data).length === 0) return privateApiJson({ error: '変更する項目がありません' }, { status: 400 })

    const result = await mutateMember(hrCtx, id, { kind: 'patch', data })
    if (result.kind === 'forbidden') return privateApiJson({ error: '管理権限が変わりました。再読み込みしてください' }, { status: 403 })
    if (result.kind === 'missing') return privateApiJson({ error: 'このメンバーは見つかりませんでした。一覧から選び直してください。' }, { status: 404 })
    if (result.kind === 'owner') return privateApiJson({ error: 'オーナーの変更には譲渡機能を使用してください' }, { status: 403 })
    if (result.kind === 'self') return privateApiJson({ error: 'ご自身の権限・状態は変更できません' }, { status: 400 })
    if (result.kind === 'peer') return privateApiJson({ error: '同格以上のメンバーは変更できません' }, { status: 403 })
    if (result.kind === 'role') return privateApiJson({ error: 'ご自身と同格以上の権限は付与できません' }, { status: 403 })
    if (result.kind === 'employee') return privateApiJson({ error: '同じ組織の従業員を指定してください' }, { status: 400 })
    if (result.kind === 'occupied') return privateApiJson({ error: 'この従業員は別のメンバーに紐付いています' }, { status: 409 })
    if (result.kind === 'changed') return privateApiJson({ error: 'メンバーの状態が変わりました。再読み込みしてください' }, { status: 409 })
    if (!('member' in result)) return privateApiJson({ error: 'メンバーの状態が変わりました。再読み込みしてください' }, { status: 409 })
    return privateApiJson({ success: true, member: result.member })
  } catch (e: any) {
    const seatFailure = toolSeatAdmissionFailure(e)
    if (seatFailure) return privateApiJson(seatFailure.body, { status: seatFailure.status })
    if (e instanceof MemberMutationLimit) return privateApiJson({ error: 'メンバー数の上限に達しています。組織の管理者にプラン変更を依頼してください。', code: 'HR_ORG_MEMBER_LIMIT' }, { status: 403 })
    if (e?.code === 'P2002') return privateApiJson({ error: 'この従業員は別のメンバーに紐付いています' }, { status: 409 })
    console.error('[hr/organization/members PATCH]')
    return privateApiJson({ error: 'メンバー情報を更新できませんでした' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const hrCtx = await getHrContext()
    if (!hrCtx) return privateApiJson({ error: 'ログイン状態か所属する組織を確かめて、もう一度お試しください。' }, { status: 401 })
    if (!hasMinRole(hrCtx.role, HrMemberRole.ADMIN)) return privateApiJson({ error: 'この操作に必要な権限がありません。組織の管理者にご相談ください。' }, { status: 403 })
    const { id } = await ctx.params
    const result = await mutateMember(hrCtx, id, { kind: 'delete' })
    if (result.kind === 'forbidden') return privateApiJson({ error: '管理権限が変わりました。再読み込みしてください' }, { status: 403 })
    if (result.kind === 'missing') return privateApiJson({ error: 'このメンバーは見つかりませんでした。一覧から選び直してください。' }, { status: 404 })
    if (result.kind === 'owner') return privateApiJson({ error: 'オーナーは組織から外せません。先にオーナーを別の人に譲ってください。' }, { status: 403 })
    if (result.kind === 'self') return privateApiJson({ error: 'ご自身を組織から外すことはできません。別の管理者に依頼してください。' }, { status: 400 })
    if (result.kind === 'peer') return privateApiJson({ error: '同格以上のメンバーは削除できません' }, { status: 403 })
    if (result.kind === 'changed') return privateApiJson({ error: 'メンバーの状態が変わりました。再読み込みしてください' }, { status: 409 })
    return privateApiJson({ success: true })
  } catch (e) {
    const seatFailure = toolSeatAdmissionFailure(e)
    if (seatFailure) return privateApiJson(seatFailure.body, { status: seatFailure.status })
    console.error('[hr/organization/members/[id]] unexpected error')
    return privateApiJson({ error: 'メンバーを外せませんでした。時間をおいて、もう一度お試しください。' }, { status: 500 })
  }
}
