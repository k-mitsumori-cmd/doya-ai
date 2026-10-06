export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET  /api/aishodan/members — メンバー一覧
// POST /api/aishodan/members — メンバーを招待（F5-1）
//
// 組織スコープのサービスなのに招待の導線が無く、実質1人でしか使えなかったため追加。
import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAishodanContext, hasMinRole, orgSlugFrom } from '@/lib/aishodan/access'
import { sendEmail } from '@/lib/email'
import { escapeHtml } from '@/lib/html-escape'
import { ROLE_HIERARCHY, type AishodanRole } from '@/lib/aishodan/types'

const ROLES: AishodanRole[] = ['owner', 'admin', 'manager', 'member']
const INVITE_TTL_MS = 48 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  const c = await getAishodanContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  const members = await prisma.aishodanMember.findMany({
    where: { organizationId: c.organizationId },
    orderBy: { createdAt: 'asc' },
    // ⚠️ inviteToken は返さない。一覧はメンバー全員が見られるため、
    //    他人の招待リンクを盗んで成り代われてしまう。
    select: {
      id: true,
      role: true,
      status: true,
      name: true,
      inviteEmail: true,
      acceptedAt: true,
      userId: true,
      createdAt: true,
    },
  })
  return NextResponse.json({ members, myRole: c.role, myUserId: c.userId })
}

export async function POST(req: NextRequest) {
  const c = await getAishodanContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  if (!hasMinRole(c.role, 'admin')) {
    return NextResponse.json({ error: 'メンバーを招待する権限がありません' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const email = String(body?.email || '').trim().toLowerCase()
  const requestedRole = body?.role
  if (requestedRole !== undefined && !ROLES.includes(requestedRole)) {
    return NextResponse.json({ error: '招待権限の形式が正しくありません' }, { status: 400 })
  }
  const role = (requestedRole ?? 'member') as AishodanRole

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'メールアドレスの形式が正しくありません' }, { status: 400 })
  }
  // ⚠️ 自分より上の権限は与えられない（権限の昇格を防ぐ）
  if (ROLE_HIERARCHY[role] > ROLE_HIERARCHY[c.role]) {
    return NextResponse.json({ error: '自分より上の権限は付与できません' }, { status: 403 })
  }
  // owner は組織にひとりだけ。招待では付与しない
  if (role === 'owner') {
    return NextResponse.json({ error: 'オーナー権限は招待では付与できません' }, { status: 400 })
  }

  const token = randomBytes(24).toString('base64url')
  let result
  try {
    result = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM aishodan_organizations WHERE id = ${c.organizationId} FOR UPDATE`
      if (rows.length === 0) return { kind: 'missing' as const }
      const actor = await tx.$queryRaw<{ role: AishodanRole }[]>`SELECT role FROM aishodan_members
        WHERE "organizationId" = ${c.organizationId} AND "userId" = ${c.userId}
        AND status = 'ACTIVE' AND role IN ('owner', 'admin') FOR UPDATE`
      if (!actor.length || ROLE_HIERARCHY[role] > ROLE_HIERARCHY[actor[0].role]) return { kind: 'forbidden' as const }
      const cutoff = new Date(Date.now() - INVITE_TTL_MS)
      const duplicate = await tx.aishodanMember.findFirst({
        where: { organizationId: c.organizationId, inviteEmail: email, OR: [{ status: 'ACTIVE' }, { status: 'PENDING', createdAt: { gt: cutoff } }] },
        select: { status: true },
      })
      if (duplicate) return { kind: 'duplicate' as const, status: duplicate.status }
      await tx.aishodanMember.deleteMany({ where: { organizationId: c.organizationId, inviteEmail: email, status: 'PENDING', createdAt: { lte: cutoff } } })
      const member = await tx.aishodanMember.create({
        data: { organizationId: c.organizationId, role, status: 'PENDING', inviteEmail: email, inviteToken: token },
        select: { id: true, role: true, status: true, inviteEmail: true },
      })
      return { kind: 'created' as const, member }
    })
  } catch {
    return NextResponse.json({ error: '招待を作成できませんでした。再試行してください' }, { status: 409 })
  }
  if (result.kind === 'missing') return NextResponse.json({ error: '組織が見つかりません' }, { status: 404 })
  if (result.kind === 'forbidden') return NextResponse.json({ error: 'メンバーを招待する権限がありません。再読み込みしてください' }, { status: 403 })
  if (result.kind === 'duplicate') return NextResponse.json({ error: result.status === 'ACTIVE' ? 'このメールの方は既にメンバーです' : '既に招待済みです' }, { status: 409 })
  const member = result.member

  // ⚠️ 外部向けリンクに VERCEL_URL を使わない（デプロイ保護でログイン画面に飛ぶ）
  const base = process.env.NEXTAUTH_URL || 'https://doya-ai.surisuta.jp'
  const url = `${base}/aishodan/invite/${token}`

  const mail = await sendEmail({
    to: email,
    subject: `【ドヤAI商談】${c.organizationName} に招待されました`,
    html: `
      <div style="font-family:sans-serif;line-height:1.8;color:#0a0f3c">
        <p>${escapeHtml(c.organizationName)} の商談管理（ドヤAI商談）に招待されました。</p>
        <p>下のリンクを開いてログインすると参加できます（有効期限は48時間です）。</p>
        <p><a href="${escapeHtml(url)}" style="color:#0066ff">${escapeHtml(url)}</a></p>
        <p style="color:#8a94ad;font-size:13px">
          このリンクはあなた専用です。他の方に転送しないでください。<br>
          心当たりがない場合は破棄してください。
        </p>
      </div>`,
  })

  return NextResponse.json({
    member,
    // メール送信に失敗しても招待自体は作る（URLを手で渡せるように返す）
    url,
    emailSent: mail.success,
  })
}
