export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getKintaiContext, hasMinRole } from '@/lib/kintai/access'
import { sendEmail } from '@/lib/email'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const kctx = await getKintaiContext()
    if (!kctx || !hasMinRole(kctx.role, 'hr_admin')) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const p = 'then' in ctx.params ? await ctx.params : ctx.params

    const employee = await prisma.kintaiEmployee.findFirst({
      where: { id: p.id, organizationId: kctx.organizationId },
      include: { member: true },
    })
    if (!employee) {
      return NextResponse.json({ error: '従業員が見つかりません' }, { status: 404 })
    }
    if (!employee.email) {
      return NextResponse.json({ error: 'メールアドレスが設定されていません' }, { status: 400 })
    }

    const token = crypto.randomUUID()
    await prisma.kintaiMember.update({
      where: { id: employee.member!.id },
      data: {
        inviteToken: token,
        inviteEmail: employee.email,
        status: 'PENDING',
      },
    })

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
            <strong style="color: #7f19e6;">${org?.name || '組織'}</strong> に招待されました
          </p>
          <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
            ${employee.name} さん、こんにちは！<br>
            以下のボタンをクリックして、ドヤ勤怠に参加してください。
          </p>
          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${inviteUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #7f19e6, #5b0fb3); color: white; text-decoration: none; border-radius: 999px; font-weight: 700; font-size: 16px;">
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

    return NextResponse.json({
      inviteUrl,
      token,
      email: employee.email,
      name: employee.name,
      emailSent: emailResult.success,
    })
  } catch (e) {
    console.error('[kintai/employees/[id]/invite POST]', e)
    return NextResponse.json({ error: '招待リンクの作成に失敗しました' }, { status: 500 })
  }
}
