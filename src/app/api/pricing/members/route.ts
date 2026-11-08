import { readCompanyOperatingSeatUsage } from '@/lib/pricing-v2/company-seat-minimum.server'
// ============================================
// 会社のメンバー（一覧・招待・外す） /api/pricing/members
// ============================================
// ⚠️ 旗 NEW_PRICING_ROLLOUT の内側。off なら 404（account_company_members を読まない）。
// ⚠️ 操作できるのは会社の持ち主（account_companies.userId）だけ。会社はセッションの本人から決め、body の会社 ID は受け取らない。
// ⚠️ 招待のメールは送らない（送るにはユーザーの承認が要る）。招待のリンクを返し、持ち主が相手に渡す。
// 入れる人数の上限（持ち主を含む）: チーム＝買った人数 / フリー＝3人 / 据え置き＝1人（team.ts の memberLimit）
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isNewPricingEnabledFor } from '@/lib/pricing-v2/rollout'
import { newPricingPriceIds } from '@/lib/pricing-v2/prices'
import { subscriberKind } from '@/lib/pricing-v2/view'
import { decideInvite, memberLimit, normalizeEmail } from '@/lib/pricing-v2/team'
import { ownerTeamContext, teamSeatsForCompany, teamTablesAllowed } from '@/lib/pricing-v2/team.server'
import { SeatOperationError, withSeatAdmission, withSeatAdmissionInTransaction, withSeatRevocation } from '@/lib/pricing-v2/seat-operation'

import { CompanyMembershipSeatError, pinCompanyMembershipPrincipals, readCompanyMembershipLicense, requireCompanyMembershipCapacity } from '@/lib/pricing-v2/company-membership-seat.server'

import { companyInviteRole } from '@/lib/pricing-v2/company-invite-role'

const NO_STORE = { 'Cache-Control': 'private, no-store' }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE })

async function ownerContext(expectedOwner: string | null = null) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  const email = session?.user?.email ?? null
  if (!userId || !email) return { error: json({ error: 'ログインが必要です。' }, 401) }
  if (!isNewPricingEnabledFor(email) || !teamTablesAllowed()) return { error: json({ error: '見つかりません。' }, 404) }
  if (expectedOwner !== null && expectedOwner !== userId) return { error: json({ code: 'OWNER_CHANGED', error: 'ログイン状態が変わりました。画面を読み込み直してください。' }, 403) }
  const ctx = await ownerTeamContext(userId)
  if (!ctx) return { error: json({ code: 'OWNER_REQUIRED', error: 'メンバーを管理できるのは、会社の持ち主の方だけです。先に会社を登録してください。' }, 403) }
  const kind = subscriberKind({ plan: ctx.owner.plan, stripePriceId: ctx.owner.stripePriceId, newPriceIds: newPricingPriceIds() })
  return { ctx, kind, userId }
}

async function listMembers(companyId: string, db: Pick<typeof prisma, 'accountCompanyMember'> = prisma) {
  return db.accountCompanyMember.findMany({
    where: { companyId, status: { in: ['invited', 'active'] } },
    orderBy: { invitedAt: 'asc' },
    select: { id: true, email: true, userId: true, role: true, status: true, invitedAt: true, joinedAt: true },
  })
}

export async function GET(req: NextRequest) {
  try {
    const c = await ownerContext(req?.headers?.get('x-doya-owner'))
    if ('error' in c) return c.error
    return await prisma.$transaction(async tx => {
      const company = await tx.accountCompany.findUnique({ where: { id: c.ctx.companyId }, select: { userId: true, user: { select: { email: true } } } })
      if (company?.userId !== c.userId || !isNewPricingEnabledFor(company.user?.email)) throw new CompanyMembershipSeatError('OWNER_CHANGED')
      const members = await listMembers(c.ctx.companyId, tx)
      try {
        const license = await readCompanyMembershipLicense(tx, c.ctx.companyId)
        return json({ members, used: license.used, limit: license.limit, kind: license.kind, seatUsageUnavailable: false })
      } catch {
        // Owner-authorized membership management does not require billing
        // availability. Unknown usage never authorizes an operating admission.
        return json({ members, used: null, limit: null, seatUsageUnavailable: true })
      }
    }, { isolationLevel: 'RepeatableRead', maxWait: 5000, timeout: 10000 })
  } catch {
    console.error('[pricing/members] list failed')
    return json({ error: 'メンバーを読み込めませんでした。時間をおいて再度お試しください。' }, 503)
  }
}

