// ============================================
// 招待を受けて会社に参加する /api/pricing/members/accept
// ============================================
// ⚠️ 旗 NEW_PRICING_ROLLOUT の内側。off なら 404。
// ⚠️ 招待したメールと、ログインしている人のメールが同じときだけ参加できる（リンクが他人に渡っても使えない）。
// ⚠️ 招待のリンクは1回だけ使える（参加したら inviteToken を消す）。期限は INVITE_TTL_DAYS（7日）。
// 参加した人のドヤパワーは、参加した会社のものを使う（本人が持ち主の会社があれば、そちらが先。team.server.ts の resolveCompanyForUser）。
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isNewPricingEnabledFor } from '@/lib/pricing-v2/rollout'
import { isInviteAlive, normalizeEmail, seatsUsed, INVITE_TTL_DAYS } from '@/lib/pricing-v2/team'
import { teamMembershipCapacity, teamSeatsForCompany, teamTablesAllowed } from '@/lib/pricing-v2/team.server'
import { SeatOperationError, withSeatAdmission } from '@/lib/pricing-v2/seat-operation'

const NO_STORE = { 'Cache-Control': 'private, no-store' }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE })

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as { id?: string } | undefined)?.id
    const email = normalizeEmail(session?.user?.email)
    if (!userId || !email) return json({ error: 'ログインが必要です。' }, 401)
    if (!isNewPricingEnabledFor(email) || !teamTablesAllowed()) return json({ error: '見つかりません。' }, 404)
    const body = await req.json().catch(() => null)
    const token = typeof body?.token === 'string' ? body.token.trim() : ''
    if (!token || token.length > 128) return json({ error: '招待のリンクを確かめてください。' }, 400)
    const invite = await prisma.accountCompanyMember.findUnique({
      where: { inviteToken: token },
      select: { id: true, companyId: true, email: true, status: true, invitedAt: true, company: { select: { name: true, userId: true } } },
    })
    // 招待が無い・使い済み・他の人あて は、同じ文で断る（招待の有無を知られないように）
    if (!invite || invite.status !== 'invited' || invite.email !== email || invite.company.userId === userId) {
      return json({ error: 'この招待は使えません。招待したメールアドレスでログインしているか確かめてください。' }, 404)
    }
    await teamSeatsForCompany(invite.companyId, { refresh: true, strict: true })
    return await withSeatAdmission(invite.companyId, async tx => {
      // Re-read the invitation, expiry, capacity and membership under the same
      // company guard used by invite creation and seat changes.
      const current = await tx.accountCompanyMember.findUnique({
        where: { inviteToken: token },
        select: { id: true, companyId: true, email: true, status: true, invitedAt: true, company: { select: { name: true, userId: true } } },
      })
      if (!current || current.companyId !== invite.companyId || current.status !== 'invited' || current.email !== email || current.company.userId === userId) return json({ error: 'この招待は使えません。' }, 404)
      if (!isInviteAlive(current.invitedAt)) return json({ error: `この招待は期限（${INVITE_TTL_DAYS}日）が切れています。招待した方に、招待し直してもらってください。` }, 410)
      const capacity = await teamMembershipCapacity(current.companyId, tx)
      const members = await tx.accountCompanyMember.findMany({
        where: { companyId: current.companyId, status: { in: ['invited', 'active'] } },
        select: { email: true, userId: true, status: true, invitedAt: true },
      })
      const used = seatsUsed({ ownerUserId: capacity.ownerUserId, ownerEmail: capacity.ownerEmail, members })
      if (used > capacity.limit) return json({ code: 'NO_SEAT', error: '契約人数を確認できるまで参加できません。招待した方に人数の確認を依頼してください。' }, 409)
      const now = new Date()
      const r = await tx.accountCompanyMember.updateMany({
        where: { id: current.id, companyId: current.companyId, email, status: 'invited', inviteToken: token, invitedAt: { gt: new Date(now.getTime() - INVITE_TTL_DAYS * 86400000), lte: now } },
        data: { status: 'active', userId, joinedAt: now, inviteToken: null },
      })
      if (r.count !== 1) return json({ error: 'この招待は使えません。' }, 409)
      return json({ ok: true, companyName: current.company.name })
    })
  } catch (error) {
    if (error instanceof SeatOperationError) return json({ code: error.code, error: '人数の変更を確認中です。時間をおいて、もう一度お試しください。' }, 409)
    console.error('[pricing/members/accept] accept failed')
    return json({ error: '参加できませんでした。時間をおいて再度お試しください。' }, 503)
  }
}
