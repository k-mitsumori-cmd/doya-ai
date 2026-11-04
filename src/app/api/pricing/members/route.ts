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
import { ownerTeamContext, teamMembershipCapacity, teamSeatsForCompany, teamTablesAllowed } from '@/lib/pricing-v2/team.server'
import { SeatOperationError, withSeatAdmission } from '@/lib/pricing-v2/seat-operation'

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
    const limit = memberLimit(c.kind, c.kind === 'team' ? await teamSeatsForCompany(c.ctx.companyId) : null)
    const members = await listMembers(c.ctx.companyId)
    const used = seatsUsed({ ownerUserId: c.ctx.owner.id, ownerEmail: c.ctx.owner.email, members })
    return json({ members, used, limit, kind: c.kind })
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
    const role: MemberRole = MEMBER_ROLES.includes(body?.role) ? body.role : 'member'
    const companyId = c.ctx.companyId
    const userId = c.userId
    if (c.kind === 'team') await teamSeatsForCompany(companyId, { refresh: true, strict: true })
    let limit = memberLimit(c.kind, null)
    let kind = c.kind
    // 人数を数えることと行を作ることを、直列化できる1つのトランザクションで行う（同時の招待で上限を超えない）。
    // 競合（P2034・P2002）のときは、数え直してやり直す
    type Out = { ok: true; row: { id: string; email: string; role: string; status: string }; token: string; used: number } | { ok: false; status: number; code: 'NO_SEAT' | 'INVALID_EMAIL' | 'ALREADY_MEMBER' | 'OWNER_SELF' }
    let out: Out | null = null
    for (let attempt = 0; attempt < 4 && !out; attempt++) {
      try {
        out = await withSeatAdmission(companyId, async (tx) => {
          const capacity = await teamMembershipCapacity(companyId, tx)
          if (capacity.ownerUserId !== userId) throw new Error('Company owner changed')
          limit = capacity.limit
          kind = capacity.kind
          const ownerEmail = capacity.ownerEmail
          const members = await listMembers(companyId, tx)
          const used = seatsUsed({ ownerUserId: c.ctx.owner.id, ownerEmail, members })
          const d = decideInvite({ email: body?.email, ownerEmail, members, used, seats: limit })
          if (!d.ok) return d
          const email = normalizeEmail(body?.email)!
          const token = randomBytes(24).toString('base64url')
          // 外した（removed）人を呼び直すときは、同じ行を招待中に戻す（会社とメールの組は1つだけ）
          const row = await tx.accountCompanyMember.upsert({
            where: { companyId_email: { companyId, email } },
            create: { companyId, email, role, status: 'invited', inviteToken: token, invitedBy: userId },
            update: { role, status: 'invited', inviteToken: token, invitedBy: userId, invitedAt: new Date(), userId: null, joinedAt: null, removedAt: null },
            select: { id: true, email: true, role: true, status: true },
          })
          return { ok: true as const, row, token, used: used + 1 }
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
    return json({ member: row, inviteUrl: `${base}/pricing/join?token=${encodeURIComponent(token)}`, used, limit }, 201)
  } catch (error) {
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
