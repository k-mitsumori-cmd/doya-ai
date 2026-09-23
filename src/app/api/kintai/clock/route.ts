export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getKintaiContext } from '@/lib/kintai/access'
import { recalculateDayForEmployee } from '@/lib/kintai/recalculate'
import type { ClockType } from '@/lib/kintai/types'
import { recordServiceUsage } from '@/lib/service-usage'
import { jstWorkdayDate, openShiftStart, recordsWithCarryover } from '@/lib/kintai/shift-records'

class ClockTransitionError extends Error {
  constructor(message: string, readonly status: number = 400) { super(message) }
}

// ----------------------------------------------------------------
// GET /api/kintai/clock?date=YYYY-MM-DD
// 指定日（デフォルト今日）の打刻レコードを返す
// ----------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const ctx = await getKintaiContext()
    if (!ctx) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const dateParam = searchParams.get('date')

    // 日付の範囲を計算（JST 基準）
    const now = new Date()
    let targetDate: Date
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      targetDate = new Date(dateParam + 'T00:00:00+09:00')
    } else {
      // 今日（JST）
      const jstOffset = 9 * 60 * 60 * 1000
      const jstNow = new Date(now.getTime() + jstOffset)
      targetDate = new Date(
        Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()) - jstOffset
      )
    }

    const dayStart = new Date(targetDate)
    const dayEnd = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)

    const allRecords = await prisma.kintaiClockRecord.findMany({
      where: {
        employeeId: ctx.employeeId,
        timestamp: { gte: new Date(dayStart.getTime() - 86400000), lt: dayEnd },
      },
      orderBy: [{ timestamp: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    })
    const records = allRecords.filter(record => record.timestamp >= dayStart)
    // Correction records may carry a later time today; they must not advance the live clock state.
    const activeShiftRecords = recordsWithCarryover(
      allRecords.filter(record => record.timestamp.getTime() <= now.getTime() + 1000), dayStart,
    )

    // clockStatus を算出
    let clockStatus = 'not_clocked_in'
    if (activeShiftRecords.length > 0) {
      const last = activeShiftRecords[activeShiftRecords.length - 1]
      if (last.type === 'clock_out') clockStatus = 'clocked_out'
      else if (last.type === 'break_start') clockStatus = 'on_break'
      else clockStatus = 'working'
    }

    const jstDate = new Date(targetDate.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
    return NextResponse.json({ records, activeShiftRecords, clockStatus, date: jstDate })
  } catch (error) {
    console.error('[kintai/clock GET]', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}

// ----------------------------------------------------------------
// POST /api/kintai/clock
// 打刻を記録する
// ----------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const ctx = await getKintaiContext()
    if (!ctx) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // 無効化は過去の記録を残すが、新しい打刻を許可しない。
    const activeEmployee = await prisma.kintaiEmployee.findFirst({
      where: { id: ctx.employeeId, organizationId: ctx.organizationId, isActive: true },
      select: { id: true },
    })
    if (!activeEmployee) {
      return NextResponse.json(
        { error: '従業員情報が無効化されています。管理者にご確認ください。' },
        { status: 403 },
      )
    }

    const body = await req.json()
    const clockType = body.type as ClockType
    const note = (body.note as string) || undefined

    if (!['clock_in', 'clock_out', 'break_start', 'break_end'].includes(clockType)) {
      return NextResponse.json({ error: '無効な打刻種別です' }, { status: 400 })
    }

    const record = await prisma.$transaction(async (tx) => {
      // 同じ従業員への通常打刻を直列化。無効化の更新とも競合しないよう行をロックする。
      const employees = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM kintai_employees
        WHERE id = ${ctx.employeeId} AND "organizationId" = ${ctx.organizationId} AND "isActive" = true
        FOR NO KEY UPDATE
      `
      if (employees.length !== 1) throw new ClockTransitionError('従業員情報が無効化されています。管理者にご確認ください。', 403)
      // 今日の打刻を取得して状態遷移を検証
      const now = new Date()
      const jstOffset = 9 * 60 * 60 * 1000
      const jstNow = new Date(now.getTime() + jstOffset)
      const todayStart = new Date(
        Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()) - jstOffset
      )
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

      const recentRecords = await tx.kintaiClockRecord.findMany({
        where: {
          employeeId: ctx.employeeId,
          timestamp: { gte: new Date(todayStart.getTime() - 86400000), lt: new Date(Math.min(todayEnd.getTime(), now.getTime() + 1000)) },
        },
        orderBy: [{ timestamp: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      })
      const todayRecords = recentRecords.filter(record => record.timestamp >= todayStart)
      const openShift = openShiftStart(recentRecords)
      // A shift that began yesterday may be completed even when today is marked as leave.
      if (clockType === 'clock_in' || (openShift && openShift.timestamp >= todayStart)) {
        const leave = await tx.kintaiAttendance.findFirst({ where: {
          employeeId: ctx.employeeId, date: new Date(todayStart.getTime() + jstOffset),
          status: { in: ['paid_leave', 'special_leave', 'absent'] },
        } })
        if (leave) throw new ClockTransitionError('本日は休暇・欠勤として登録されています。管理者にご確認ください。', 409)
      }

      // 状態遷移バリデーション
      const lastRecord = recentRecords.length > 0 ? recentRecords[recentRecords.length - 1] : null
      const lastType = lastRecord?.type as string | undefined

      const hasClockOut = todayRecords.some(r => r.type === 'clock_out')

      // 同一ミリ秒の別要求でも、新しい打刻を必ず直前の打刻より後へ置く。
      if (lastRecord && now.getTime() <= lastRecord.timestamp.getTime()) {
        now.setTime(lastRecord.timestamp.getTime() + 1)
      }

      switch (clockType) {
        case 'clock_in':
          if (openShift) {
            throw new ClockTransitionError('既に出勤済みです。先に退勤してください。')
          }
          // 退勤後の再出勤を許可（シフト・深夜勤務対応）
          break

        case 'clock_out':
          if (!openShift) {
            throw new ClockTransitionError(lastType === 'clock_out'
              ? '既に退勤済みです。再度出勤してから退勤してください。'
              : '出勤していません。先に出勤してください。')
          }
          // 休憩中は自動で休憩終了
          if (lastType === 'break_start') {
            await tx.kintaiClockRecord.create({
              data: {
                employeeId: ctx.employeeId,
                type: 'break_end',
                timestamp: new Date(now),
                source: 'pc',
                note: '退勤による自動休憩終了',
              },
            })
            // 自動休憩終了の直後に退勤を保存し、取得順による勤務中表示を防ぐ。
            now.setTime(now.getTime() + 1)
          }
          break

        case 'break_start':
          if (!openShift || lastType === 'clock_out') {
            throw new ClockTransitionError('勤務中でないため休憩を開始できません。')
          }
          if (lastType === 'break_start') {
            throw new ClockTransitionError('既に休憩中です。')
          }
          break

        case 'break_end':
          if (!openShift || lastType !== 'break_start') {
            throw new ClockTransitionError('休憩中ではありません。')
          }
          break
      }

      // IPアドレス取得
      const forwarded = req.headers.get('x-forwarded-for')
      const ipAddress = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || undefined

      // 打刻レコード作成
      const record = await tx.kintaiClockRecord.create({
        data: {
          employeeId: ctx.employeeId,
          type: clockType,
          timestamp: now,
          source: 'pc',
          ipAddress: ipAddress || undefined,
          note,
        },
      })

      // 退勤時・再出勤時に日次勤怠を再計算してupsert
      if (clockType === 'clock_out' || (clockType === 'clock_in' && hasClockOut)) {
        const dateOnly = jstWorkdayDate(clockType === 'clock_out' && openShift ? new Date(openShift.timestamp) : now)
        await recalculateDayForEmployee(ctx.employeeId, ctx.organizationId, dateOnly, tx)
      }

      return record
    })

    const CLOCK_LABELS: Record<string, string> = {
      clock_in: '出勤', clock_out: '退勤', break_start: '休憩開始', break_end: '休憩終了',
    }
    await recordServiceUsage({
      userId: ctx.userId,
      serviceId: 'kintai',
      action: `打刻（${CLOCK_LABELS[clockType] || clockType}）`,
      input: { clockType },
      metadata: { organizationId: ctx.organizationId },
    })

    return NextResponse.json({ record, message: '打刻しました' })
  } catch (error) {
    if (error instanceof ClockTransitionError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('[kintai/clock POST]', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
