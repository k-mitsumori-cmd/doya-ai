export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getKintaiContext, hasMinRole } from '@/lib/kintai/access'
import { lockKintaiEmployeeAdmission } from '@/lib/kintai/employee-admission'
import { lockCurrentKintaiManager } from '@/lib/kintai/manager-admission'
import { validateKintaiWorkRuleInput } from '@/lib/kintai/work-rule-input'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const kctx = await getKintaiContext()
    if (!kctx || !hasMinRole(kctx.role, 'hr_admin')) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const p = await ctx.params

    const body = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: '入力内容が正しくありません' }, { status: 400 })
    }
    const inputError = validateKintaiWorkRuleInput(body)
    if (inputError) return NextResponse.json({ error: inputError }, { status: 400 })
    return await prisma.$transaction(async (tx) => {
      await lockKintaiEmployeeAdmission(tx, kctx.organizationId)
      if (!(await lockCurrentKintaiManager(tx, kctx))) {
        return NextResponse.json({ error: '権限がありません' }, { status: 403 })
      }
      const existing = await tx.kintaiWorkRule.findFirst({
        where: { id: p.id, organizationId: kctx.organizationId },
      })
      if (!existing) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
      const rule = await tx.kintaiWorkRule.update({
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
    })
  } catch (e) {
    console.error('[kintai/work-rules/[id] PATCH]')
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const kctx = await getKintaiContext()
    if (!kctx || !hasMinRole(kctx.role, 'hr_admin')) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const p = await ctx.params

    return await prisma.$transaction(async (tx) => {
      await lockKintaiEmployeeAdmission(tx, kctx.organizationId)
      if (!(await lockCurrentKintaiManager(tx, kctx))) {
        return NextResponse.json({ error: '権限がありません' }, { status: 403 })
      }
      const existingRule = await tx.kintaiWorkRule.findFirst({
        where: { id: p.id, organizationId: kctx.organizationId },
      })
      if (!existingRule) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
      const empCount = await tx.kintaiEmployee.count({ where: { workRuleId: p.id, organizationId: kctx.organizationId } })
      if (empCount > 0) {
        return NextResponse.json({ error: '使用中の従業員がいるため削除できません' }, { status: 400 })
      }
      await tx.kintaiWorkRule.delete({ where: { id: p.id } })
      return NextResponse.json({ success: true })
    })
  } catch (e) {
    console.error('[kintai/work-rules/[id] DELETE]')
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}
