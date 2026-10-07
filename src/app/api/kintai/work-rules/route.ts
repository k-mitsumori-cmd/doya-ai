export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getKintaiContext, hasMinRole } from '@/lib/kintai/access'
import { lockKintaiEmployeeAdmission } from '@/lib/kintai/employee-admission'
import { lockCurrentKintaiManager } from '@/lib/kintai/manager-admission'
import { validateKintaiWorkRuleInput } from '@/lib/kintai/work-rule-input'
import { withKintaiWorkRuleRevision, withKintaiWorkRuleRevisions, advanceKintaiWorkRuleRevision, KintaiWorkRuleRevisionError } from '@/lib/kintai/work-rule-revision'
import { createKintaiWorkRuleOnce, kintaiWorkRuleOperationId, KintaiWorkRuleOperationError } from '@/lib/kintai/work-rule-operation'

export async function GET() {
  try {
    const ctx = await getKintaiContext()
    if (!ctx) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const rules = await prisma.kintaiWorkRule.findMany({
      where: { organizationId: ctx.organizationId },
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ rules: await withKintaiWorkRuleRevisions(prisma, rules), organizationId: ctx.organizationId })
  } catch (e) {
    if (e instanceof KintaiWorkRuleRevisionError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('[kintai/work-rules GET]')
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getKintaiContext()
    if (!ctx || !hasMinRole(ctx.role, 'hr_admin')) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: '入力内容が正しくありません' }, { status: 400 })
    }
    const inputError = validateKintaiWorkRuleInput(body)
    if (inputError) return NextResponse.json({ error: inputError }, { status: 400 })
    const operationId = kintaiWorkRuleOperationId(body.operationId)
    if (body.organizationId !== ctx.organizationId) return NextResponse.json({ error: '組織が切り替わっています。最新の画面を開き直してください。' }, { status: 409 })
    return await prisma.$transaction(async (tx) => {
      await lockKintaiEmployeeAdmission(tx, ctx.organizationId)
      if (!(await lockCurrentKintaiManager(tx, ctx))) {
        return NextResponse.json({ error: '権限がありません' }, { status: 403 })
      }
      const data = {
        organizationId: ctx.organizationId,
        name: body.name || '新規ルール', workStart: body.workStart || '09:00', workEnd: body.workEnd || '18:00',
        breakMinutes: body.breakMinutes ?? 60, overtimeCalcMethod: body.overtimeCalcMethod || 'daily',
        flexEnabled: body.flexEnabled || false, coreStart: body.coreStart || null, coreEnd: body.coreEnd || null,
      }
      const rule = await createKintaiWorkRuleOnce(tx, ctx, operationId, data,
        async id => { const row = await tx.kintaiWorkRule.findFirst({ where: { id, organizationId: ctx.organizationId } }); return row ? withKintaiWorkRuleRevision(tx, row) : null },
        async () => advanceKintaiWorkRuleRevision(tx, await tx.kintaiWorkRule.create({ data })))
      return NextResponse.json({ rule, operationId }, { status: 201 })
    })
  } catch (e) {
    if (e instanceof KintaiWorkRuleOperationError || e instanceof KintaiWorkRuleRevisionError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('[kintai/work-rules POST]')
    return NextResponse.json({ error: '作成に失敗しました' }, { status: 500 })
  }
}
