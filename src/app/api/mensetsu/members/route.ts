import { withToolSeatInvitation, ToolSeatInvitationDomainError, toolSeatInvitationFailure } from '@/lib/pricing-v2/tool-seat-invitation.server'
import { privateApiJson } from '@/lib/private-api-response'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET  /api/mensetsu/members — メンバー一覧
// POST /api/mensetsu/members — メンバーを招待（F5-1）
//
// 組織スコープのサービスなのに招待の導線が無く、実質1人でしか使えなかったため追加。
import { randomBytes } from 'crypto'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMensetsuContext, hasMinRole, orgSlugFrom } from '@/lib/mensetsu/access'
import { sendEmail } from '@/lib/email'
import { escapeHtml } from '@/lib/html-escape'
import { ROLE_HIERARCHY, type MensetsuRole } from '@/lib/mensetsu/types'
import { lowerToolRole } from '@/lib/company-roles/tool-roles'

const ROLES: MensetsuRole[] = ['owner', 'admin', 'manager', 'member']
const INVITE_TTL_MS = 48 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  const c = await getMensetsuContext(orgSlugFrom(req))
  if (!c) return privateApiJson({ error: '組織が見つかりません' }, { status: 401 })

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
  return privateApiJson({ members, myRole: c.role, myUserId: c.userId })
}

export async function POST(req: NextRequest) {
  const c = await getMensetsuContext(orgSlugFrom(req))
  if (!c) return privateApiJson({ error: '組織が見つかりません' }, { status: 401 })
  if (!hasMinRole(c.role, 'admin')) {
    return privateApiJson({ error: 'メンバーを招待する権限がありません' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const email = String(body?.email || '').trim().toLowerCase()
  const requestedRole = body?.role
  if (requestedRole !== undefined && !ROLES.includes(requestedRole)) {
    return privateApiJson({ error: '招待権限の形式が正しくありません' }, { status: 400 })
  }
  const role = (requestedRole ?? 'member') as MensetsuRole

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return privateApiJson({ error: 'メールアドレスの形式が正しくありません' }, { status: 400 })
  }
  // ⚠️ 自分より上の権限は与えられない（権限の昇格を防ぐ）
  if (ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[c.role]) {
    return privateApiJson({ error: '自分と同じか上の権限は付与できません' }, { status: 403 })
  }
  // owner は組織にひとりだけ。招待では付与しない
  if (role === 'owner') {
    return privateApiJson({ error: 'オーナー権限は招待では付与できません' }, { status: 400 })
  }

  const token = randomBytes(24).toString('base64url')
  let result
  try {
    result = await withToolSeatInvitation({ tool: 'mensetsu', organizationId: c.organizationId, actorUserId: c.userId, email }, async (tx, currentCeiling) => {
      const currentCompanyRole = currentCeiling ? lowerToolRole('mensetsu', currentCeiling, c.role) : null
      if (!currentCompanyRole || !hasMinRole(currentCompanyRole, 'admin')) throw new ToolSeatInvitationDomainError('forbidden')
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM mensetsu_organizations WHERE id = ${c.organizationId} FOR UPDATE`
      if (rows.length === 0) throw new ToolSeatInvitationDomainError('missing')
      const actor = await tx.$queryRaw<{ role: MensetsuRole }[]>`SELECT role FROM mensetsu_members
        WHERE "organizationId" = ${c.organizationId} AND "userId" = ${c.userId}
        AND status = 'ACTIVE' AND role IN ('owner', 'admin') FOR UPDATE`
      // 会社の役割の上限（ctx の役割）より上には上げない
      const actorRole = actor.length ? lowerToolRole('mensetsu', actor[0].role, currentCompanyRole) : null
      if (!actorRole || ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[actorRole as MensetsuRole]) throw new ToolSeatInvitationDomainError('forbidden')
      return { role: actorRole, value: undefined }
    }, async tx => {
      const cutoff = new Date(Date.now() - INVITE_TTL_MS)
      const duplicate = await tx.mensetsuMember.findFirst({
        where: { organizationId: c.organizationId, inviteEmail: email, OR: [{ status: 'ACTIVE' }, { status: 'PENDING', createdAt: { gt: cutoff } }] },
        select: { status: true },
      })
      if (duplicate) return { kind: 'duplicate' as const, status: duplicate.status }
      await tx.mensetsuMember.deleteMany({ where: { organizationId: c.organizationId, inviteEmail: email, status: 'PENDING', createdAt: { lte: cutoff } } })
      const member = await tx.mensetsuMember.create({
        data: { organizationId: c.organizationId, role, status: 'PENDING', inviteEmail: email, inviteToken: token },
        select: { id: true, role: true, status: true, inviteEmail: true },
      })
      return { kind: 'created' as const, member }
    })
  } catch (error) {
    const seatFailure = toolSeatInvitationFailure(error)
    if (seatFailure) return privateApiJson(seatFailure.body, { status: seatFailure.status })
    return privateApiJson({ error: '招待を作成できませんでした。再試行してください' }, { status: 409 })
  }
  if (result.kind === 'duplicate') return privateApiJson({ error: result.status === 'ACTIVE' ? 'このメールの方は既にメンバーです' : '既に招待済みです' }, { status: 409 })
  const member = result.member

  // ⚠️ 外部向けリンクに VERCEL_URL を使わない（デプロイ保護でログイン画面に飛ぶ）
  const base = process.env.NEXTAUTH_URL || 'https://doya-ai.surisuta.jp'
  const url = `${base}/mensetsu/invite/${token}`

  const mail = await sendEmail({
    to: email,
    subject: `【ドヤ面接官】${c.organizationName} に招待されました`,
    html: `
      <div style="font-family:sans-serif;line-height:1.8;color:#0a0f3c">
        <p>${escapeHtml(c.organizationName)} の面接管理（ドヤ面接官）に招待されました。</p>
        <p>下のリンクを開いてログインすると参加できます（有効期限は48時間です）。</p>
        <p><a href="${escapeHtml(url)}" style="color:#0066ff">${escapeHtml(url)}</a></p>
        <p style="color:#8a94ad;font-size:13px">
          このリンクはあなた専用です。他の方に転送しないでください。<br>
          心当たりがない場合は破棄してください。
        </p>
      </div>`,
  })

  return privateApiJson({
    member,
    // メール送信に失敗しても招待自体は作る（URLを手で渡せるように返す）
    url,
    emailSent: mail.success,
  })
}
