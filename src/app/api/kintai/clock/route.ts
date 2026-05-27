export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getKintaiContext } from '@/lib/kintai/access'
import { calculateDailyAttendance } from '@/lib/kintai/attendance'
import type { ClockType } from '@/lib/kintai/types'

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

    const records = await prisma.kintaiClockRecord.findMany({
      where: {
        employeeId: ctx.employeeId,
        timestamp: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { timestamp: 'asc' },
    })

    // clockStatus を算出
    let clockStatus = 'not_clocked_in'
    if (records.length > 0) {
      const last = records[records.length - 1]
      if (last.type === 'clock_out') clockStatus = 'clocked_out'
      else if (last.type === 'break_start') clockStatus = 'on_break'
      else clockStatus = 'working'
    }

    return NextResponse.json({ records, clockStatus, date: targetDate.toISOString().slice(0, 10) })
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

    const body = await req.json()
    const clockType = body.type as ClockType
    const note = (body.note as string) || undefined

    if (!['clock_in', 'clock_out', 'break_start', 'break_end'].includes(clockType)) {
      return NextResponse.json({ error: '無効な打刻種別です' }, { status: 400 })
    }

    // 今日の打刻を取得して状態遷移を検証
    const now = new Date()
    const jstOffset = 9 * 60 * 60 * 1000
    const jstNow = new Date(now.getTime() + jstOffset)
    const todayStart = new Date(
      Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()) - jstOffset
    )
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

    const todayRecords = await prisma.kintaiClockRecord.findMany({
      where: {
        employeeId: ctx.employeeId,
        timestamp: { gte: todayStart, lt: todayEnd },
      },
      orderBy: { timestamp: 'asc' },
    })

    // 状態遷移バリデーション
    const lastRecord = todayRecords.length > 0 ? todayRecords[todayRecords.length - 1] : null
    const lastType = lastRecord?.type as string | undefined

    const hasClockIn = todayRecords.some(r => r.type === 'clock_in')
    const hasClockOut = todayRecords.some(r => r.type === 'clock_out')

    switch (clockType) {
      case 'clock_in':
        if (hasClockIn && !hasClockOut) {
          return NextResponse.json({ error: '既に出勤済みです。先に退勤してください。' }, { status: 400 })
        }
        if (hasClockOut) {
          return NextResponse.json({ error: '本日は既に退勤済みです。' }, { status: 400 })
        }
        break

      case 'clock_out':
        if (!hasClockIn) {
          return NextResponse.json({ error: '出勤していません。先に出勤してください。' }, { status: 400 })
        }
        if (hasClockOut) {
          return NextResponse.json({ error: '既に退勤済みです。' }, { status: 400 })
        }
        // 休憩中は自動で休憩終了
        if (lastType === 'break_start') {
          await prisma.kintaiClockRecord.create({
            data: {
              employeeId: ctx.employeeId,
              type: 'break_end',
              timestamp: now,
              source: 'pc',
              note: '退勤による自動休憩終了',
            },
          })
        }
        break

      case 'break_start':
        if (!hasClockIn || hasClockOut) {
          return NextResponse.json({ error: '勤務中でないため休憩を開始できません。' }, { status: 400 })
        }
        if (lastType === 'break_start') {
          return NextResponse.json({ error: '既に休憩中です。' }, { status: 400 })
        }
        break

      case 'break_end':
        if (lastType !== 'break_start') {
          return NextResponse.json({ error: '休憩中ではありません。' }, { status: 400 })
        }
        break
    }

    // IPアドレス取得
    const forwarded = req.headers.get('x-forwarded-for')
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || undefined

    // 打刻レコード作成
    const record = await prisma.kintaiClockRecord.create({
      data: {
        employeeId: ctx.employeeId,
        type: clockType,
        timestamp: now,
        source: 'pc',
        ipAddress: ipAddress || undefined,
        note,
      },
    })

    // 退勤時は日次勤怠を計算してupsert
    if (clockType === 'clock_out') {
      await upsertDailyAttendance(ctx.employeeId, ctx.organizationId, todayStart, todayEnd)
    }

    return NextResponse.json({ record, message: '打刻しました' })
  } catch (error) {
    console.error('[kintai/clock POST]', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}

// ----------------------------------------------------------------
// 日次勤怠の集計・upsert
// ----------------------------------------------------------------
async function upsertDailyAttendance(
  employeeId: string,
  organizationId: string,
  dayStart: Date,
  dayEnd: Date
) {
  // 当日の全レコードを再取得（自動 break_end が追加されている可能性）
  const records = await prisma.kintaiClockRecord.findMany({
    where: {
      employeeId,
      timestamp: { gte: dayStart, lt: dayEnd },
    },
    orderBy: { timestamp: 'asc' },
  })

  // 従業員の就業ルールを取得
  const employee = await prisma.kintaiEmployee.findUnique({
    where: { id: employeeId },
    include: { workRule: true },
  })

  let workRule = employee?.workRule ?? null

  // フォールバック: 組織のデフォルト就業ルール
  if (!workRule) {
    workRule = await prisma.kintaiWorkRule.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    })
  }

  const result = calculateDailyAttendance(records, workRule, dayStart)

  // 日付を Date-only に正規化（JSTの日付をUTC midnightとして保存）
  const jstOffsetMs = 9 * 60 * 60 * 1000
  const jstDayStart = new Date(dayStart.getTime() + jstOffsetMs)
  const dateOnly = new Date(Date.UTC(jstDayStart.getUTCFullYear(), jstDayStart.getUTCMonth(), jstDayStart.getUTCDate()))

  await prisma.kintaiAttendance.upsert({
    where: {
      employeeId_date: {
        employeeId,
        date: dateOnly,
      },
    },
    update: {
      clockIn: result.clockIn,
      clockOut: result.clockOut,
      breakMinutes: result.breakMinutes,
      workMinutes: result.workMinutes,
      overtimeMinutes: result.overtimeMinutes,
      lateMinutes: result.lateMinutes,
      earlyLeaveMinutes: result.earlyLeaveMinutes,
      nightMinutes: result.nightMinutes,
      status: !result.clockOut ? 'clock_missing' : result.lateMinutes > 0 ? 'late' : 'normal',
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
      status: !result.clockOut ? 'clock_missing' : result.lateMinutes > 0 ? 'late' : 'normal',
    },
  })
}
