export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getKintaiContext, hasMinRole } from '@/lib/kintai/access'
import type { Prisma } from '@prisma/client'
import { recalculateDayForEmployee } from '@/lib/kintai/recalculate'
import { openShiftStart } from '@/lib/kintai/shift-records'

class RequestConflict extends Error {}
class InvalidCorrection extends Error {}

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const kctx = await getKintaiContext()
    if (!kctx) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const p = await ctx.params
    const request = await prisma.kintaiRequest.findUnique({
      where: { id: p.id },
      include: {
        employee: { select: { name: true, email: true, organizationId: true, departmentId: true } },
        reviewer: { select: { name: true } },
      },
    })

    if (!request) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

    // Organization scoping: verify the request belongs to the caller's org
    if (request.employee.organizationId !== kctx.organizationId) {
      return NextResponse.json({ error: '見つかりません' }, { status: 404 })
    }

    // 一覧と同じ範囲のみ公開する。部署未所属の管理者は本人分のみ閲覧可能。
    if (request.employeeId !== kctx.employeeId && !hasMinRole(kctx.role, 'hr_admin')) {
      if (!hasMinRole(kctx.role, 'manager')) {
        return NextResponse.json({ error: '見つかりません' }, { status: 404 })
      }
      const viewer = await prisma.kintaiEmployee.findUnique({
        where: { id: kctx.employeeId },
        select: { organizationId: true, departmentId: true },
      })
      if (viewer?.organizationId !== kctx.organizationId || !viewer.departmentId ||
          viewer.departmentId !== request.employee.departmentId) {
        return NextResponse.json({ error: '見つかりません' }, { status: 404 })
      }
    }

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

    const p = await ctx.params
    const body = await req.json()
    const { status, reviewerComment } = body

    const existing = await prisma.kintaiRequest.findUnique({
      where: { id: p.id },
      include: { employee: { select: { organizationId: true } } },
    })
    if (!existing) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

    // Organization scoping: verify the request belongs to the caller's org
    if (existing.employee.organizationId !== kctx.organizationId) {
      return NextResponse.json({ error: '見つかりません' }, { status: 404 })
    }

    // SEC: ステータス値のホワイトリスト検証
    const ALLOWED_STATUSES = ['withdrawn', 'approved', 'rejected']
    if (!ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: '無効なステータスです' }, { status: 400 })
    }

    const cancellingLeave = status === 'withdrawn' && existing.status === 'approved' && existing.type === 'leave'
    if (cancellingLeave && (typeof reviewerComment !== 'string' || !reviewerComment.trim() || reviewerComment.length > 2000)) {
      return NextResponse.json({ error: '取消理由を1〜2000文字で入力してください。' }, { status: 400 })
    }
    if (status === 'withdrawn' && !cancellingLeave) {
      if (existing.employeeId !== kctx.employeeId) {
        return NextResponse.json({ error: '自分の申請のみ取下げできます' }, { status: 403 })
      }
      if (existing.status !== 'pending') {
        return NextResponse.json({ error: '承認待ちの申請のみ取下げできます' }, { status: 400 })
      }
    } else if (status === 'approved' || status === 'rejected' || cancellingLeave) {
      if (!hasMinRole(kctx.role, 'manager')) {
        return NextResponse.json({ error: '承認権限がありません' }, { status: 403 })
      }
      // マネージャーは自部署の申請のみ承認可能（hr_admin以上は全部署OK）
      if (kctx.role === 'manager') {
        const requester = await prisma.kintaiEmployee.findUnique({
          where: { id: existing.employeeId },
          select: { departmentId: true },
        })
        const approver = await prisma.kintaiEmployee.findUnique({
          where: { id: kctx.employeeId },
          select: { departmentId: true },
        })
        if (!approver?.departmentId || requester?.departmentId !== approver.departmentId) {
          return NextResponse.json({ error: '他部署の申請は承認できません' }, { status: 403 })
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (cancellingLeave || (status === 'approved' && ['clock_fix', 'leave'].includes(existing.type))) {
        const employees = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM kintai_employees
          WHERE id = ${existing.employeeId} AND "organizationId" = ${kctx.organizationId}
          FOR NO KEY UPDATE
        `
        if (employees.length !== 1) throw new RequestConflict('対象の従業員情報が変更されています。再読み込みしてください。')
      }
      const claimed = await tx.kintaiRequest.updateMany({
        where: { id: p.id, status: cancellingLeave ? 'approved' : 'pending', employee: { organizationId: kctx.organizationId } },
        data: {
          status,
          ...(status === 'approved' || status === 'rejected'
            ? { reviewerId: kctx.employeeId, reviewedAt: new Date(), reviewerComment: reviewerComment || null }
            : {}),
        },
      })
      if (claimed.count !== 1) throw new RequestConflict('この申請はすでに処理されています。再読み込みしてください。')
      if (status === 'approved' && ['clock_fix', 'leave'].includes(existing.type)) {
        if (existing.type === 'clock_fix') await applyClockFix(tx, existing.employeeId, kctx.organizationId, existing.details as any)
        else await applyLeave(tx, existing.employeeId, existing.id, existing.details as any)
      }
      if (cancellingLeave) {
        const removed = await cancelLeave(tx, existing.employeeId, existing.id, existing.details as any)
        await tx.kintaiRequest.update({ where: { id: existing.id }, data: {
          details: { ...(existing.details as Record<string, Prisma.InputJsonValue>), leaveCancellation: {
            employeeId: kctx.employeeId, cancelledAt: new Date().toISOString(),
            reason: reviewerComment.trim(), removedAttendanceIds: removed,
          } },
        } })
      }
      return tx.kintaiRequest.findUnique({ where: { id: p.id } })
    })

    return NextResponse.json({ request: updated })
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2002') return NextResponse.json({ error: '対象日の勤怠がすでに存在します。申請内容をご確認ください。' }, { status: 409 })
    if ((e as { code?: string })?.code === 'P2025') return NextResponse.json({ error: '対象の打刻が変更されています。再読み込みしてください。' }, { status: 409 })
    if (e instanceof RequestConflict) return NextResponse.json({ error: e.message }, { status: 409 })
    if (e instanceof InvalidCorrection) return NextResponse.json({ error: e.message }, { status: 400 })
    console.error('[kintai/requests/[id] PATCH]', e)
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }
}

async function applyClockFix(
  db: Prisma.TransactionClient,
  employeeId: string,
  organizationId: string,
  details: { date?: string; clockType?: string; correctedTime?: string; recordId?: string; expectedTimestamp?: string }
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(details?.date || '') ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(details?.correctedTime || '') ||
      !['clock_in', 'clock_out', 'break_start', 'break_end'].includes(details?.clockType || '')) {
    throw new InvalidCorrection('打刻訂正の日時・種別が不正です。申請内容をご確認ください。')
  }
  if ((details.recordId != null && typeof details.recordId !== 'string') || (details.expectedTimestamp != null && typeof details.expectedTimestamp !== 'string')) throw new InvalidCorrection('訂正対象の情報が不正です。')
  const dateOnly = new Date(details.date + 'T00:00:00Z')
  if (!Number.isFinite(dateOnly.getTime()) || dateOnly.toISOString().slice(0, 10) !== details.date) {
    throw new InvalidCorrection('対象日が不正です。')
  }
  const leave = await db.kintaiAttendance.findFirst({
    where: { employeeId, date: dateOnly, status: { in: ['paid_leave', 'special_leave', 'absent'] } },
  })
  if (leave) throw new RequestConflict('対象日は休暇・欠勤として登録されています。管理者にご確認ください。')
  const dayStart = new Date(dateOnly.getTime() - 9 * 3600000)
  const dayEnd = new Date(dayStart.getTime() + 86400000)
  const [h, m] = details.correctedTime!.split(':').map(Number)
  const correctedTimestamp = new Date(dayStart.getTime() + (h * 60 + m) * 60000)
  if (correctedTimestamp.getTime() > Date.now()) {
    throw new InvalidCorrection('未来の時刻には打刻を訂正できません。')
  }
  const records = await db.kintaiClockRecord.findMany({
    where: { employeeId, ...(details.recordId ? { id: details.recordId } : {}), type: details.clockType!, timestamp: { gte: dayStart, lt: dayEnd } },
    orderBy: [{ timestamp: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    take: 2,
  })
  if (details.recordId && records.length !== 1) throw new RequestConflict('対象の打刻が変更または削除されています。申請を確認してください。')
  if (records.length > 1) {
    throw new RequestConflict('同じ日に同種の打刻が複数あります。訂正対象を特定できないため、管理者にご確認ください。')
  }
  const record = records[0]
  if (record) {
    if (details.expectedTimestamp && record.timestamp.toISOString() !== details.expectedTimestamp) throw new RequestConflict('申請後に対象の打刻が変更されています。再申請してください。')
    await db.kintaiClockRecord.update({ where: { id: record.id, timestamp: record.timestamp }, data: {
      originalTimestamp: record.originalTimestamp ?? record.timestamp,
      timestamp: correctedTimestamp, isModified: true,
    } })
  } else {
    await db.kintaiClockRecord.create({ data: {
      employeeId, type: details.clockType!, timestamp: correctedTimestamp,
      source: 'manual', isModified: true,
    } })
  }
  // An event just after midnight can close yesterday's shift. Refresh its workday
  // before the calendar day so the approved correction updates the actual total.
  if (details.clockType !== 'clock_in') {
    const precedingRecords = await db.kintaiClockRecord.findMany({
      where: { employeeId, timestamp: { gte: new Date(dayStart.getTime() - 86400000), lt: correctedTimestamp } },
      orderBy: [{ timestamp: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    })
    const previousShift = openShiftStart(precedingRecords)
    if (previousShift && previousShift.timestamp < dayStart) {
      await recalculateDayForEmployee(employeeId, organizationId, new Date(dateOnly.getTime() - 86400000), db)
    }
  }
  await recalculateDayForEmployee(employeeId, organizationId, dateOnly, db)
}

async function applyLeave(
  db: Prisma.TransactionClient,
  employeeId: string,
  requestId: string,
  details: { startDate?: string; endDate?: string; leaveType?: string }
) {
  const { start, end, count, status } = leaveRange(details)
  const nextDay = new Date(+end + 86400000)
  const existing = await db.kintaiAttendance.findFirst({ where: { employeeId, date: { gte: start, lt: nextDay } } })
  const clock = await db.kintaiClockRecord.findFirst({ where: { employeeId, timestamp: { gte: new Date(+start - 9 * 3600000), lt: new Date(+nextDay - 9 * 3600000) } } })
  if (existing || clock) throw new RequestConflict('期間内に勤怠・打刻が登録されています。上書きせず承認を中止しました。対象日をご確認ください。')
  await db.kintaiAttendance.createMany({ data: Array.from({ length: count }, (_, day) => ({
    id: leaveAttendanceId(requestId, new Date(+start + day * 86400000)),
    employeeId, date: new Date(+start + day * 86400000), status,
  })) })
}

function leaveAttendanceId(requestId: string, date: Date) {
  return `leave:${requestId}:${date.toISOString().slice(0, 10)}`
}

function leaveRange(details: { startDate?: string; endDate?: string; leaveType?: string }) {
  const statuses: Record<string, string> = { paid: 'paid_leave', special: 'special_leave', unpaid: 'absent' }
  if (!details || !Object.prototype.hasOwnProperty.call(statuses, details.leaveType || '') ||
      !/^\d{4}-\d{2}-\d{2}$/.test(details.startDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(details.endDate || '')) {
    throw new InvalidCorrection('休暇の種別・開始日・終了日が不正です。再申請してください。')
  }
  const start = new Date(details.startDate + 'T00:00:00Z')
  const end = new Date(details.endDate + 'T00:00:00Z')
  if (!Number.isFinite(+start) || !Number.isFinite(+end) || start.toISOString().slice(0, 10) !== details.startDate || end.toISOString().slice(0, 10) !== details.endDate || end < start) {
    throw new InvalidCorrection('休暇の日付範囲が不正です。再申請してください。')
  }
  const count = (+end - +start) / 86400000 + 1
  if (count > 366) throw new InvalidCorrection('1件の休暇申請は366日以内で指定してください。')
  return { start, end, count, status: statuses[details.leaveType!] }
}

async function cancelLeave(db: Prisma.TransactionClient, employeeId: string, requestId: string, details: { startDate?: string; endDate?: string; leaveType?: string }) {
  const { start, end, count, status } = leaveRange(details)
  const ids = Array.from({ length: count }, (_, day) => leaveAttendanceId(requestId, new Date(+start + day * 86400000)))
  const rows = await db.kintaiAttendance.findMany({ where: { employeeId, date: { gte: start, lte: end } } })
  // 旧申請に実績がない場合は申請のみ取り消せる。対応が不明な既存行は削除しない。
  if (rows.length === 0) return []
  if (rows.length !== ids.length || rows.some(row => !ids.includes(row.id) || row.status !== status ||
      row.clockIn || row.clockOut || row.workMinutes || row.breakMinutes || row.overtimeMinutes || row.lateMinutes ||
      row.earlyLeaveMinutes || row.nightMinutes || row.holidayWork || row.note)) {
    throw new RequestConflict('申請と勤怠の対応を確認できないか、承認後に変更されています。実績を削除せず取消を中止しました。管理者にご確認ください。')
  }
  const clock = await db.kintaiClockRecord.findFirst({ where: { employeeId, timestamp: {
    gte: new Date(+start - 9 * 3600000), lt: new Date(+end + 86400000 - 9 * 3600000),
  } } })
  if (clock) throw new RequestConflict('期間内に打刻があるため取消できません。管理者にご確認ください。')
  const removed = await db.kintaiAttendance.deleteMany({ where: { employeeId, id: { in: ids }, status } })
  if (removed.count !== ids.length) throw new RequestConflict('勤怠が変更されています。取消を中止しました。')
  return ids
}
