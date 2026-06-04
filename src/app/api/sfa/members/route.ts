export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { getSfaContext, hasMinRole, orgSlugFrom } from '@/lib/sfa/access'
import { ROLE_HIERARCHY } from '@/lib/sfa/types'
import { sendEmail } from '@/lib/email'

const INVITABLE_ROLES = ['member', 'manager', 'admin']
const rank = (role: string) => ROLE_HIERARCHY[role] ?? 0
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// GET /api/sfa/members — メンバー一覧
export async function GET(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  const members = await prisma.sfaMember.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, role: true, status: true, inviteEmail: true, acceptedAt: true, createdAt: true },
  })
  return NextResponse.json({ members, myRole: ctx.role, myMemberId: ctx.memberId }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST /api/sfa/members — メンバー招待（admin+）
export async function POST(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  if (!hasMinRole(ctx.role, 'admin')) return NextResponse.json({ error: '招待権限がありません' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const email = (body.email as string)?.trim().toLowerCase()
  const role = INVITABLE_ROLES.includes(body.role) ? (body.role as string) : 'member'
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: '有効なメールアドレスを入力してください' }, { status: 400 })
  }
  // 自分と同格以上の権限では招待できない（adminはadminを招待不可。ownerのみadmin招待可能）
  if (rank(role) >= rank(ctx.role)) {
    return NextResponse.json({ error: '自分と同格以上の権限では招待できません' }, { status: 403 })
  }

  // 既に同メールで招待中/参加中なら重複を作らない
  const dup = await prisma.sfaMember.findFirst({
    where: { organizationId: ctx.organizationId, inviteEmail: email, status: { in: ['PENDING', 'ACTIVE'] } },
  })
  if (dup) {
    return NextResponse.json(
      { error: dup.status === 'ACTIVE' ? '既に参加済みのメンバーです' : '既に招待済みです' },
      { status: 409 }
    )
  }

  const org = await prisma.sfaOrganization.findUnique({ where: { id: ctx.organizationId } })
  const inviteToken = crypto.randomUUID()
  let member
  try {
    member = await prisma.sfaMember.create({
      data: { organizationId: ctx.organizationId, role, status: 'PENDING', inviteEmail: email, inviteToken },
    })
  } catch {
    return NextResponse.json({ error: '招待の作成に失敗しました（既に招待済みかもしれません）' }, { status: 409 })
  }

  const baseUrl = process.env.NEXTAUTH_URL || 'https://doya-ai.surisuta.jp'
  const link = `${baseUrl}/sfa/invite/${inviteToken}`
  await sendEmail({
    to: email,
    subject: `【ドヤ営業管理】${esc(org?.name || '組織')}からの招待`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto">
        <div style="background:linear-gradient(135deg,#22c55e,#84cc16);padding:24px;border-radius:16px 16px 0 0;color:#fff">
          <h1 style="margin:0;font-size:20px">📈 ドヤ営業管理に招待されました</h1>
        </div>
        <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:24px">
          <p style="font-weight:700;color:#334155">「${esc(org?.name || '組織')}」のメンバーとして招待されました。</p>
          <p style="color:#64748b">下のボタンからログインして参加してください（リンクの有効期限は48時間）。</p>
          <a href="${link}" style="display:inline-block;margin-top:12px;background:#7f19e6;color:#fff;font-weight:800;padding:12px 24px;border-radius:9999px;text-decoration:none">招待を受ける</a>
          <p style="color:#94a3b8;font-size:12px;margin-top:16px">${esc(link)}</p>
        </div>
      </div>`,
  })

  return NextResponse.json({ ok: true, member: { id: member.id, inviteEmail: email, role } })
}
