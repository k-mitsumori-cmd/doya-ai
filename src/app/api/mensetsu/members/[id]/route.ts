export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// PATCH  /api/mensetsu/members/[id] — 権限を変更
// DELETE /api/mensetsu/members/[id] — メンバーを外す／招待を取り消す
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMensetsuContext, hasMinRole, orgSlugFrom } from '@/lib/mensetsu/access'
import { ROLE_HIERARCHY, type MensetsuRole } from '@/lib/mensetsu/types'

type Ctx = { params: Promise<{ id: string }> | { id: string } }
const ROLES: MensetsuRole[] = ['admin', 'manager', 'member']

async function load(id: string, organizationId: string) {
  // id だけで他組織のメンバーに到達させない（二重条件）
  return prisma.mensetsuMember.findFirst({
    where: { id, organizationId },
    select: { id: true, role: true, status: true, userId: true },
  })
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const c = await getMensetsuContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  if (!hasMinRole(c.role, 'admin')) {
    return NextResponse.json({ error: '権限を変更する権限がありません' }, { status: 403 })
  }

  const m = await load(p.id, c.organizationId)
  if (!m) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const role = body?.role as MensetsuRole
  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: '指定できない権限です' }, { status: 400 })
  }
  // ⚠️ 自分自身の権限は変えられない（自己降格で組織を管理不能にしないため）
  if (m.userId && m.userId === c.userId) {
    return NextResponse.json({ error: '自分の権限は変更できません' }, { status: 403 })
  }
  // ⚠️ owner には手を出せない。また自分と同格以上のメンバーも変更できない
  if (m.role === 'owner' || ROLE_HIERARCHY[m.role as MensetsuRole] >= ROLE_HIERARCHY[c.role]) {
    return NextResponse.json({ error: 'このメンバーの権限は変更できません' }, { status: 403 })
  }
  if (ROLE_HIERARCHY[role] > ROLE_HIERARCHY[c.role]) {
    return NextResponse.json({ error: '自分より上の権限は付与できません' }, { status: 403 })
  }

  await prisma.mensetsuMember.update({ where: { id: m.id }, data: { role } })
  return NextResponse.json({ ok: true, role })
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const c = await getMensetsuContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  if (!hasMinRole(c.role, 'admin')) {
    return NextResponse.json({ error: 'メンバーを外す権限がありません' }, { status: 403 })
  }

  const m = await load(p.id, c.organizationId)
  if (!m) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  if (m.role === 'owner') {
    return NextResponse.json({ error: 'オーナーは外せません' }, { status: 403 })
  }
  if (m.userId && m.userId === c.userId) {
    return NextResponse.json({ error: '自分自身は外せません' }, { status: 403 })
  }
  if (ROLE_HIERARCHY[m.role as MensetsuRole] >= ROLE_HIERARCHY[c.role]) {
    return NextResponse.json({ error: 'このメンバーは外せません' }, { status: 403 })
  }

  await prisma.mensetsuMember.delete({ where: { id: m.id } })
  return NextResponse.json({ ok: true })
}
