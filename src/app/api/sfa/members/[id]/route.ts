export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, hasMinRole, orgSlugFrom } from '@/lib/sfa/access'
import { ROLE_HIERARCHY } from '@/lib/sfa/types'

type Ctx = { params: Promise<{ id: string }> | { id: string } }
const ASSIGNABLE_ROLES = ['member', 'manager', 'admin']
const rank = (role: string) => ROLE_HIERARCHY[role] ?? 0

/** 対象メンバーを取得し、同一組織所有を確認（admin+ のみ操作可。自分より下位のメンバーのみ操作可） */
async function loadTarget(req: NextRequest, id: string) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return { error: NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 }) }
  if (!hasMinRole(ctx.role, 'admin')) return { error: NextResponse.json({ error: '権限がありません' }, { status: 403 }) }
  const target = await prisma.sfaMember.findUnique({ where: { id } })
  if (!target || target.organizationId !== ctx.organizationId) {
    return { error: NextResponse.json({ error: 'メンバーが見つかりません' }, { status: 404 }) }
  }
  if (target.id === ctx.memberId) {
    return { error: NextResponse.json({ error: '自分自身は操作できません' }, { status: 400 }) }
  }
  // 自分と同格以上（owner含む）のメンバーは操作不可 → 横方向の権限拡大を防止
  if (rank(target.role) >= rank(ctx.role)) {
    return { error: NextResponse.json({ error: '自分と同格以上のメンバーは操作できません' }, { status: 403 }) }
  }
  return { ctx, target }
}

// PATCH /api/sfa/members/[id] — 権限（ロール）変更
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const r = await loadTarget(req, p.id)
  if ('error' in r) return r.error

  const body = await req.json().catch(() => ({}))
  const role = body.role as string
  if (!ASSIGNABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: '指定できない権限です' }, { status: 400 })
  }
  // 自分と同格以上の権限は付与できない（adminがadminを量産するのを防止。ownerだけがadminを任命可能）
  if (rank(role) >= rank(r.ctx.role)) {
    return NextResponse.json({ error: '自分と同格以上の権限は付与できません' }, { status: 403 })
  }
  const updated = await prisma.sfaMember.update({
    where: { id: r.target.id },
    data: { role },
    select: { id: true, role: true },
  })
  return NextResponse.json({ ok: true, member: updated })
}

// DELETE /api/sfa/members/[id] — メンバー削除 / 招待取消
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const r = await loadTarget(req, p.id)
  if ('error' in r) return r.error

  await prisma.sfaMember.delete({ where: { id: r.target.id } })
  return NextResponse.json({ ok: true })
}
