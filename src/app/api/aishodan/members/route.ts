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
import { withLifecycleOrganizationWrite } from '@/lib/account-lifecycle/organization-fence'
import { LifecycleError } from '@/lib/account-lifecycle/state'
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
  return NextResponse.json({ members, myRole: c.role, myUserId: c.userId }, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
}

export async function POST(req: NextRequest) {
  const c = await getAishodanContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  if (!hasMinRole(c.role, 'admin')) {
    return NextResponse.json({ error: 'メンバーを招待する権限がありません' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.email !== 'string') {
    return NextResponse.json({ error: '\u30e1\u30fc\u30eb\u30a2\u30c9\u30ec\u30b9\u306e\u5f62\u5f0f\u304c\u6b63\u3057\u304f\u3042\u308a\u307e\u305b\u3093' }, { status: 400 })
  }
  const email = body.email.trim().toLowerCase()
  const requestedRole = body?.role
  if (requestedRole !== undefined && !ROLES.includes(requestedRole)) {
    return NextResponse.json({ error: '招待権限の形式が正しくありません' }, { status: 400 })
  }
  const role = (requestedRole ?? 'member') as AishodanRole

  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'メールアドレスの形式が正しくありません' }, { status: 400 })
  }
  // ⚠️ 自分より上の権限は与えられない（権限の昇格を防ぐ）
  if (ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[c.role]) {
    return NextResponse.json({ error: '自分と同じか上の権限は付与できません' }, { status: 403 })
  }
  // owner は組織にひとりだけ。招待では付与しない
  if (role === 'owner') {
    return NextResponse.json({ error: 'オーナー権限は招待では付与できません' }, { status: 400 })
  }

  // Check duplicates with current actor/owner authority before inspecting the
  // recipient's retirement state. Duplicate responses do not disclose it.
  const probeDuplicate = () => withLifecycleOrganizationWrite(prisma, {
    service: 'aishodan', organizationId: c.organizationId, actorUserId: c.userId, access: 'member',
    targetMemberIds: [], targetUserIds: [], targetEmails: [], grantsAuthority: false,
    pendingClaimUserId: null, repairsUnknownTargetRole: false,
  }, async tx => {
    const actor = await tx.$queryRaw<{ role: AishodanRole }[]>`SELECT role FROM aishodan_members
      WHERE "organizationId" = ${c.organizationId} AND "userId" = ${c.userId}
      AND status = 'ACTIVE' AND role IN ('owner', 'admin') FOR UPDATE`
    if (!actor.length || ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[actor[0].role]) return { kind: 'forbidden' as const }
    const duplicate = await tx.aishodanMember.findFirst({
      where: { organizationId: c.organizationId, inviteEmail: email, OR: [{ status: 'ACTIVE' }, { status: 'PENDING', createdAt: { gt: new Date(Date.now() - INVITE_TTL_MS) } }] },
      select: { status: true },
    })
    return duplicate ? { kind: 'duplicate' as const, status: duplicate.status } : { kind: 'none' as const }
  })
  const duplicateResponse = (status: string) => NextResponse.json({ error: status === 'ACTIVE' ? 'このメールの方は既にメンバーです' : '既に招待済みです' }, { status: 409 })
  const token = randomBytes(24).toString('base64url')
  let result
  try {
    const previous = await probeDuplicate()
    if (previous.kind === 'forbidden') return NextResponse.json({ error: 'メンバーを招待する権限がありません。再読み込みしてください' }, { status: 403 })
    if (previous.kind === 'duplicate') return duplicateResponse(previous.status)
    result = await withLifecycleOrganizationWrite(prisma, {
      service: 'aishodan', organizationId: c.organizationId, actorUserId: c.userId, access: 'member',
      targetMemberIds: [], targetUserIds: [], targetEmails: [email], grantsAuthority: false,
      pendingClaimUserId: null, repairsUnknownTargetRole: false,
    }, async (tx) => {
      const actor = await tx.$queryRaw<{ role: AishodanRole }[]>`SELECT role FROM aishodan_members
        WHERE "organizationId" = ${c.organizationId} AND "userId" = ${c.userId}
        AND status = 'ACTIVE' AND role IN ('owner', 'admin') FOR UPDATE`
      if (!actor.length || ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[actor[0].role]) return { kind: 'forbidden' as const }
      const cutoff = new Date(Date.now() - INVITE_TTL_MS)
      const duplicate = await tx.aishodanMember.findFirst({
        where: { organizationId: c.organizationId, inviteEmail: email, OR: [{ status: 'ACTIVE' }, { status: 'PENDING', createdAt: { gt: cutoff } }] },
        select: { status: true },
      })
      if (duplicate) return { kind: 'duplicate' as const, status: duplicate.status }
      const boundExpired = await tx.aishodanMember.findFirst({
        where: { organizationId: c.organizationId, inviteEmail: email, status: 'PENDING', createdAt: { lte: cutoff }, userId: { not: null } },
        select: { id: true },
      })
      if (boundExpired) return { kind: 'unavailable' as const }
      await tx.aishodanMember.deleteMany({ where: { organizationId: c.organizationId, inviteEmail: email, status: 'PENDING', userId: null, createdAt: { lte: cutoff } } })
      const member = await tx.aishodanMember.create({
        data: { organizationId: c.organizationId, role, status: 'PENDING', inviteEmail: email, inviteToken: token },
        select: { id: true, role: true, status: true, inviteEmail: true },
      })
      return { kind: 'created' as const, member }
    })
  } catch (error) {
    if (error instanceof LifecycleError) {
      if (error.code === 'ACCOUNT_RETIREMENT_IN_PROGRESS' || error.code === 'LIFECYCLE_STATE_UNAVAILABLE') {
        try {
          const previous = await probeDuplicate()
          if (previous.kind === 'duplicate') return duplicateResponse(previous.status)
        } catch { /* retain the original lifecycle denial */ }
      }
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
    }
    return NextResponse.json({ error: '招待を作成できませんでした。再試行してください' }, { status: 409 })
  }
  if (result.kind === 'unavailable') return NextResponse.json({ error: '招待の状態を確認できません。管理者にお問い合わせください' }, { status: 409 })
  if (result.kind === 'forbidden') return NextResponse.json({ error: 'メンバーを招待する権限がありません。再読み込みしてください' }, { status: 403 })
  if (result.kind === 'duplicate') return duplicateResponse(result.status)
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
  }, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
}
