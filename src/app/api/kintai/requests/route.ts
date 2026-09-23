export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getKintaiContext, hasMinRole } from '@/lib/kintai/access'

export async function GET(req: NextRequest) {
  try {
    const ctx = await getKintaiContext()
    if (!ctx) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || ''
    const type = searchParams.get('type') || ''

    const where: any = {}

    if (hasMinRole(ctx.role, 'hr_admin')) {
      const empIds = await prisma.kintaiEmployee.findMany({
        where: { organizationId: ctx.organizationId },
        select: { id: true },
      })
      where.employeeId = { in: empIds.map((e) => e.id) }
    } else if (hasMinRole(ctx.role, 'manager')) {
      const myEmp = await prisma.kintaiEmployee.findUnique({
        where: { id: ctx.employeeId },
        select: { departmentId: true },
      })
      if (myEmp?.departmentId) {
        const deptEmps = await prisma.kintaiEmployee.findMany({
          where: { organizationId: ctx.organizationId, departmentId: myEmp.departmentId },
          select: { id: true },
        })
        where.employeeId = { in: deptEmps.map((e) => e.id) }
      } else {
        where.employeeId = ctx.employeeId
      }
    } else {
      where.employeeId = ctx.employeeId
    }

    if (status) where.status = status
    if (type) where.type = type

    const requests = await prisma.kintaiRequest.findMany({
      where,
      include: { employee: { select: { name: true, email: true, department: { select: { name: true } } } } },
      orderBy: { submittedAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({ requests })
  } catch (e) {
    console.error('[kintai/requests GET]', e)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getKintaiContext()
    if (!ctx) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const { type, details, reason } = await req.json()
    // SEC: タイプ値のホワイトリスト検証
    const ALLOWED_TYPES = ['clock_fix', 'leave', 'overtime', 'holiday_work']
    if (!type || !ALLOWED_TYPES.includes(type)) {
      return NextResponse.json({ error: '無効な申請種別です' }, { status: 400 })
    }

    // バリデーション: 各申請種別ごとの必須フィールドチェック
    if (type === 'clock_fix') {
      if (!details?.date) return NextResponse.json({ error: '対象日は必須です' }, { status: 400 })
      if (!details?.clockType) return NextResponse.json({ error: '打刻種別を選択してください' }, { status: 400 })
      if (!details?.correctedTime) return NextResponse.json({ error: '修正後の時刻を入力してください' }, { status: 400 })
      const validDate = typeof details.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(details.date)
      const dateOnly = validDate ? new Date(`${details.date}T00:00:00Z`) : null
      const validTime = typeof details.correctedTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(details.correctedTime)
      if (!dateOnly || !Number.isFinite(dateOnly.getTime()) || dateOnly.toISOString().slice(0, 10) !== details.date ||
          !validTime || !['clock_in', 'clock_out', 'break_start', 'break_end'].includes(details.clockType)) {
        return NextResponse.json({ error: '打刻訂正の日時・種別をご確認ください。' }, { status: 400 })
      }
      const [hour, minute] = details.correctedTime.split(':').map(Number)
      const correctedTimestamp = new Date(dateOnly.getTime() - 9 * 3600000 + (hour * 60 + minute) * 60000)
      if (correctedTimestamp.getTime() > Date.now()) {
        return NextResponse.json({ error: '未来の時刻には打刻を訂正できません。' }, { status: 400 })
      }
    }
    if (type === 'leave') {
      if (!details?.startDate) return NextResponse.json({ error: '開始日は必須です' }, { status: 400 })
      if (!details?.endDate) return NextResponse.json({ error: '終了日は必須です' }, { status: 400 })
      const start = new Date(details.startDate + 'T00:00:00Z')
      const end = new Date(details.endDate + 'T00:00:00Z')
      if (!['paid', 'special', 'unpaid'].includes(details.leaveType) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(details.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(details.endDate) ||
          !Number.isFinite(+start) || !Number.isFinite(+end) || start.toISOString().slice(0, 10) !== details.startDate || end.toISOString().slice(0, 10) !== details.endDate || end < start) {
        return NextResponse.json({ error: '休暇の種別・日付範囲をご確認ください。' }, { status: 400 })
      }
      if ((+end - +start) / 86400000 + 1 > 366) return NextResponse.json({ error: '1件の休暇申請は366日以内で指定してください。' }, { status: 400 })
    }
    if (type === 'overtime') {
      if (!details?.date) return NextResponse.json({ error: '対象日は必須です' }, { status: 400 })
      if (!details?.hours && !details?.minutes) return NextResponse.json({ error: '残業時間を入力してください' }, { status: 400 })
    }
    if (typeof reason !== 'string' || !reason.trim()) {
      return NextResponse.json({ error: '理由を入力してください' }, { status: 400 })
    }

    const savedDetails = { ...(details || {}) }
    delete savedDetails.leaveCancellation
    const request = await prisma.kintaiRequest.create({
      data: {
        employeeId: ctx.employeeId,
        type,
        details: savedDetails,
        reason: reason || null,
        status: 'pending',
      },
      include: { employee: { select: { name: true } } },
    })

    return NextResponse.json({ request }, { status: 201 })
  } catch (e) {
    console.error('[kintai/requests POST]', e)
    return NextResponse.json({ error: '申請の作成に失敗しました' }, { status: 500 })
  }
}
