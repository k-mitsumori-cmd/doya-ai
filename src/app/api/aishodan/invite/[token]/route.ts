export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET  /api/aishodan/invite/[token] — 招待の内容（組織名・権限）
// POST /api/aishodan/invite/[token] — 招待を受ける（要ログイン）
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveUserId } from '@/lib/aishodan/access'

type Ctx = { params: Promise<{ token: string }> | { token: string } }

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
      organization: { select: { id: true, name: true } },
    },
  })
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const m = await load(p.token)
  if (!m) return NextResponse.json({ error: '招待が見つかりません' }, { status: 404 })

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
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const userId = await resolveUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

  const m = await load(p.token)
  if (!m) return NextResponse.json({ error: '招待が見つかりません' }, { status: 404 })
  if (m.status === 'ACTIVE') {
    return NextResponse.json({ error: 'この招待は既に使われています' }, { status: 409 })
  }

  // 同じ組織に既に参加していれば、招待は消化して終わり
  const already = await prisma.aishodanMember.findFirst({
    where: { organizationId: m.organization.id, userId, status: 'ACTIVE' },
    select: { id: true },
  })
  if (already) {
    await prisma.aishodanMember.delete({ where: { id: m.id } })
    return NextResponse.json({ ok: true, alreadyMember: true })
  }

  await prisma.aishodanMember.update({
    where: { id: m.id },
    data: {
      userId,
      status: 'ACTIVE',
      acceptedAt: new Date(),
      // ⚠️ 使い終わった招待トークンは必ず無効化する。
      //    残しておくと、リンクが転送された第三者が後から入れてしまう。
      inviteToken: null,
    },
  })
  return NextResponse.json({ ok: true, organizationName: m.organization.name })
}
