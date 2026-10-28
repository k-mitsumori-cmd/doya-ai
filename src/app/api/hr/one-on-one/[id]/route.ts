export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest } from 'next/server'
import { privateApiJson } from '@/lib/private-api-response'
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
      return privateApiJson({ error: 'ログイン状態か所属する組織を確かめて、もう一度お試しください。' }, { status: 401 })
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
      return privateApiJson({ error: 'この1on1の記録は見つかりませんでした。一覧から選び直してください。' }, { status: 404 })
    }
    if (!(await canAccessOneOnOne(hrCtx, oneOnOne))) {
      return privateApiJson({ error: 'この1on1記録にアクセスする権限がありません' }, { status: 403 })
    }

    const viewer = await getOneOnOneViewer(hrCtx)
    return privateApiJson({
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
    console.error('[hr/one-on-one/[id]] unexpected error')
    return privateApiJson(
      { error: '1on1の記録を読み込めませんでした。時間をおいて再読み込みしてください。' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as any)?.id) {
      return privateApiJson({ error: 'ログイン状態か所属する組織を確かめて、もう一度お試しください。' }, { status: 401 })
    }

    const hrCtx = await getHrContext()
    if (!hrCtx) {
      return privateApiJson({ error: 'ログイン状態か所属する組織を確かめて、もう一度お試しください。' }, { status: 401 })
    }

    const p = await ctx.params
    const id = p.id

    const existing = await prisma.hrOneOnOne.findFirst({
      where: { id, organizationId: hrCtx.organizationId },
    })
    if (!existing) {
      return privateApiJson({ error: 'この1on1の記録は見つかりませんでした。一覧から選び直してください。' }, { status: 404 })
    }
    if (!(await canAccessOneOnOne(hrCtx, existing))) {
      return privateApiJson({ error: 'この1on1記録にアクセスする権限がありません' }, { status: 403 })
    }
    if (existing.status === 'COMPLETED') {
      return privateApiJson({ error: '完了済みの1on1は編集できません' }, { status: 409 })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return privateApiJson({ error: '保存内容が不正です' }, { status: 400 })
    }
    // 画面の項目名を既存の保存項目へ対応付ける。両方指定された場合は曖昧にしない。
    for (const [alias, column] of [['date', 'scheduledAt'], ['managerNote', 'managerNotes'], ['sharedNote', 'employeeNotes'], ['actionItems', 'aiActionItems']]) {
      if (body[alias] !== undefined) {
        if (body[column] !== undefined && JSON.stringify(body[column]) !== JSON.stringify(body[alias])) {
          return privateApiJson({ error: '同じ項目に異なる値が指定されています' }, { status: 400 })
        }
        body[column] = body[alias]
      }
    }
    if ((body.managerNotes !== undefined || body.privateNotes !== undefined) && !canViewManagerNotes(await getOneOnOneViewer(hrCtx), existing)) {
      return privateApiJson({ error: '上司メモの編集権限がありません' }, { status: 403 })
    }
    for (const key of ['scheduledAt', 'conductedAt']) {
      if (body[key] != null && (typeof body[key] !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(body[key]) || !Number.isFinite(new Date(body[key]).getTime()))) {
        return privateApiJson({ error: '日時を正しく入力してください' }, { status: 400 })
      }
    }
    if (body.duration !== undefined && (!Number.isInteger(body.duration) || body.duration < 1 || body.duration > 1440)) {
      return privateApiJson({ error: '時間は1〜1440分で入力してください' }, { status: 400 })
    }
    for (const key of ['managerNotes', 'employeeNotes', 'privateNotes']) {
      if (body[key] != null && typeof body[key] !== 'string') return privateApiJson({ error: 'メモは文字列で入力してください' }, { status: 400 })
    }
    if (body.aiActionItems !== undefined && !Array.isArray(body.aiActionItems)) {
      return privateApiJson({ error: 'アクション項目が不正です' }, { status: 400 })
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
    return privateApiJson({
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
    if (e?.code === 'P2025') return privateApiJson({ error: '1on1が完了または削除されました。内容をご確認ください。' }, { status: 409 })
    console.error('[hr/one-on-one/[id]] unexpected error')
    return privateApiJson(
      { error: '1on1の記録を保存できませんでした。時間をおいて、もう一度お試しください。' },
      { status: 500 }
    )
  }
}
