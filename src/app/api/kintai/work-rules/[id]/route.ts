export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getKintaiContext, hasMinRole } from '@/lib/kintai/access'
import { lockKintaiEmployeeAdmission } from '@/lib/kintai/employee-admission'
import { lockCurrentKintaiManager } from '@/lib/kintai/manager-admission'
import { validateKintaiWorkRuleInput, validateKintaiWorkRuleSchedule } from '@/lib/kintai/work-rule-input'
import { workRuleExpectedRevision, assertKintaiWorkRuleRevision, advanceKintaiWorkRuleRevision, KintaiWorkRuleRevisionError } from '@/lib/kintai/work-rule-revision'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const kctx = await getKintaiContext()
    if (!kctx || !hasMinRole(kctx.role, 'hr_admin')) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const p = await ctx.params

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: '入力内容が正しくありません' }, { status: 400 })
    }
    if (body.organizationId !== undefined && body.organizationId !== kctx.organizationId) return NextResponse.json({ error: '組織が切り替わっています。最新の画面を開き直してください。' }, { status: 409 })
    const inputError = validateKintaiWorkRuleInput(body)
    if (inputError) return NextResponse.json({ error: inputError }, { status: 400 })
    const expectedRevision = workRuleExpectedRevision(body.expectedRevision)
    return await prisma.$transaction(async (tx) => {
      await lockKintaiEmployeeAdmission(tx, kctx.organizationId)
      if (!(await lockCurrentKintaiManager(tx, kctx))) {
        return NextResponse.json({ error: '権限がありません' }, { status: 403 })
      }
      const existing = await tx.kintaiWorkRule.findFirst({
        where: { id: p.id, organizationId: kctx.organizationId },
      })
      if (!existing) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
      await assertKintaiWorkRuleRevision(tx, existing, expectedRevision)
      const scheduleError = validateKintaiWorkRuleSchedule({ ...existing, ...body })
      if (scheduleError) return NextResponse.json({ error: scheduleError }, { status: 400 })
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
      return NextResponse.json({ rule: await advanceKintaiWorkRuleRevision(tx, rule) })
    })
  } catch (e) {
    if (e instanceof KintaiWorkRuleRevisionError) return NextResponse.json({ error: e.message }, { status: e.status })
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

    const expectedValues = new URL(req.url).searchParams.getAll('expectedRevision')
    if (expectedValues.length > 1) return NextResponse.json({ error: '就業ルールの版の指定が正しくありません。' }, { status: 400 })
    const expectedRevision = workRuleExpectedRevision(expectedValues[0])
    const expectedOrganizations = new URL(req.url).searchParams.getAll('organizationId')
    if (expectedOrganizations.length > 1 || expectedOrganizations.length === 1 && expectedOrganizations[0] !== kctx.organizationId) return NextResponse.json({ error: '組織が切り替わっています。最新の画面を開き直してください。' }, { status: 409 })
    return await prisma.$transaction(async (tx) => {
      await lockKintaiEmployeeAdmission(tx, kctx.organizationId)
      if (!(await lockCurrentKintaiManager(tx, kctx))) {
        return NextResponse.json({ error: '権限がありません' }, { status: 403 })
      }
      const existingRule = await tx.kintaiWorkRule.findFirst({
        where: { id: p.id, organizationId: kctx.organizationId },
      })
      if (!existingRule) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
      await assertKintaiWorkRuleRevision(tx, existingRule, expectedRevision)
      const empCount = await tx.kintaiEmployee.count({ where: { workRuleId: p.id, organizationId: kctx.organizationId } })
      if (empCount > 0) {
        return NextResponse.json({ error: '使用中の従業員がいるため削除できません' }, { status: 400 })
      }
      await tx.kintaiWorkRule.delete({ where: { id: p.id } })
      return NextResponse.json({ success: true })
    })
  } catch (e) {
    if (e instanceof KintaiWorkRuleRevisionError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('[kintai/work-rules/[id] DELETE]')
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}
