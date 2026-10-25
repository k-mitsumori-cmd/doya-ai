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
import { isInviteAlive, normalizeEmail, INVITE_TTL_DAYS } from '@/lib/pricing-v2/team'
import { teamTablesAllowed } from '@/lib/pricing-v2/team.server'

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
      select: { id: true, email: true, status: true, invitedAt: true, company: { select: { name: true, userId: true } } },
    })
    // 招待が無い・使い済み・他の人あて は、同じ文で断る（招待の有無を知られないように）
    if (!invite || invite.status !== 'invited' || invite.email !== email || invite.company.userId === userId) {
      return json({ error: 'この招待は使えません。招待したメールアドレスでログインしているか確かめてください。' }, 404)
    }
    if (!isInviteAlive(invite.invitedAt)) {
      return json({ error: `この招待は期限（${INVITE_TTL_DAYS}日）が切れています。招待した方に、招待し直してもらってください。` }, 410)
    }
    const r = await prisma.accountCompanyMember.updateMany({
      where: { id: invite.id, status: 'invited', inviteToken: token },
      data: { status: 'active', userId, joinedAt: new Date(), inviteToken: null },
    })
    if (r.count !== 1) return json({ error: 'この招待は使えません。' }, 409)
    return json({ ok: true, companyName: invite.company.name })
  } catch {
    console.error('[pricing/members/accept] accept failed')
    return json({ error: '参加できませんでした。時間をおいて再度お試しください。' }, 503)
  }
}
