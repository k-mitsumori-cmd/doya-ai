// ============================================
// ドヤ収入管理: 認証・組織スコープ（全APIの入口）
// ============================================
// sfa/access.ts と同じ考え方。membership を userId で引くので、他人の組織は決して解決されない。
// ⚠️ [id] 系は必ず findFirst({ where: { id, organizationId } }) の二重条件で引く（scope.test.ts で検査）。
import crypto from 'crypto'
import { getServerSession } from 'next-auth'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

import { ROLE_HIERARCHY, hasMinRole, type IncomeRole } from './roles'
import { ceilToolRole } from '@/lib/company-roles/access.server'
export { ROLE_HIERARCHY, hasMinRole, type IncomeRole }
const VALID_ROLES = Object.keys(ROLE_HIERARCHY)

export type IncomeContext = {
  userId: string
  organizationId: string
  organizationSlug: string
  organizationName: string
  role: IncomeRole
  memberId: string
}

/** ?org= 優先、無ければヘッダ x-income-org（encodeURIComponent 済み） */
export function orgSlugFrom(req: NextRequest): string | undefined {
  try {
    const q = new URL(req.url).searchParams.get('org')?.trim()
    if (q) return q
  } catch {
    /* noop */
  }
  const h = req.headers.get('x-income-org')
  if (!h) return undefined
  try {
    return decodeURIComponent(h).trim() || undefined
  } catch {
    return h.trim() || undefined
  }
}

async function resolveUser(): Promise<{ id: string; name: string | null } | undefined> {
  const session = await getServerSession(authOptions)
  let id = (session?.user as { id?: string } | undefined)?.id
  if (!id && session?.user?.email) {
    const u = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
    id = u?.id
  }
  return id ? { id, name: session?.user?.name ?? null } : undefined
}

/** 初回アクセスで自分の組織を作る（設計書 §12 Q2a）。同時アクセスでも 1 つだけ */
async function createOwnOrganization(userId: string, userName: string | null) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
    const existing = await tx.incomeMember.findFirst({
      where: { userId, status: 'ACTIVE', role: { in: VALID_ROLES } },
      include: { organization: true },
      orderBy: { createdAt: 'desc' },
    })
    if (existing) return existing
    // 無効化された所属がある人には、勝手に新しい組織を作らない
    if (await tx.incomeMember.findFirst({ where: { userId }, select: { id: true } })) return null
    const org = await tx.incomeOrganization.create({
      data: { name: userName ? `${userName}の会社` : 'マイカンパニー', slug: `inc-${crypto.randomBytes(8).toString('hex')}` },
    })
    return tx.incomeMember.create({
      data: { organizationId: org.id, userId, role: 'owner', status: 'ACTIVE' },
      include: { organization: true },
    })
  })
}

export async function getIncomeContext(req?: NextRequest): Promise<IncomeContext | null> {
  const user = await resolveUser()
  if (!user) return null
  const slug = req ? orgSlugFrom(req) : undefined
  let membership = slug
    ? await prisma.incomeMember.findFirst({
        where: { userId: user.id, status: 'ACTIVE', role: { in: VALID_ROLES }, organization: { slug } },
        include: { organization: true },
      })
    : await prisma.incomeMember.findFirst({
        where: { userId: user.id, status: 'ACTIVE', role: { in: VALID_ROLES } },
        include: { organization: true },
        orderBy: { createdAt: 'desc' },
      })
  // 明示された組織で認可できないとき、別の組織に切り替えない
  if (slug && !membership) return null
  if (!membership) membership = await createOwnOrganization(user.id, user.name)
  if (!membership || !hasMinRole(membership.role, 'member')) return null
  // 会社の役割の旗の内側では、会社の役割の上限を当てる（ROLES-2026-10-26.md §4）
  const role = await ceilToolRole({ tool: 'income', userId: user.id, organizationId: membership.organizationId, toolRole: membership.role })
  if (!role) return null
  return {
    userId: user.id,
    organizationId: membership.organizationId,
    organizationSlug: membership.organization.slug,
    organizationName: membership.organization.name,
    role: role as IncomeRole,
    memberId: membership.id,
  }
}

export function unauthorized() {
  return NextResponse.json({ error: 'ログインしてください' }, { status: 401 })
}

export function forbidden(message = 'この操作の権限がありません') {
  return NextResponse.json({ error: message }, { status: 403 })
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function notFound(message = '見つかりません') {
  return NextResponse.json({ error: message }, { status: 404 })
}

/** 業務エラー（入力・状態の不整合）。API で 400 として返す */
export class IncomeError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof IncomeError) return NextResponse.json({ error: error.message }, { status: error.status })
  // Serializable の競合（同時操作）。やり直せば通る
  if ((error as { code?: string })?.code === 'P2034') return NextResponse.json({ error: '同時に別の操作が行われました。もう一度お試しください。' }, { status: 409 })
  // 一意制約の違反。確定のやり直し（INC-F03）でも解消しなかった場合など。中身の重複か同時操作のどちらか
  if ((error as { code?: string })?.code === 'P2002') return NextResponse.json({ error: '同じ内容がすでに登録されているか、同時に別の操作が行われました。画面を更新してから、もう一度お試しください。' }, { status: 409 })
  // ⚠️ 例外の中身（message/stack）はログに出さない（個人情報・取引先名が混ざりうる。verify-api-error-log-privacy）
  console.error('[income] unexpected error', { code: (error as { code?: string })?.code, name: (error as { name?: string })?.name })
  return NextResponse.json({ error: '処理に失敗しました。時間をおいて再度お試しください。' }, { status: 500 })
}

export async function audit(
  db: Pick<typeof prisma, 'incomeAuditLog'>,
  ctx: IncomeContext,
  action: string,
  targetType: string,
  targetId: string,
  diff?: Record<string, unknown>,
) {
  await db.incomeAuditLog.create({
    data: { organizationId: ctx.organizationId, actorUserId: ctx.userId, action, targetType, targetId, diff: (diff ?? undefined) as any },
  })
}
