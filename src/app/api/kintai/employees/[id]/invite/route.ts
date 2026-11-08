import type { Prisma } from '@prisma/client'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { privateApiJson } from '@/lib/private-api-response'
import { ceilToolRole } from '@/lib/company-roles/access.server'
import { lowerToolRole } from '@/lib/company-roles/tool-roles'
import { withToolSeatAdmission, ToolSeatAdmissionError } from '@/lib/pricing-v2/tool-seat-admission.server'
import { ToolSeatInvitationDomainError, toolSeatInvitationFailure } from '@/lib/pricing-v2/tool-seat-invitation.server'
import { prisma } from '@/lib/prisma'
import { escapeHtml } from '@/lib/html-escape'
import { getKintaiContext, hasMinRole } from '@/lib/kintai/access'
import { lockKintaiEmployeeAdmission } from '@/lib/kintai/employee-admission'
import { lockCurrentKintaiManager } from '@/lib/kintai/manager-admission'
import { sendEmail } from '@/lib/email'
import { createKintaiInviteToken } from '@/lib/kintai/invite-token'

type Ctx = { params: Promise<{ id: string }> }
type InviteEmployee = Prisma.KintaiEmployeeGetPayload<{ include: { member: true } }>
type InviteDenied = { kind: 'missing' } | { kind: 'forbidden' } | { kind: 'no-email' } | { kind: 'not-invitable' }
type InviteDomain = InviteDenied | { kind: 'eligible'; employee: InviteEmployee }
type InviteResult = InviteDenied | { kind: 'created'; employee: InviteEmployee } | { kind: 'changed' }

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const kctx = await getKintaiContext()
    if (!kctx || !hasMinRole(kctx.role, 'hr_admin')) {
      return privateApiJson({ error: '権限がありません' }, { status: 403 })
    }

    const p = await ctx.params

    const hint = await prisma.kintaiEmployee.findFirst({
      where: { id: p.id, organizationId: kctx.organizationId }, select: { email: true },
    })
    const recipients = hint?.email ? await prisma.user.findMany({ where: { email: { equals: hint.email.trim(), mode: 'insensitive' } }, select: { id: true }, take: 2 }) : []
    if (recipients.length > 1) throw new ToolSeatAdmissionError(503, 'SEAT_CAPACITY_UNAVAILABLE', 'retry')
    const token = createKintaiInviteToken()
    const admission = await withToolSeatAdmission<InviteResult, InviteDomain>({ tool: 'kintai', organizationId: kctx.organizationId, actorUserId: kctx.userId, additionalUserIds: recipients.map(user => user.id) }, async tx => {
      const ceiling = await ceilToolRole({ tool: 'kintai', organizationId: kctx.organizationId, userId: kctx.userId, toolRole: 'system_admin' }, tx)
      await lockKintaiEmployeeAdmission(tx, kctx.organizationId)
      const limitedRole = ceiling ? lowerToolRole('kintai', kctx.role, ceiling) : null
      const actorRole = limitedRole ? await lockCurrentKintaiManager(tx, { ...kctx, role: limitedRole as typeof kctx.role }) : null
      if (!actorRole) throw new ToolSeatInvitationDomainError('forbidden')
      const employee = await tx.kintaiEmployee.findFirst({
        where: { id: p.id, organizationId: kctx.organizationId }, include: { member: true },
      })
      if (!employee) return { role: actorRole, value: { kind: 'missing' as const } }
      if (employee.email !== hint?.email) throw new ToolSeatAdmissionError(409, 'SEAT_CONTEXT_CHANGED', 'retry')
      const currentRecipients = employee.email ? await tx.user.findMany({ where: { email: { equals: employee.email.trim(), mode: 'insensitive' } }, select: { id: true }, take: 2 }) : []
      if (currentRecipients.length !== recipients.length || currentRecipients.some(user => !recipients.some(hintUser => hintUser.id === user.id))) throw new ToolSeatAdmissionError(409, 'SEAT_CONTEXT_CHANGED', 'retry')
      // Reissuing a system-admin role remains limited to a current system admin.
      if (employee.member?.role === 'system_admin' && actorRole !== 'system_admin') return { role: actorRole, value: { kind: 'forbidden' as const } }
      if (!employee.email) return { role: actorRole, value: { kind: 'no-email' as const } }
      if (!employee.isActive || !employee.member || !['PENDING', 'INACTIVE'].includes(employee.member.status)) return { role: actorRole, value: { kind: 'not-invitable' as const } }
      return { role: actorRole, value: { kind: 'eligible' as const, employee } }
    }, async (tx, current) => {
      if (current.kind !== 'eligible') return current
      const employee = current.employee
      const updated = await tx.kintaiMember.updateMany({
        where: { id: employee.member!.id, organizationId: kctx.organizationId, status: employee.member!.status, inviteToken: employee.member!.inviteToken },
        data: { inviteToken: token, inviteEmail: employee.email, status: 'PENDING' },
      })
      return updated.count === 1 ? { kind: 'created' as const, employee } : { kind: 'changed' as const }
    })
    if (admission.kind === 'forbidden') {
      return privateApiJson({ error: '権限がありません' }, { status: 403 })
    }
    if (admission.kind === 'missing') {
      return privateApiJson({ error: '従業員が見つかりません' }, { status: 404 })
    }
    if (admission.kind === 'no-email') {
      return privateApiJson({ error: 'メールアドレスが設定されていません' }, { status: 400 })
    }
    if (admission.kind === 'not-invitable') {
      return privateApiJson({ error: '招待できるのは未参加の有効な従業員のみです' }, { status: 409 })
    }
    if (admission.kind === 'changed') {
      return privateApiJson({ error: '招待状態が変更されました。画面を更新して再度お試しください' }, { status: 409 })
    }
    const employee = admission.employee

    const baseUrl = process.env.NEXTAUTH_URL || 'https://doya-ai.surisuta.jp'
    const inviteUrl = `${baseUrl}/kintai/invite/${token}`

    // 組織名を取得
    const org = await prisma.kintaiOrganization.findUnique({
      where: { id: kctx.organizationId },
      select: { name: true },
    })

    // 招待メール送信
    const emailResult = await sendEmail({
      to: employee.email,
      subject: `【ドヤ勤怠】${org?.name || '組織'}への招待`,
      html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; width: 48px; height: 48px; border-radius: 16px; background: linear-gradient(135deg, #7f19e6, #5b0fb3); color: white; line-height: 48px; font-size: 20px; font-weight: bold;">⏰</div>
          </div>
          <h1 style="text-align: center; font-size: 24px; font-weight: 800; color: #1e293b; margin-bottom: 8px;">ドヤ勤怠への招待</h1>
          <p style="text-align: center; color: #64748b; font-size: 15px; margin-bottom: 24px;">
            <strong style="color: #7f19e6;">${escapeHtml(org?.name || '組織')}</strong> に招待されました
          </p>
          <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
            ${escapeHtml(employee.name)} さん、こんにちは！<br>
            以下のボタンをクリックして、ドヤ勤怠に参加してください。
          </p>
          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${escapeHtml(inviteUrl)}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #7f19e6, #5b0fb3); color: white; text-decoration: none; border-radius: 999px; font-weight: 700; font-size: 16px;">
              組織に参加する
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">
            このリンクは本人のみ使用できます。心当たりのない場合は無視してください。
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #cbd5e1; font-size: 11px; text-align: center;">ドヤ勤怠 by ドヤAI</p>
        </div>
      `,
      tags: [{ name: 'service', value: 'kintai-invite' }],
    })

    return privateApiJson({
      inviteUrl,
      token,
      email: employee.email,
      name: employee.name,
      emailSent: emailResult.success,
    })
  } catch (e) {
    const failure = toolSeatInvitationFailure(e)
    if (failure) return privateApiJson(failure.body, { status: failure.status })
    console.error('[kintai/employees/[id]/invite POST]')
    return privateApiJson({ error: '招待リンクの作成に失敗しました' }, { status: 500 })
  }
}
