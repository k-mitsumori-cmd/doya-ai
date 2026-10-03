export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// PATCH  /api/mensetsu/members/[id] — 権限を変更
// DELETE /api/mensetsu/members/[id] — メンバーを外す／招待を取り消す
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMensetsuContext, hasMinRole, orgSlugFrom } from '@/lib/mensetsu/access'
import { ROLE_HIERARCHY, type MensetsuRole } from '@/lib/mensetsu/types'

type Ctx = { params: Promise<{ id: string }> }
const ROLES: MensetsuRole[] = ['admin', 'manager', 'member']

type MemberContext = NonNullable<Awaited<ReturnType<typeof getMensetsuContext>>>

async function mutateMember(c: MemberContext, targetId: string, action: 'update' | 'delete', role?: MensetsuRole) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM mensetsu_members WHERE "organizationId" = ${c.organizationId}
          AND ("userId" = ${c.userId} OR id = ${targetId}) ORDER BY id FOR UPDATE`
        const actor = await tx.mensetsuMember.findFirst({
          where: { organizationId: c.organizationId, userId: c.userId, status: 'ACTIVE', role: { in: ['owner', 'admin'] } },
          select: { id: true, role: true },
        })
        if (!actor) return { kind: 'forbidden' as const }
        const target = await tx.mensetsuMember.findFirst({ where: { id: targetId, organizationId: c.organizationId } })
        if (!target) return { kind: 'missing' as const }
        if (target.id === actor.id || target.userId === c.userId) return { kind: 'self' as const }
        const targetRank = ROLE_HIERARCHY[target.role as MensetsuRole]
        if (target.role === 'owner' || targetRank === undefined || targetRank >= ROLE_HIERARCHY[actor.role as MensetsuRole]) {
          return { kind: 'peer' as const }
        }
        if (action === 'update') {
          if (!role || ROLE_HIERARCHY[role] > ROLE_HIERARCHY[actor.role as MensetsuRole]) return { kind: 'role' as const }
          await tx.mensetsuMember.update({ where: { id: target.id }, data: { role } })
          return { kind: 'updated' as const }
        }
        await tx.mensetsuMember.delete({ where: { id: target.id } })
        return { kind: 'deleted' as const }
      }, { isolationLevel: 'Serializable' })
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2034')) throw error
      if (attempt === 2) throw new Error('メンバー情報が同時に変更されました。再読み込みしてお試しください')
    }
  }
  throw new Error('メンバーを変更できませんでした')
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const c = await getMensetsuContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  if (!hasMinRole(c.role, 'admin')) {
    return NextResponse.json({ error: '権限を変更する権限がありません' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const role = body?.role as MensetsuRole
  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: '指定できない権限です' }, { status: 400 })
  }
  const result = await mutateMember(c, p.id, 'update', role)
  if (result.kind === 'forbidden' || result.kind === 'peer') return NextResponse.json({ error: 'このメンバーの権限は変更できません' }, { status: 403 })
  if (result.kind === 'missing') return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  if (result.kind === 'self') return NextResponse.json({ error: '自分の権限は変更できません' }, { status: 403 })
  if (result.kind === 'role') return NextResponse.json({ error: '自分より上の権限は付与できません' }, { status: 403 })
  return NextResponse.json({ ok: true, role })
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const c = await getMensetsuContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  if (!hasMinRole(c.role, 'admin')) {
    return NextResponse.json({ error: 'メンバーを外す権限がありません' }, { status: 403 })
  }

  const result = await mutateMember(c, p.id, 'delete')
  if (result.kind === 'forbidden' || result.kind === 'peer') return NextResponse.json({ error: 'このメンバーは外せません' }, { status: 403 })
  if (result.kind === 'missing') return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  if (result.kind === 'self') return NextResponse.json({ error: '自分自身は外せません' }, { status: 403 })
  return NextResponse.json({ ok: true })
}
