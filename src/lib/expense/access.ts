// ============================================
// ドヤ支出管理: 認証・組織スコープ（sfa/access.ts と同じ型）
// ============================================
// ⚠️ すべての API はここを通し、organizationId を条件に入れて読み書きする（IDOR 対策）。
// ⚠️ 明示された組織で認可できないとき、別の所属組織に切り替えない。
import { getServerSession } from 'next-auth'
import { NextResponse, type NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { EXPENSE_ROLES, ROLE_RANK, type ExpenseRole } from './constants'
import { ceilToolRole } from '@/lib/company-roles/access.server'

export type ExpenseContext = {
  userId: string
  organizationId: string
  organizationSlug: string
  role: ExpenseRole
  memberId: string
}

const isRole = (v: string): v is ExpenseRole => (EXPENSE_ROLES as readonly string[]).includes(v)

export async function resolveUserId(): Promise<string | undefined> {
  const session = await getServerSession(authOptions)
  const id = (session?.user as any)?.id as string | undefined
  if (id) return id
  const email = session?.user?.email
  if (!email) return undefined
  const u = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return u?.id
}

export function orgSlugFrom(req: NextRequest): string | undefined {
  try {
    return new URL(req.url).searchParams.get('org')?.trim() || undefined
  } catch {
    return undefined
  }
}

export async function getExpenseContext(orgSlug?: string): Promise<ExpenseContext | null> {
  const userId = await resolveUserId()
  if (!userId) return null
  const membership = await prisma.expenseMember.findFirst({
    where: { userId, status: 'ACTIVE', role: { in: [...EXPENSE_ROLES] }, ...(orgSlug ? { organization: { slug: orgSlug } } : {}) },
    include: { organization: { select: { slug: true } } },
    orderBy: { createdAt: 'desc' },
  })
  if (!membership || !isRole(membership.role)) return null
  // 会社の役割の旗の内側では、会社の役割の上限を当てる（ROLES-2026-10-26.md §4）
  const role = await ceilToolRole({ tool: 'expense', userId, organizationId: membership.organizationId, toolRole: membership.role })
  if (!role || !isRole(role)) return null
  return { userId, organizationId: membership.organizationId, organizationSlug: membership.organization.slug, role, memberId: membership.id }
}

/**
 * 招待中（PENDING）のメンバーを、本人の ACTIVE にする（システム点検 EXP-F05）。
 * メールはセッションの申告ではなく、DB のユーザーのメールで照合する。入口（/api/expense/usage）で毎回呼ぶ。
 */
export async function claimPendingMemberships(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  const email = user?.email?.toLowerCase()
  if (!email) return 0
  const pending = await prisma.expenseMember.findMany({ where: { invitedEmail: email, status: 'PENDING', userId: null }, select: { id: true, organizationId: true } })
  let claimed = 0
  for (const p of pending) {
    // 同じ組織に本人の行が既にあれば（以前に外された等）、招待の行は使わずに取り消す
    const own = await prisma.expenseMember.findFirst({ where: { organizationId: p.organizationId, userId }, select: { id: true } })
    if (own) {
      await prisma.expenseMember.update({ where: { id: p.id }, data: { status: 'INACTIVE' } })
      continue
    }
    const r = await prisma.expenseMember.updateMany({ where: { id: p.id, status: 'PENDING', userId: null }, data: { userId, status: 'ACTIVE' } })
    claimed += r.count
  }
  return claimed
}

export async function listMemberships() {
  const userId = await resolveUserId()
  if (!userId) return []
  const rows = await prisma.expenseMember.findMany({
    where: { userId, status: 'ACTIVE', role: { in: [...EXPENSE_ROLES] } },
    include: { organization: { select: { slug: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })
  return rows.map((m) => ({ slug: m.organization.slug, name: m.organization.name, role: m.role }))
}

export function hasMinRole(role: string, min: ExpenseRole): boolean {
  return isRole(role) && ROLE_RANK[role] >= ROLE_RANK[min]
}

export class ExpenseHttpError extends Error {
  constructor(readonly status: number, message: string, readonly code?: string) {
    super(message)
    this.name = 'ExpenseHttpError'
  }
}

/**
 * API の共通の入口。組織と権限を確かめてから handler を呼ぶ。
 * handler の中で投げた ExpenseHttpError はそのまま返し、それ以外は 500 にまとめる（中身は出さない）。
 */
export async function withExpense(
  req: NextRequest,
  minRole: ExpenseRole,
  handler: (ctx: ExpenseContext) => Promise<Response>
): Promise<Response> {
  try {
    const slug = orgSlugFrom(req)
    if (!slug) return NextResponse.json({ error: '組織が指定されていません' }, { status: 400 })
    const userId = await resolveUserId()
    if (!userId) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    const ctx = await getExpenseContext(slug)
    if (!ctx) return NextResponse.json({ error: 'この組織にアクセスできません' }, { status: 403 })
    if (!hasMinRole(ctx.role, minRole)) return NextResponse.json({ error: 'この操作を行う権限がありません' }, { status: 403 })
    return await handler(ctx)
  } catch (e) {
    if (e instanceof ExpenseHttpError) return NextResponse.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, { status: e.status })
    // 為替レート未設定（plan.ts の FxRateMissingError）は利用者が直せる理由なので、そのまま伝える
    if ((e as Error)?.name === 'FxRateMissingError') return NextResponse.json({ error: (e as Error).message, code: 'FX_RATE_MISSING' }, { status: 400 })
    console.error('[expense] request failed', req.nextUrl?.pathname, (e as Error)?.name)
    return NextResponse.json({ error: '処理に失敗しました。時間をおいて再度お試しください。' }, { status: 500 })
  }
}

export async function readJson(req: NextRequest): Promise<Record<string, unknown>> {
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ExpenseHttpError(400, '入力内容が正しくありません')
  return body as Record<string, unknown>
}

export async function audit(
  tx: Prisma.TransactionClient | typeof prisma,
  ctx: ExpenseContext,
  action: string,
  targetType: string,
  targetId: string,
  diff?: Prisma.InputJsonValue
) {
  await tx.expenseAuditLog.create({ data: { organizationId: ctx.organizationId, actorUserId: ctx.userId, action, targetType, targetId, diff } })
}

/** 初回オンボーディング: 組織とオーナーを作る（既に所属があればそれを返す） */
export async function createOrganization(userId: string, orgName: string, memberName: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.expenseMember.findFirst({ where: { userId, status: 'ACTIVE' }, include: { organization: true } })
        if (existing) return existing.organization
        // slug は ASCII のみ（URL 安全）。日本語の社名は org-<時刻> にする
        const base = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || `org-${Date.now()}`
        const dup = await tx.expenseOrganization.findUnique({ where: { slug: base } })
        const slug = dup ? `${base}-${Date.now()}` : base
        const org = await tx.expenseOrganization.create({ data: { name: orgName, slug } })
        await tx.expenseMember.create({ data: { organizationId: org.id, userId, name: memberName, role: 'owner', status: 'ACTIVE' } })
        // 振込は取引先ごとの条件で計算するので、支払方法の初期値は「振込」1件だけ
        await tx.expensePaymentMethod.create({ data: { organizationId: org.id, type: 'transfer', label: '銀行振込' } })
        return org
      }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 20000 })
    } catch (e) {
      const code = (e as { code?: string })?.code
      if (attempt === 2 || (code !== 'P2034' && code !== 'P2002')) throw e
    }
  }
  throw new Error('unreachable')
}
