export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getKintaiContext, hasMinRole } from '@/lib/kintai/access'
import { lockKintaiEmployeeAdmission } from '@/lib/kintai/employee-admission'
import { lockCurrentKintaiManager } from '@/lib/kintai/manager-admission'

export async function GET() {
  try {
    const ctx = await getKintaiContext()
    if (!ctx) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const rules = await prisma.kintaiWorkRule.findMany({
      where: { organizationId: ctx.organizationId },
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ rules })
  } catch (e) {
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

    const body = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: '入力内容が正しくありません' }, { status: 400 })
    }
    return await prisma.$transaction(async (tx) => {
      await lockKintaiEmployeeAdmission(tx, ctx.organizationId)
      if (!(await lockCurrentKintaiManager(tx, ctx))) {
        return NextResponse.json({ error: '権限がありません' }, { status: 403 })
      }
      const rule = await tx.kintaiWorkRule.create({
        data: {
          organizationId: ctx.organizationId,
          name: body.name || '新規ルール',
          workStart: body.workStart || '09:00',
          workEnd: body.workEnd || '18:00',
          breakMinutes: body.breakMinutes ?? 60,
          overtimeCalcMethod: body.overtimeCalcMethod || 'daily',
          flexEnabled: body.flexEnabled || false,
          coreStart: body.coreStart || null,
          coreEnd: body.coreEnd || null,
        },
      })
      return NextResponse.json({ rule }, { status: 201 })
    })
  } catch (e) {
    console.error('[kintai/work-rules POST]')
    return NextResponse.json({ error: '作成に失敗しました' }, { status: 500 })
  }
}
