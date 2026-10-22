export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withLifecycleOrganizationWrite } from '@/lib/account-lifecycle/organization-fence'
import { LifecycleError } from '@/lib/account-lifecycle/state'
import { getAioContext, hasMinRole, orgSlugFrom } from '@/lib/aio/access'
import { ROLE_HIERARCHY, type AioContext } from '@/lib/aio/types'

type Ctx = { params: Promise<{ id: string }> }
const rank = (role: string) => ROLE_HIERARCHY[role] ?? 0
const EDITABLE_ROLES = ['member', 'manager', 'admin']

async function mutateMember(ctx: AioContext, targetId: string, action: 'update' | 'delete', role?: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    // This read only plans the User set. The helper repeats it after sorted
    // User and org/member locks; any target rebinding restarts the whole plan.
    const discovered = await prisma.aioMember.findFirst({
      where: { id: targetId, organizationId: ctx.organizationId },
      select: { userId: true, status: true, role: true },
    })
    try {
      return await withLifecycleOrganizationWrite(prisma, {
        service: 'aio', organizationId: ctx.organizationId, actorUserId: ctx.userId, access: 'member',
        targetMemberIds: discovered ? [targetId] : [],
        targetUserIds: discovered?.userId ? [discovered.userId] : [], targetEmails: [],
        grantsAuthority: action === 'update' && discovered?.status === 'ACTIVE',
        pendingClaimUserId: null, repairsUnknownTargetRole: false,
      }, async tx => {
        const actor = await tx.aioMember.findFirst({
          where: { id: ctx.memberId, organizationId: ctx.organizationId, userId: ctx.userId, status: 'ACTIVE', role: { in: ['owner', 'admin'] } },
          select: { id: true, role: true },
        })
        if (!actor) return { kind: 'forbidden' as const }
        const target = await tx.aioMember.findFirst({ where: { id: targetId, organizationId: ctx.organizationId } })
        if (!target) return { kind: 'missing' as const }
        if (!discovered || target.userId !== discovered.userId || target.status !== discovered.status || target.role !== discovered.role) throw new LifecycleError('LIFECYCLE_PARTICIPANTS_CHANGED')
        if (target.role === 'owner') return { kind: 'owner' as const }
        if (target.id === actor.id) return { kind: 'self' as const }
        if (!Object.prototype.hasOwnProperty.call(ROLE_HIERARCHY, target.role) || rank(target.role) >= rank(actor.role)) return { kind: 'peer' as const }
        if (action === 'update') {
          if (!role || rank(role) >= rank(actor.role)) return { kind: 'role' as const }
          const member = await tx.aioMember.update({ where: { id: target.id }, data: { role } })
          return { kind: 'updated' as const, member }
        }
        await tx.aioMember.delete({ where: { id: target.id } })
        return { kind: 'deleted' as const }
      })
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && ['P2034', 'LIFECYCLE_PARTICIPANTS_CHANGED', 'LIFECYCLE_TARGET_UNAVAILABLE', 'LIFECYCLE_USER_UNAVAILABLE'].includes(String(error.code)))) throw error
      if (attempt === 3) throw new LifecycleError('LIFECYCLE_PARTICIPANTS_CHANGED')
    }
  }
  throw new Error('メンバーを変更できませんでした')
}

// PATCH /api/aio/members/[id] — 権限変更（admin+）
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const sctx = await getAioContext(orgSlugFrom(req))
  if (!sctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  if (!hasMinRole(sctx.role, 'admin')) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const role = EDITABLE_ROLES.includes(body?.role) ? (body.role as string) : null
  if (!role) return NextResponse.json({ error: '不正な権限です' }, { status: 400 })
  let result
  try { result = await mutateMember(sctx, p.id, 'update', role) }
  catch (error) {
    if (error instanceof LifecycleError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
    throw error
  }
  if (result.kind === 'forbidden') return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  if (result.kind === 'missing') return NextResponse.json({ error: 'メンバーが見つかりません' }, { status: 404 })
  if (result.kind === 'owner') return NextResponse.json({ error: 'オーナーの権限は変更できません' }, { status: 403 })
  if (result.kind === 'self') return NextResponse.json({ error: '自分自身の権限は変更できません' }, { status: 400 })
  if (result.kind === 'peer') return NextResponse.json({ error: '自分と同格以上のメンバーは変更できません' }, { status: 403 })
  if (result.kind === 'role') return NextResponse.json({ error: '自分と同格以上には変更できません' }, { status: 403 })
  if (result.kind !== 'updated') return NextResponse.json({ error: 'メンバーの変更を確認できませんでした' }, { status: 409 })
  return NextResponse.json({ ok: true, member: { id: result.member.id, role: result.member.role } })
}

// DELETE /api/aio/members/[id] — メンバー削除/招待取消（admin+）
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const sctx = await getAioContext(orgSlugFrom(req))
  if (!sctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  if (!hasMinRole(sctx.role, 'admin')) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

  let result
  try { result = await mutateMember(sctx, p.id, 'delete') }
  catch (error) {
    if (error instanceof LifecycleError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
    throw error
  }
  if (result.kind === 'forbidden') return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  if (result.kind === 'missing') return NextResponse.json({ error: 'メンバーが見つかりません' }, { status: 404 })
  if (result.kind === 'owner') return NextResponse.json({ error: 'オーナーは削除できません' }, { status: 403 })
  if (result.kind === 'self') return NextResponse.json({ error: '自分自身は削除できません' }, { status: 400 })
  if (result.kind === 'peer') return NextResponse.json({ error: '自分と同格以上のメンバーは削除できません' }, { status: 403 })
  if (result.kind !== 'deleted') return NextResponse.json({ error: 'メンバーの削除を確認できませんでした' }, { status: 409 })
  return NextResponse.json({ ok: true, memberId: p.id })
}
