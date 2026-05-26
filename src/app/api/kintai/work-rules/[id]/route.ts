export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getKintaiContext, hasMinRole } from '@/lib/kintai/access'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const kctx = await getKintaiContext()
    if (!kctx || !hasMinRole(kctx.role, 'hr_admin')) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const p = 'then' in ctx.params ? await ctx.params : ctx.params
    const body = await req.json()

    const rule = await prisma.kintaiWorkRule.update({
      where: { id: p.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.workStart !== undefined && { workStart: body.workStart }),
        ...(body.workEnd !== undefined && { workEnd: body.workEnd }),
        ...(body.breakMinutes !== undefined && { breakMinutes: body.breakMinutes }),
        ...(body.overtimeCalcMethod !== undefined && { overtimeCalcMethod: body.overtimeCalcMethod }),
        ...(body.flexEnabled !== undefined && { flexEnabled: body.flexEnabled }),
        ...(body.coreStart !== undefined && { coreStart: body.coreStart || null }),
        ...(body.coreEnd !== undefined && { coreEnd: body.coreEnd || null }),
      },
    })

    return NextResponse.json({ rule })
  } catch (e) {
    console.error('[kintai/work-rules/[id] PATCH]', e)
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const kctx = await getKintaiContext()
    if (!kctx || !hasMinRole(kctx.role, 'hr_admin')) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const p = 'then' in ctx.params ? await ctx.params : ctx.params
    const empCount = await prisma.kintaiEmployee.count({ where: { workRuleId: p.id } })
    if (empCount > 0) {
      return NextResponse.json({ error: '使用中の従業員がいるため削除できません' }, { status: 400 })
    }

    await prisma.kintaiWorkRule.delete({ where: { id: p.id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[kintai/work-rules/[id] DELETE]', e)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}
