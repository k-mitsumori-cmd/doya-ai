export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHrContext } from '@/lib/hr/access'
import { canAccessOneOnOne, getOneOnOneViewer, canViewManagerNotes, filterOneOnOneFields } from '@/lib/hr/one-on-one-access'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const hrCtx = await getHrContext()
    if (!hrCtx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const p = await ctx.params
    const id = p.id

    const oneOnOne = await prisma.hrOneOnOne.findFirst({
      where: { id, organizationId: hrCtx.organizationId },
      include: {
        employee: {
          select: {
            id: true, firstName: true, lastName: true,
            position: true,
            department: { select: { id: true, name: true } },
          },
        },
        manager: {
          select: {
            id: true, firstName: true, lastName: true,
            position: true,
          },
        },
      },
    })

    if (!oneOnOne) {
      return NextResponse.json({ error: '1on1 record not found' }, { status: 404 })
    }
    if (!(await canAccessOneOnOne(hrCtx, oneOnOne))) {
      return NextResponse.json({ error: 'この1on1記録にアクセスする権限がありません' }, { status: 403 })
    }

    const viewer = await getOneOnOneViewer(hrCtx)
    return NextResponse.json({
      success: true,
      oneOnOne: filterOneOnOneFields({
        ...oneOnOne,
        date: oneOnOne.scheduledAt,
        employeeName: `${oneOnOne.employee.lastName} ${oneOnOne.employee.firstName}`,
        managerNote: oneOnOne.managerNotes,
        sharedNote: oneOnOne.employeeNotes,
        actionItems: oneOnOne.aiActionItems,
        agenda: oneOnOne.agenda as any,
        aiActionItems: oneOnOne.aiActionItems as any,
        aiInsights: oneOnOne.aiInsights as any,
      }, viewer),
    })
  } catch (e: any) {
    console.error('[hr/one-on-one/[id]] unexpected error', e)
    return NextResponse.json(
      { error: 'Failed to fetch 1on1 record' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hrCtx = await getHrContext()
    if (!hrCtx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const p = await ctx.params
    const id = p.id

    const existing = await prisma.hrOneOnOne.findFirst({
      where: { id, organizationId: hrCtx.organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: '1on1 record not found' }, { status: 404 })
    }
    if (!(await canAccessOneOnOne(hrCtx, existing))) {
      return NextResponse.json({ error: 'この1on1記録にアクセスする権限がありません' }, { status: 403 })
    }
    if (existing.status === 'COMPLETED') {
      return NextResponse.json({ error: '完了済みの1on1は編集できません' }, { status: 409 })
    }

    const body = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: '保存内容が不正です' }, { status: 400 })
    }
    // 画面の項目名を既存の保存項目へ対応付ける。両方指定された場合は曖昧にしない。
    for (const [alias, column] of [['date', 'scheduledAt'], ['managerNote', 'managerNotes'], ['sharedNote', 'employeeNotes'], ['actionItems', 'aiActionItems']]) {
      if (body[alias] !== undefined) {
        if (body[column] !== undefined && JSON.stringify(body[column]) !== JSON.stringify(body[alias])) {
          return NextResponse.json({ error: '同じ項目に異なる値が指定されています' }, { status: 400 })
        }
        body[column] = body[alias]
      }
    }
    if ((body.managerNotes !== undefined || body.privateNotes !== undefined) && !canViewManagerNotes(await getOneOnOneViewer(hrCtx), existing)) {
      return NextResponse.json({ error: '上司メモの編集権限がありません' }, { status: 403 })
    }
    for (const key of ['scheduledAt', 'conductedAt']) {
      if (body[key] != null && (typeof body[key] !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(body[key]) || !Number.isFinite(new Date(body[key]).getTime()))) {
        return NextResponse.json({ error: '日時を正しく入力してください' }, { status: 400 })
      }
    }
    if (body.duration !== undefined && (!Number.isInteger(body.duration) || body.duration < 1 || body.duration > 1440)) {
      return NextResponse.json({ error: '時間は1〜1440分で入力してください' }, { status: 400 })
    }
    for (const key of ['managerNotes', 'employeeNotes', 'privateNotes']) {
      if (body[key] != null && typeof body[key] !== 'string') return NextResponse.json({ error: 'メモは文字列で入力してください' }, { status: 400 })
    }
    if (body.aiActionItems !== undefined && !Array.isArray(body.aiActionItems)) {
      return NextResponse.json({ error: 'アクション項目が不正です' }, { status: 400 })
    }
    const {
      scheduledAt,
      conductedAt,
      duration,
      agenda,
      managerNotes,
      employeeNotes,
      privateNotes,
      status,
    } = body

    const data: Record<string, any> = {}
    if (scheduledAt !== undefined) data.scheduledAt = scheduledAt ? new Date(scheduledAt) : null
    if (conductedAt !== undefined) data.conductedAt = conductedAt ? new Date(conductedAt) : null
    if (duration !== undefined) data.duration = duration
    if (agenda !== undefined) data.agenda = agenda
    if (managerNotes !== undefined) data.managerNotes = managerNotes
    if (employeeNotes !== undefined) data.employeeNotes = employeeNotes
    if (privateNotes !== undefined) data.privateNotes = privateNotes
    if (status !== undefined) data.status = status
    if (body.aiActionItems !== undefined) data.aiActionItems = body.aiActionItems

    const updated = await prisma.hrOneOnOne.update({
      where: { id, status: { not: 'COMPLETED' } },
      data,
    })

    const viewer = await getOneOnOneViewer(hrCtx)
    return NextResponse.json({
      success: true,
      oneOnOne: filterOneOnOneFields({
        ...updated,
        date: updated.scheduledAt,
        managerNote: updated.managerNotes,
        sharedNote: updated.employeeNotes,
        actionItems: updated.aiActionItems,
        agenda: updated.agenda as any,
        aiActionItems: updated.aiActionItems as any,
        aiInsights: updated.aiInsights as any,
      }, viewer),
    })
  } catch (e: any) {
    if (e?.code === 'P2025') return NextResponse.json({ error: '1on1が完了または削除されました。内容をご確認ください。' }, { status: 409 })
    console.error('[hr/one-on-one/[id]] unexpected error', e)
    return NextResponse.json(
      { error: 'Failed to update 1on1 record' },
      { status: 500 }
    )
  }
}
