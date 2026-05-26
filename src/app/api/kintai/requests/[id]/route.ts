export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getKintaiContext, hasMinRole } from '@/lib/kintai/access'
import { calculateDailyAttendance } from '@/lib/kintai/attendance'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const kctx = await getKintaiContext()
    if (!kctx) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const p = 'then' in ctx.params ? await ctx.params : ctx.params
    const request = await prisma.kintaiRequest.findUnique({
      where: { id: p.id },
      include: {
        employee: { select: { name: true, email: true } },
        reviewer: { select: { name: true } },
      },
    })

    if (!request) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
    return NextResponse.json({ request })
  } catch (e) {
    console.error('[kintai/requests/[id] GET]', e)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const kctx = await getKintaiContext()
    if (!kctx) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const p = 'then' in ctx.params ? await ctx.params : ctx.params
    const body = await req.json()
    const { status, reviewerComment } = body

    const existing = await prisma.kintaiRequest.findUnique({ where: { id: p.id } })
    if (!existing) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

    if (status === 'withdrawn') {
      if (existing.employeeId !== kctx.employeeId) {
        return NextResponse.json({ error: '自分の申請のみ取下げできます' }, { status: 403 })
      }
      if (existing.status !== 'pending') {
        return NextResponse.json({ error: '承認待ちの申請のみ取下げできます' }, { status: 400 })
      }
    } else if (status === 'approved' || status === 'rejected') {
      if (!hasMinRole(kctx.role, 'manager')) {
        return NextResponse.json({ error: '承認権限がありません' }, { status: 403 })
      }
    }

    const updated = await prisma.kintaiRequest.update({
      where: { id: p.id },
      data: {
        status,
        ...(status === 'approved' || status === 'rejected'
          ? { reviewerId: kctx.employeeId, reviewedAt: new Date(), reviewerComment: reviewerComment || null }
          : {}),
      },
    })

    if (status === 'approved' && existing.type === 'clock_fix') {
      await applyClockFix(existing.employeeId, existing.details as any)
    }

    return NextResponse.json({ request: updated })
  } catch (e) {
    console.error('[kintai/requests/[id] PATCH]', e)
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }
}

async function applyClockFix(employeeId: string, details: { date?: string; clockType?: string; correctedTime?: string }) {
  if (!details?.date || !details?.clockType || !details?.correctedTime) return

  const dateObj = new Date(details.date + 'T00:00:00+09:00')
  const dayEnd = new Date(dateObj.getTime() + 86400000)

  const [h, m] = details.correctedTime.split(':').map(Number)
  const correctedTimestamp = new Date(dateObj)
  correctedTimestamp.setHours(h, m, 0, 0)

  const existingRecord = await prisma.kintaiClockRecord.findFirst({
    where: { employeeId, type: details.clockType, timestamp: { gte: dateObj, lt: dayEnd } },
  })

  if (existingRecord) {
    await prisma.kintaiClockRecord.update({
      where: { id: existingRecord.id },
      data: {
        originalTimestamp: existingRecord.timestamp,
        timestamp: correctedTimestamp,
        isModified: true,
      },
    })
  } else {
    await prisma.kintaiClockRecord.create({
      data: {
        employeeId,
        type: details.clockType,
        timestamp: correctedTimestamp,
        source: 'manual',
        isModified: true,
      },
    })
  }

  const allRecords = await prisma.kintaiClockRecord.findMany({
    where: { employeeId, timestamp: { gte: dateObj, lt: dayEnd } },
    orderBy: { timestamp: 'asc' },
  })

  const employee = await prisma.kintaiEmployee.findUnique({
    where: { id: employeeId },
    include: { workRule: true },
  })

  const calc = calculateDailyAttendance(allRecords, employee?.workRule || null, dateObj)

  await prisma.kintaiAttendance.upsert({
    where: { employeeId_date: { employeeId, date: dateObj } },
    create: {
      employeeId,
      date: dateObj,
      clockIn: calc.clockIn,
      clockOut: calc.clockOut,
      breakMinutes: calc.breakMinutes,
      workMinutes: calc.workMinutes,
      overtimeMinutes: calc.overtimeMinutes,
      lateMinutes: calc.lateMinutes,
      earlyLeaveMinutes: calc.earlyLeaveMinutes,
      nightMinutes: calc.nightMinutes,
      status: 'normal',
    },
    update: {
      clockIn: calc.clockIn,
      clockOut: calc.clockOut,
      breakMinutes: calc.breakMinutes,
      workMinutes: calc.workMinutes,
      overtimeMinutes: calc.overtimeMinutes,
      lateMinutes: calc.lateMinutes,
      earlyLeaveMinutes: calc.earlyLeaveMinutes,
      nightMinutes: calc.nightMinutes,
    },
  })
}
