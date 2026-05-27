export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getKintaiContext, hasMinRole } from '@/lib/kintai/access'

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

    return NextResponse.json({
      inviteUrl,
      token,
      email: employee.email,
      name: employee.name,
    })
  } catch (e) {
    console.error('[kintai/employees/[id]/invite POST]', e)
    return NextResponse.json({ error: '招待リンクの作成に失敗しました' }, { status: 500 })
  }
}