export async function POST(req: NextRequest) {
  try {
    const c = await ownerContext(req?.headers?.get('x-doya-owner'))
    if ('error' in c) return c.error
    const body = await req.json().catch(() => null)
    const role = companyInviteRole(body?.role)
    if (!role) return json({ code: 'INVALID_ROLE', error: '招待する役割を選び直してください。' }, 400)
    const readonlyGuest = role === 'guest'
    const companyId = c.ctx.companyId
    const userId = c.userId
    if (!readonlyGuest && c.kind === 'team') await teamSeatsForCompany(companyId, { refresh: true, strict: true })
    let limit = memberLimit(c.kind, null)
    let kind = c.kind
    // 人数を数えることと行を作ることを、直列化できる1つのトランザクションで行う（同時の招待で上限を超えない）。
    // 競合（P2034・P2002）のときは、数え直してやり直す
    type Out = { ok: true; row: { id: string; email: string; role: string; status: string }; token: string; used: number | null } | { ok: false; status: number; code: 'NO_SEAT' | 'INVALID_EMAIL' | 'ALREADY_MEMBER' | 'OWNER_SELF' }
    let out: Out | null = null
    for (let attempt = 0; attempt < 4 && !out; attempt++) {
      try {
        const guard = readonlyGuest ? withSeatRevocation : withSeatAdmission
        out = await guard(companyId, async (tx) => {
          const owner = await pinCompanyMembershipPrincipals(tx, { companyId, ownerUserId: userId, actorUserId: userId })
          if (!isNewPricingEnabledFor(owner.email)) throw new CompanyMembershipSeatError('OWNER_CHANGED')
          const capacity = readonlyGuest ? null : await readCompanyMembershipLicense(tx, companyId)
          if (capacity) {
            if (capacity.ownerUserId !== userId) throw new CompanyMembershipSeatError('OWNER_CHANGED')
            limit = capacity.limit; kind = capacity.kind
          }
          const ownerEmail = owner.email
          const members = await listMembers(companyId, tx)
          const requestedEmail = normalizeEmail(body?.email)
          const activeUserIds = [...new Set(members.flatMap(member => member.status === 'active' && member.userId ? [member.userId] : []))]
          // 所属に残る旧メールだけで判定せず、参加済みアカウントの
          // 現在のメールも確かめる。同じ人への再招待で席を重ねない。
          if (requestedEmail && requestedEmail !== normalizeEmail(ownerEmail) && activeUserIds.length > 0) {
            const alreadyActive = await tx.user.findFirst({
              where: { id: { in: activeUserIds }, email: { equals: requestedEmail, mode: 'insensitive' } },
              select: { id: true },
            })
            if (alreadyActive) return { ok: false as const, status: 409, code: 'ALREADY_MEMBER' as const }
          }
          const d = decideInvite({ email: body?.email, ownerEmail, members, used: 0, seats: 1 })
          if (!d.ok) return d
          if (capacity) requireCompanyMembershipCapacity(capacity)
          const email = normalizeEmail(body?.email)!
          const token = randomBytes(24).toString('base64url')
          // 外した（removed）人を呼び直すときは、同じ行を招待中に戻す（会社とメールの組は1つだけ）
          const row = await tx.accountCompanyMember.upsert({
            where: { companyId_email: { companyId, email } },
            create: { companyId, email, role, status: 'invited', inviteToken: token, invitedBy: userId },
            update: { role, status: 'invited', inviteToken: token, invitedBy: userId, invitedAt: new Date(), userId: null, joinedAt: null, removedAt: null },
            select: { id: true, email: true, role: true, status: true },
          })
          const final = readonlyGuest ? null : await readCompanyMembershipLicense(tx, companyId)
          if (final) requireCompanyMembershipCapacity(final)
          return { ok: true as const, row, token, used: final?.used ?? null }
        })
      } catch (e) {
        const code = (e as { code?: string })?.code
        if (code !== 'P2034' && code !== 'P2002') throw e
      }
    }
    if (!out) return json({ error: 'ほかの操作と重なりました。もう一度お試しください。' }, 409)
    if (!out.ok) {
      const messages: Record<typeof out.code, string> = {
        INVALID_EMAIL: 'メールアドレスを確かめてください。',
        OWNER_SELF: 'ご自身は、すでに会社の持ち主として数えています。',
        ALREADY_MEMBER: 'この方は、すでに招待しているか、参加しています。',
        NO_SEAT: kind === 'team'
          ? `人数（${limit}人）がいっぱいです。人数を増やしてから招待してください。`
          : kind === 'legacy'
            ? '今のご契約は1人用です。メンバーを増やしたいときは、お問い合わせください。'
            : `フリーは${limit}人までです。チームプランにすると人数を増やせます。`,
      }
      return json({ code: out.code, error: messages[out.code] }, out.status)
    }
    const { row, token, used } = out
    const base = String(process.env.NEXTAUTH_URL || 'https://doya-ai.surisuta.jp').replace(/\/+$/, '')
    return json({ member: row, inviteUrl: `${base}/pricing/join?token=${encodeURIComponent(token)}`, used, limit: readonlyGuest ? null : limit }, 201)
  } catch (error) {
    if (error instanceof CompanyMembershipSeatError) return json({ code: error.code, error: error.code === 'NO_SEAT' ? '人数がいっぱいです。会社のオーナーに人数の確認を依頼してください。' : '会社の持ち主が変わりました。画面を読み込み直してください。' }, 409)
    if (error instanceof SeatOperationError) return json({ code: error.code, error: '人数の変更を確認中です。時間をおいて、もう一度お試しください。' }, 409)
    console.error('[pricing/members] invite failed')
    return json({ error: '招待できませんでした。時間をおいて再度お試しください。' }, 503)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const c = await ownerContext(req?.headers?.get('x-doya-owner'))
    if ('error' in c) return c.error
    const id = new URL(req.url).searchParams.get('id') || ''
    if (!id || id.length > 64) return json({ error: '外すメンバーを選び直してください。' }, 400)
    // 会社と ID の二重の条件（他の会社の行は外せない）
    const r = await withSeatRevocation(c.ctx.companyId, async tx => {
      await pinCompanyMembershipPrincipals(tx, { companyId: c.ctx.companyId, ownerUserId: c.userId, actorUserId: c.userId })
      const rows = await tx.$queryRaw<Array<{ id: string; role: string; status: string }>>
        `SELECT id, role, status FROM account_company_members WHERE id = ${id} AND "companyId" = ${c.ctx.companyId} AND status IN ('invited', 'active') FOR UPDATE`
      const target = rows[0]
      if (!target) return { count: 0 }
      // Removing an active central guest can restore its independent tool
      // operating role. That is an admission if actual company usage grows.
      const before = target.role === 'guest' && target.status === 'active'
        ? await readCompanyOperatingSeatUsage(tx, c.ctx.companyId) : null
      const result = await tx.accountCompanyMember.updateMany({
        where: { id, companyId: c.ctx.companyId, status: target.status, role: target.role },
        data: { status: 'removed', removedAt: new Date(), inviteToken: null },
      })
      if (result.count === 1 && before) {
        const after = await readCompanyOperatingSeatUsage(tx, c.ctx.companyId)
        if (after.used > before.used) await withSeatAdmissionInTransaction(c.ctx.companyId, tx, async () => {
          requireCompanyMembershipCapacity(await readCompanyMembershipLicense(tx, c.ctx.companyId))
        })
      }
      return result
    })
    if (r.count !== 1) return json({ error: 'メンバーが見つかりませんでした。' }, 404)
    return json({ ok: true })
  } catch (error) {
    if (error instanceof CompanyMembershipSeatError && error.code === 'NO_SEAT') return json({ code: 'NO_SEAT', error: 'ツールの操作権限が復活すると購入人数を超えます。先に購入人数を増やすか、ツールの所属を外してください。' }, 409)
    if (error instanceof SeatOperationError && error.code === 'SEAT_OPERATION_BUSY') return json({ code: error.code, error: '人数の変更を確認中です。時間をおいて、もう一度お試しください。' }, 409)
    console.error('[pricing/members] remove failed')
    return json({ error: 'メンバーを外せませんでした。時間をおいて再度お試しください。' }, 503)
  }
}
