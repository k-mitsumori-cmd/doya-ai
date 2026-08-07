export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET  /api/mensetsu/members — メンバー一覧
// POST /api/mensetsu/members — メンバーを招待（F5-1）
//
// 組織スコープのサービスなのに招待の導線が無く、実質1人でしか使えなかったため追加。
import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMensetsuContext, hasMinRole, orgSlugFrom } from '@/lib/mensetsu/access'
import { sendEmail } from '@/lib/email'
import { ROLE_HIERARCHY, type MensetsuRole } from '@/lib/mensetsu/types'

const ROLES: MensetsuRole[] = ['owner', 'admin', 'manager', 'member']

export async function GET(req: NextRequest) {
  const c = await getMensetsuContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  const members = await prisma.mensetsuMember.findMany({
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
  const c = await getMensetsuContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  if (!hasMinRole(c.role, 'admin')) {
    return NextResponse.json({ error: 'メンバーを招待する権限がありません' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const email = String(body?.email || '').trim().toLowerCase()
  const role = (ROLES.includes(body?.role) ? body.role : 'member') as MensetsuRole

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

  const dup = await prisma.mensetsuMember.findFirst({
    where: { organizationId: c.organizationId, inviteEmail: email, status: { in: ['ACTIVE', 'PENDING'] } },
    select: { id: true, status: true },
  })
  if (dup) {
    return NextResponse.json(
      { error: dup.status === 'ACTIVE' ? 'このメールの方は既にメンバーです' : '既に招待済みです' },
      { status: 409 }
    )
  }

  const token = randomBytes(24).toString('base64url')
  const member = await prisma.mensetsuMember.create({
    data: {
      organizationId: c.organizationId,
      role,
      status: 'PENDING',
      inviteEmail: email,
      inviteToken: token,
    },
    select: { id: true, role: true, status: true, inviteEmail: true },
  })

  // ⚠️ 外部向けリンクに VERCEL_URL を使わない（デプロイ保護でログイン画面に飛ぶ）
  const base = process.env.NEXTAUTH_URL || 'https://doya-ai.surisuta.jp'
  const url = `${base}/mensetsu/invite/${token}`

  const mail = await sendEmail({
    to: email,
    subject: `【ドヤ面接官】${c.organizationName} に招待されました`,
    html: `
      <div style="font-family:sans-serif;line-height:1.8;color:#0a0f3c">
        <p>${c.organizationName} の面接管理（ドヤ面接官）に招待されました。</p>
        <p>下のリンクを開いてログインすると参加できます。</p>
        <p><a href="${url}" style="color:#0066ff">${url}</a></p>
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
