export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getHrContext, hasMinRole } from '@/lib/hr/access'
import { HrMemberRole, type HrContext } from '@/lib/hr/types'
import { ROLE_HIERARCHY } from '@/lib/hr/constants'

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

async function mutateMember(ctx: HrContext, id: string, action: Action) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const org = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM hr_organizations WHERE id = ${ctx.organizationId} FOR UPDATE`
        if (!org.length) return { kind: 'missing' as const }
        await tx.$queryRaw`SELECT id FROM hr_organization_members WHERE "organizationId" = ${ctx.organizationId}
          AND id IN (${ctx.memberId}, ${id}) ORDER BY id FOR UPDATE`
        const actor = await tx.hrOrganizationMember.findFirst({
          where: { id: ctx.memberId, organizationId: ctx.organizationId, userId: ctx.userId, status: 'ACTIVE', role: { in: [HrMemberRole.OWNER, HrMemberRole.ADMIN] } },
          select: { id: true, role: true },
        })
        if (!actor) return { kind: 'forbidden' as const }
        const target = await tx.hrOrganizationMember.findFirst({ where: { id, organizationId: ctx.organizationId } })
        if (!target) return { kind: 'missing' as const }
        if (target.role === HrMemberRole.OWNER) return { kind: 'owner' as const }
        if (target.id === actor.id) return { kind: 'self' as const }
        if (!Object.prototype.hasOwnProperty.call(ROLE_HIERARCHY, target.role) || rank(target.role) >= rank(actor.role)) {
          return { kind: 'peer' as const }
        }
        if (action.kind === 'delete') {
          const deleted = await tx.hrOrganizationMember.deleteMany({
            where: { id, organizationId: ctx.organizationId, role: target.role, status: target.status },
          })
          return { kind: deleted.count === 1 ? 'deleted' as const : 'changed' as const }
        }
        if (action.data.role && rank(action.data.role) >= rank(actor.role)) return { kind: 'role' as const }
        if (action.data.employeeId) {
          const employee = await tx.hrEmployee.findFirst({
            where: { id: action.data.employeeId, organizationId: ctx.organizationId }, select: { id: true },
          })
          if (!employee) return { kind: 'employee' as const }
          const linked = await tx.hrOrganizationMember.findFirst({
            where: { employeeId: action.data.employeeId, NOT: { id } }, select: { id: true },
          })
          if (linked) return { kind: 'occupied' as const }
        }
        const updated = await tx.hrOrganizationMember.updateMany({
          where: { id, organizationId: ctx.organizationId, role: target.role, status: target.status },
          data: action.data,
        })
        if (updated.count !== 1) return { kind: 'changed' as const }
        const member = await tx.hrOrganizationMember.findUnique({ where: { id } })
        return { kind: 'updated' as const, member }
      }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 30000 })
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2034') throw error
      if (attempt === 2) return { kind: 'changed' as const }
    }
  }
  return { kind: 'changed' as const }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const hrCtx = await getHrContext()
    if (!hrCtx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasMinRole(hrCtx.role, HrMemberRole.ADMIN)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { id } = await ctx.params
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: '入力内容が正しくありません' }, { status: 400 })
    }
    const { role, status, employeeId } = body
    const data: PatchData = {}
    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) return NextResponse.json({ error: '権限の指定が正しくありません' }, { status: 400 })
      data.role = role
    }
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) return NextResponse.json({ error: '状態の指定が正しくありません' }, { status: 400 })
      data.status = status
    }
    if (employeeId !== undefined) {
      if (employeeId !== null && (typeof employeeId !== 'string' || !employeeId)) {
        return NextResponse.json({ error: '従業員の指定が正しくありません' }, { status: 400 })
      }
      data.employeeId = employeeId
    }
    if (Object.keys(data).length === 0) return NextResponse.json({ error: '変更する項目がありません' }, { status: 400 })

    const result = await mutateMember(hrCtx, id, { kind: 'patch', data })
    if (result.kind === 'forbidden') return NextResponse.json({ error: '管理権限が変わりました。再読み込みしてください' }, { status: 403 })
    if (result.kind === 'missing') return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    if (result.kind === 'owner') return NextResponse.json({ error: 'オーナーの変更には譲渡機能を使用してください' }, { status: 403 })
    if (result.kind === 'self') return NextResponse.json({ error: 'ご自身の権限・状態は変更できません' }, { status: 400 })
    if (result.kind === 'peer') return NextResponse.json({ error: '同格以上のメンバーは変更できません' }, { status: 403 })
    if (result.kind === 'role') return NextResponse.json({ error: 'ご自身と同格以上の権限は付与できません' }, { status: 403 })
    if (result.kind === 'employee') return NextResponse.json({ error: '同じ組織の従業員を指定してください' }, { status: 400 })
    if (result.kind === 'occupied') return NextResponse.json({ error: 'この従業員は別のメンバーに紐付いています' }, { status: 409 })
    if (result.kind === 'changed') return NextResponse.json({ error: 'メンバーの状態が変わりました。再読み込みしてください' }, { status: 409 })
    return NextResponse.json({ success: true, member: result.member })
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: 'この従業員は別のメンバーに紐付いています' }, { status: 409 })
    console.error('[hr/organization/members PATCH]')
    return NextResponse.json({ error: 'メンバー情報を更新できませんでした' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const hrCtx = await getHrContext()
    if (!hrCtx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasMinRole(hrCtx.role, HrMemberRole.ADMIN)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { id } = await ctx.params
    const result = await mutateMember(hrCtx, id, { kind: 'delete' })
    if (result.kind === 'forbidden') return NextResponse.json({ error: '管理権限が変わりました。再読み込みしてください' }, { status: 403 })
    if (result.kind === 'missing') return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    if (result.kind === 'owner') return NextResponse.json({ error: 'Cannot remove owner' }, { status: 403 })
    if (result.kind === 'self') return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })
    if (result.kind === 'peer') return NextResponse.json({ error: '同格以上のメンバーは削除できません' }, { status: 403 })
    if (result.kind === 'changed') return NextResponse.json({ error: 'メンバーの状態が変わりました。再読み込みしてください' }, { status: 409 })
    return NextResponse.json({ success: true })
  } catch {
    console.error('[hr/organization/members/[id]] unexpected error')
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
  }
}
