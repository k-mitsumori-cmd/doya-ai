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
import { decideInvite, memberLimit, normalizeEmail, seatsUsed, MEMBER_ROLES, type MemberRole } from '@/lib/pricing-v2/team'
import { ownerTeamContext, teamSeatsForCompany, teamTablesAllowed } from '@/lib/pricing-v2/team.server'

const NO_STORE = { 'Cache-Control': 'private, no-store' }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE })

async function ownerContext() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  const email = session?.user?.email ?? null
  if (!userId || !email) return { error: json({ error: 'ログインが必要です。' }, 401) }
  if (!isNewPricingEnabledFor(email) || !teamTablesAllowed()) return { error: json({ error: '見つかりません。' }, 404) }
  const ctx = await ownerTeamContext(userId)
  if (!ctx) return { error: json({ code: 'OWNER_REQUIRED', error: 'メンバーを管理できるのは、会社の持ち主の方だけです。先に会社を登録してください。' }, 403) }
  const kind = subscriberKind({ plan: ctx.owner.plan, stripePriceId: ctx.owner.stripePriceId, newPriceIds: newPricingPriceIds() })
  const limit = memberLimit(kind, kind === 'team' ? await teamSeatsForCompany(ctx.companyId) : null)
  return { ctx, kind, limit, userId }
}

async function listMembers(companyId: string) {
  return prisma.accountCompanyMember.findMany({
    where: { companyId, status: { in: ['invited', 'active'] } },
    orderBy: { invitedAt: 'asc' },
    select: { id: true, email: true, userId: true, role: true, status: true, invitedAt: true, joinedAt: true },
  })
}

export async function GET() {
  try {
    const c = await ownerContext()
    if ('error' in c) return c.error
    const members = await listMembers(c.ctx.companyId)
    const used = seatsUsed({ ownerUserId: c.ctx.owner.id, ownerEmail: c.ctx.owner.email, members })
    return json({ members, used, limit: c.limit, kind: c.kind })
  } catch {
    console.error('[pricing/members] list failed')
    return json({ error: 'メンバーを読み込めませんでした。時間をおいて再度お試しください。' }, 503)
  }
}

export async function POST(req: NextRequest) {
  try {
    const c = await ownerContext()
    if ('error' in c) return c.error
    const body = await req.json().catch(() => null)
    const role: MemberRole = MEMBER_ROLES.includes(body?.role) ? body.role : 'member'
    const members = await listMembers(c.ctx.companyId)
    const used = seatsUsed({ ownerUserId: c.ctx.owner.id, ownerEmail: c.ctx.owner.email, members })
    const d = decideInvite({ email: body?.email, ownerEmail: c.ctx.owner.email, members, used, seats: c.limit })
    if (!d.ok) {
      const messages: Record<typeof d.code, string> = {
        INVALID_EMAIL: 'メールアドレスを確かめてください。',
        OWNER_SELF: 'ご自身は、すでに会社の持ち主として数えています。',
        ALREADY_MEMBER: 'この方は、すでに招待しているか、参加しています。',
        NO_SEAT: c.kind === 'team'
          ? `人数（${c.limit}人）がいっぱいです。人数を増やしてから招待してください。`
          : c.kind === 'legacy'
            ? '今のご契約は1人用です。メンバーを増やしたいときは、お問い合わせください。'
            : `フリーは${c.limit}人までです。チームプランにすると人数を増やせます。`,
      }
      return json({ code: d.code, error: messages[d.code] }, d.status)
    }
    const email = normalizeEmail(body?.email)!
    const token = randomBytes(24).toString('base64url')
    // 外した（removed）人を呼び直すときは、同じ行を招待中に戻す（会社とメールの組は1つだけ）
    const row = await prisma.accountCompanyMember.upsert({
      where: { companyId_email: { companyId: c.ctx.companyId, email } },
      create: { companyId: c.ctx.companyId, email, role, status: 'invited', inviteToken: token, invitedBy: c.userId },
      update: { role, status: 'invited', inviteToken: token, invitedBy: c.userId, invitedAt: new Date(), userId: null, joinedAt: null, removedAt: null },
      select: { id: true, email: true, role: true, status: true },
    })
    const base = String(process.env.NEXTAUTH_URL || 'https://doya-ai.surisuta.jp').replace(/\/+$/, '')
    return json({ member: row, inviteUrl: `${base}/pricing/join?token=${encodeURIComponent(token)}`, used: used + 1, limit: c.limit }, 201)
  } catch {
    console.error('[pricing/members] invite failed')
    return json({ error: '招待できませんでした。時間をおいて再度お試しください。' }, 503)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const c = await ownerContext()
    if ('error' in c) return c.error
    const id = new URL(req.url).searchParams.get('id') || ''
    if (!id || id.length > 64) return json({ error: '外すメンバーを選び直してください。' }, 400)
    // 会社と ID の二重の条件（他の会社の行は外せない）
    const r = await prisma.accountCompanyMember.updateMany({
      where: { id, companyId: c.ctx.companyId, status: { in: ['invited', 'active'] } },
      data: { status: 'removed', removedAt: new Date(), inviteToken: null },
    })
    if (r.count !== 1) return json({ error: 'メンバーが見つかりませんでした。' }, 404)
    return json({ ok: true })
  } catch {
    console.error('[pricing/members] remove failed')
    return json({ error: 'メンバーを外せませんでした。時間をおいて再度お試しください。' }, 503)
  }
}
