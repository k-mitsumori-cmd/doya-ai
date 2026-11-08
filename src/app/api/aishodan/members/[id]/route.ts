import { privateApiJson } from '@/lib/private-api-response'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// PATCH  /api/aishodan/members/[id] — 権限を変更
// DELETE /api/aishodan/members/[id] — メンバーを外す／招待を取り消す
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAishodanContext, hasMinRole, orgSlugFrom } from '@/lib/aishodan/access'
import { ROLE_HIERARCHY, type AishodanRole } from '@/lib/aishodan/types'
import { lowerToolRole } from '@/lib/company-roles/tool-roles'
import { ceilToolRole } from '@/lib/company-roles/access.server'

type Ctx = { params: Promise<{ id: string }> }
const ROLES: AishodanRole[] = ['admin', 'manager', 'member']

type MemberContext = NonNullable<Awaited<ReturnType<typeof getAishodanContext>>>

async function mutateMember(c: MemberContext, targetId: string, action: 'update' | 'delete', role?: AishodanRole) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        // Pin current company authority before locking domain membership rows.
        const companyCeiling = await ceilToolRole({ tool: 'aishodan', userId: c.userId, organizationId: c.organizationId, toolRole: 'owner' }, tx)
        if (!companyCeiling) return { kind: 'forbidden' as const }
        await tx.$queryRaw`SELECT id FROM aishodan_members WHERE "organizationId" = ${c.organizationId}
          AND ("userId" = ${c.userId} OR id = ${targetId}) ORDER BY id FOR UPDATE`
        const actor = await tx.aishodanMember.findFirst({
          where: { organizationId: c.organizationId, userId: c.userId, status: 'ACTIVE', role: { in: ['owner', 'admin'] } },
          select: { id: true, role: true },
        })
        if (!actor) return { kind: 'forbidden' as const }
        // 取引内で再取得した会社の役割の上限を当てる
        const actorRole = lowerToolRole('aishodan', actor.role, companyCeiling)
        if (!actorRole || !hasMinRole(actorRole, 'admin')) return { kind: 'forbidden' as const }
        const target = await tx.aishodanMember.findFirst({ where: { id: targetId, organizationId: c.organizationId } })
        if (!target) return { kind: 'missing' as const }
        if (target.id === actor.id || target.userId === c.userId) return { kind: 'self' as const }
        const targetRank = ROLE_HIERARCHY[target.role as AishodanRole]
        if (target.role === 'owner' || targetRank === undefined || targetRank >= ROLE_HIERARCHY[actorRole as AishodanRole]) {
          return { kind: 'peer' as const }
        }
        if (action === 'update') {
          if (!role || ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[actorRole as AishodanRole]) return { kind: 'role' as const }
          await tx.aishodanMember.update({ where: { id: target.id }, data: { role } })
          return { kind: 'updated' as const }
        }
        await tx.aishodanMember.delete({ where: { id: target.id } })
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
  const c = await getAishodanContext(orgSlugFrom(req))
  if (!c) return privateApiJson({ error: '組織が見つかりません' }, { status: 401 })
  if (!hasMinRole(c.role, 'admin')) {
    return privateApiJson({ error: '権限を変更する権限がありません' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const role = body?.role as AishodanRole
  if (!ROLES.includes(role)) {
    return privateApiJson({ error: '指定できない権限です' }, { status: 400 })
  }
  const result = await mutateMember(c, p.id, 'update', role)
  if (result.kind === 'forbidden' || result.kind === 'peer') return privateApiJson({ error: 'このメンバーの権限は変更できません' }, { status: 403 })
  if (result.kind === 'missing') return privateApiJson({ error: '見つかりません' }, { status: 404 })
  if (result.kind === 'self') return privateApiJson({ error: '自分の権限は変更できません' }, { status: 403 })
  if (result.kind === 'role') return privateApiJson({ error: '自分と同じか上の権限は付与できません' }, { status: 403 })
  return privateApiJson({ ok: true, memberId: p.id, role })
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const c = await getAishodanContext(orgSlugFrom(req))
  if (!c) return privateApiJson({ error: '組織が見つかりません' }, { status: 401 })
  if (!hasMinRole(c.role, 'admin')) {
    return privateApiJson({ error: 'メンバーを外す権限がありません' }, { status: 403 })
  }

  const result = await mutateMember(c, p.id, 'delete')
  if (result.kind === 'forbidden' || result.kind === 'peer') return privateApiJson({ error: 'このメンバーは外せません' }, { status: 403 })
  if (result.kind === 'missing') return privateApiJson({ error: '見つかりません' }, { status: 404 })
  if (result.kind === 'self') return privateApiJson({ error: '自分自身は外せません' }, { status: 403 })
  return privateApiJson({ ok: true, memberId: p.id })
}
