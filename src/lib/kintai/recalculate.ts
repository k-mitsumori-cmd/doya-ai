import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { calculateDailyAttendance } from './attendance'

const JST_OFFSET_MS = 9 * 60 * 60 * 1000

export async function recalculateDayForEmployee(
  employeeId: string,
  organizationId: string,
  dateOnly: Date,
  db?: Prisma.TransactionClient
): Promise<import('@prisma/client').KintaiAttendance | null> {
  // 通常打刻・訂正承認からはロック取得済みのtxを受け取る。
  // 単独の再計算も同じ従業員ロックを取得し、読取から保存までを一体化する。
  if (!db) {
    return prisma.$transaction(async (tx) => {
      const employees = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM kintai_employees
        WHERE id = ${employeeId} AND "organizationId" = ${organizationId}
        FOR NO KEY UPDATE
      `
      if (employees.length !== 1) return null
      return recalculateDayForEmployee(employeeId, organizationId, dateOnly, tx)
    })
  }
  const jstDayStart = new Date(dateOnly.getTime() - JST_OFFSET_MS)
  const jstDayEnd = new Date(jstDayStart.getTime() + 86400000)

  const records = await db.kintaiClockRecord.findMany({
    where: { employeeId, timestamp: { gte: jstDayStart, lt: jstDayEnd } },
    orderBy: [{ timestamp: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  })

  if (records.length === 0) return null

  const employee = await db.kintaiEmployee.findUnique({
    where: { id: employeeId },
    include: { workRule: true },
  })

  let workRule = employee?.workRule ?? null
  if (!workRule) {
    workRule = await db.kintaiWorkRule.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    })
  }

  const result = calculateDailyAttendance(records, workRule, jstDayStart)
  const status = !result.clockOut ? 'clock_missing' : result.lateMinutes > 0 ? 'late' : 'normal'

  const updated = await db.kintaiAttendance.upsert({
    where: { employeeId_date: { employeeId, date: dateOnly } },
    update: {
      clockIn: result.clockIn,
      clockOut: result.clockOut,
      breakMinutes: result.breakMinutes,
      workMinutes: result.workMinutes,
      overtimeMinutes: result.overtimeMinutes,
      lateMinutes: result.lateMinutes,
      earlyLeaveMinutes: result.earlyLeaveMinutes,
      nightMinutes: result.nightMinutes,
      status,
    },
    create: {
      employeeId,
      date: dateOnly,
      clockIn: result.clockIn,
      clockOut: result.clockOut,
      breakMinutes: result.breakMinutes,
      workMinutes: result.workMinutes,
      overtimeMinutes: result.overtimeMinutes,
      lateMinutes: result.lateMinutes,
      earlyLeaveMinutes: result.earlyLeaveMinutes,
      nightMinutes: result.nightMinutes,
      status,
    },
  })

  return updated
}

export async function recalculateAllForOrganization(organizationId: string) {
  const attendances = await prisma.kintaiAttendance.findMany({
    where: {
      employee: { organizationId },
      clockIn: { not: null },
    },
    select: { employeeId: true, date: true },
  })

  let fixed = 0
  for (const att of attendances) {
    await recalculateDayForEmployee(att.employeeId, organizationId, att.date)
    fixed++
  }
  return fixed
}
