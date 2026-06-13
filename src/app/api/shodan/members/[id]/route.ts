export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getShodanContext, hasMinRole, orgSlugFrom } from '@/lib/shodan/access'
import { ROLE_HIERARCHY } from '@/lib/shodan/types'

type Ctx = { params: Promise<{ id: string }> | { id: string } }
const rank = (role: string) => ROLE_HIERARCHY[role] ?? 0
const EDITABLE_ROLES = ['member', 'manager', 'admin']

// PATCH /api/shodan/members/[id] — 権限変更（admin+）
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const sctx = await getShodanContext(orgSlugFrom(req))
  if (!sctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  if (!hasMinRole(sctx.role, 'admin')) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

  // organizationId + id の両方で検索（IDOR防止）
  const target = await prisma.shodanMember.findFirst({ where: { id: p.id, organizationId: sctx.organizationId } })
  if (!target) return NextResponse.json({ error: 'メンバーが見つかりません' }, { status: 404 })
  if (target.role === 'owner') return NextResponse.json({ error: 'オーナーの権限は変更できません' }, { status: 403 })
  // 自分と同格以上のメンバーの権限は変更できない（DELETEと同じ整合性。管理者同士の権限剥奪を防止）
  if (target.id === sctx.memberId) return NextResponse.json({ error: '自分自身の権限は変更できません' }, { status: 400 })
  if (target.status === 'ACTIVE' && rank(target.role) >= rank(sctx.role)) {
    return NextResponse.json({ error: '自分と同格以上のメンバーは変更できません' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const role = EDITABLE_ROLES.includes(body.role) ? (body.role as string) : null
  if (!role) return NextResponse.json({ error: '不正な権限です' }, { status: 400 })
  if (rank(role) >= rank(sctx.role)) return NextResponse.json({ error: '自分と同格以上には変更できません' }, { status: 403 })

  const updated = await prisma.shodanMember.update({ where: { id: target.id }, data: { role } })
  return NextResponse.json({ ok: true, member: { id: updated.id, role: updated.role } })
}

// DELETE /api/shodan/members/[id] — メンバー削除/招待取消（admin+）
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const sctx = await getShodanContext(orgSlugFrom(req))
  if (!sctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  if (!hasMinRole(sctx.role, 'admin')) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

  const target = await prisma.shodanMember.findFirst({ where: { id: p.id, organizationId: sctx.organizationId } })
  if (!target) return NextResponse.json({ error: 'メンバーが見つかりません' }, { status: 404 })
  if (target.role === 'owner') return NextResponse.json({ error: 'オーナーは削除できません' }, { status: 403 })
  if (target.id === sctx.memberId) return NextResponse.json({ error: '自分自身は削除できません' }, { status: 400 })
  if (target.status === 'ACTIVE' && rank(target.role) >= rank(sctx.role)) {
    return NextResponse.json({ error: '自分と同格以上のメンバーは削除できません' }, { status: 403 })
  }

  await prisma.shodanMember.delete({ where: { id: target.id } })
  return NextResponse.json({ ok: true })
}
