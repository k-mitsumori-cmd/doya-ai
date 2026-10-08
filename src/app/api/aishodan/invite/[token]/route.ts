export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET  /api/aishodan/invite/[token] — 招待の内容（組織名・権限）
// POST /api/aishodan/invite/[token] — 招待を受ける（要ログイン）
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveUserId } from '@/lib/aishodan/access'

type Ctx = { params: Promise<{ token: string }> }
const INVITE_TTL_MS = 48 * 60 * 60 * 1000
class InvitationExpired extends Error {}

const ROLE_LABEL: Record<string, string> = {
  owner: 'オーナー',
  admin: '管理者',
  manager: 'マネージャー',
  member: 'メンバー',
}

async function load(token: string) {
  if (!token || token.length < 16) return null
  return prisma.aishodanMember.findUnique({
    where: { inviteToken: token },
    select: {
      id: true,
      role: true,
      status: true,
      inviteEmail: true,
      userId: true,
      createdAt: true,
      organization: { select: { id: true, name: true } },
    },
  })
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const m = await load(p.token)
  if (!m || !['admin', 'manager', 'member'].includes(m.role)) return NextResponse.json({ error: '招待が見つかりません' }, { status: 404 })
  if (m.status === 'PENDING' && m.createdAt.getTime() <= Date.now() - INVITE_TTL_MS) {
    return NextResponse.json({ error: '招待の有効期限が切れています' }, { status: 410 })
  }

  // ⚠️ 未ログインでも開ける画面なので、返すのは表示に要る最小限だけ。
  //    招待されたメールアドレスもここでは返さない（総当たりで宛先を探られないように）。
  return NextResponse.json({
    invite: {
      organizationName: m.organization.name,
      roleLabel: ROLE_LABEL[m.role] || m.role,
      accepted: m.status === 'ACTIVE',
    },
  })
}

export async function POST(_req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const userId = await resolveUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

  const m = await load(p.token)
  if (!m || !['admin', 'manager', 'member'].includes(m.role)) return NextResponse.json({ error: '招待が見つかりません' }, { status: 404 })
  if (m.status !== 'PENDING') {
    return NextResponse.json({ error: 'この招待は既に使われています' }, { status: 409 })
  }
  if (m.createdAt.getTime() <= Date.now() - INVITE_TTL_MS) {
    return NextResponse.json({ error: '招待の有効期限が切れています' }, { status: 410 })
  }
  try {
    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM aishodan_organizations WHERE id = ${m.organization.id} FOR UPDATE`
      if (rows.length === 0) return 'unavailable' as const
      const invite = await tx.aishodanMember.findUnique({ where: { id: m.id } })
      if (!invite || invite.organizationId !== m.organization.id || invite.status !== 'PENDING' || invite.inviteToken !== p.token) return 'unavailable' as const
      const now = new Date()
      if (invite.createdAt.getTime() <= now.getTime() - INVITE_TTL_MS) return 'expired' as const
      const account = await tx.user.findUnique({ where: { id: userId }, select: { email: true } })
      if (!invite.inviteEmail || !account?.email || account.email.trim().toLowerCase() !== invite.inviteEmail.trim().toLowerCase()) return 'mismatch' as const
      if (!['admin', 'manager', 'member'].includes(invite.role)) return 'unavailable' as const
      const already = await tx.aishodanMember.findFirst({ where: { organizationId: m.organization.id, userId, status: 'ACTIVE' }, select: { id: true } })
      if (Date.now() - invite.createdAt.getTime() >= INVITE_TTL_MS) throw new InvitationExpired()
      if (already) {
        await tx.aishodanMember.deleteMany({ where: { id: invite.id, organizationId: m.organization.id, role: invite.role, inviteEmail: invite.inviteEmail, status: 'PENDING', inviteToken: p.token } })
        if (Date.now() - invite.createdAt.getTime() >= INVITE_TTL_MS) throw new InvitationExpired()
        return 'already' as const
      }
      const claimed = await tx.aishodanMember.updateMany({
        where: { id: invite.id, organizationId: m.organization.id, role: invite.role, inviteEmail: invite.inviteEmail, status: 'PENDING', inviteToken: p.token, createdAt: { gt: new Date(Date.now() - INVITE_TTL_MS) } },
        data: { userId, status: 'ACTIVE', acceptedAt: now, inviteToken: null },
      })
      if (Date.now() - invite.createdAt.getTime() >= INVITE_TTL_MS) throw new InvitationExpired()
      return claimed.count === 1 ? 'accepted' as const : 'unavailable' as const
    })
    if (result === 'mismatch') return NextResponse.json({ error: '招待先のメールアドレスでログインしてください' }, { status: 403 })
    if (result === 'expired') return NextResponse.json({ error: '招待の有効期限が切れています' }, { status: 410 })
    if (result === 'unavailable') return NextResponse.json({ error: 'この招待は既に使用済みです' }, { status: 409 })
    if (result === 'already') return NextResponse.json({ ok: true, alreadyMember: true })
    return NextResponse.json({ ok: true, organizationName: m.organization.name })
  } catch (error) {
    if (error instanceof InvitationExpired) return NextResponse.json({ error: '招待の有効期限が切れています' }, { status: 410 })
    return NextResponse.json({ error: '招待を承諾できませんでした。再読み込みしてください' }, { status: 409 })
  }
}
