import { prisma } from '@/lib/prisma'
import { calculateDailyAttendance } from './attendance'

const JST_OFFSET_MS = 9 * 60 * 60 * 1000

export async function recalculateDayForEmployee(
  employeeId: string,
  organizationId: string,
  dateOnly: Date
) {
  const jstDayStart = new Date(dateOnly.getTime() - JST_OFFSET_MS)
  const jstDayEnd = new Date(jstDayStart.getTime() + 86400000)

  const records = await prisma.kintaiClockRecord.findMany({
    where: { employeeId, timestamp: { gte: jstDayStart, lt: jstDayEnd } },
    orderBy: { timestamp: 'asc' },
  })

  if (records.length === 0) return null

  const employee = await prisma.kintaiEmployee.findUnique({
    where: { id: employeeId },
    include: { workRule: true },
  })

  let workRule = employee?.workRule ?? null
  if (!workRule) {
    workRule = await prisma.kintaiWorkRule.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    })
  }

  const result = calculateDailyAttendance(records, workRule, jstDayStart)
  const status = !result.clockOut ? 'clock_missing' : result.lateMinutes > 0 ? 'late' : 'normal'

  const updated = await prisma.kintaiAttendance.upsert({
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
