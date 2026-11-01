import { validHrEvaluationPeriodOperationId, replayHrEvaluationPeriodOperation, completeHrEvaluationPeriodOperation, HrEvaluationPeriodOperationConflict, HrEvaluationPeriodOperationAccessError } from '@/lib/hr/evaluation-period-operation'
import { readHrEvaluationPeriodDeletionInput, getHrEvaluationPeriodDeletionRevision } from '@/lib/hr/evaluation-period-delete'
import { HrEvaluationInputError } from '@/lib/hr/evaluation-input'
import { readHrEvaluationPeriodOverview, HrEvaluationOverviewError } from '@/lib/hr/evaluation-period-overview'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { privateApiJson } from '@/lib/private-api-response'
import { readHrEvaluationPeriodPatch, validateHrEvaluationPeriodRange, HrEvaluationPeriodInputError } from '@/lib/hr/evaluation-period-input'
import { runHrEvaluationAdminMutation } from '@/lib/hr/evaluation-mutation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getEvaluationReadWhere, getEvaluationReader } from '@/lib/hr/evaluation-access'
import { prisma } from '@/lib/prisma'
import { getHrContext, hasMinRole } from '@/lib/hr/access'
import { HrMemberRole } from '@/lib/hr/types'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const hrCtx = await getHrContext()
    if (!hrCtx) {
      return privateApiJson({ error: 'ログイン状態か所属する組織を確かめて、もう一度お試しください。' }, { status: 401 })
    }

    const p = await ctx.params
    const id = p.id

    const expectedOrganization = req.headers.get('X-HR-Organization-Id')
    if (expectedOrganization && expectedOrganization !== hrCtx.organizationId) return privateApiJson({ error: '組織が変更されています。再取得してください。' }, { status: 403 })
    const query = new URL(req.url).searchParams
    if (query.get('format') === 'overview-pages') {
      if (query.getAll('format').length !== 1 || query.getAll('cursor').length > 1 || [...query.keys()].some(key => key !== 'format' && key !== 'cursor')) return privateApiJson({ error: '取得条件が正しくありません。' }, { status: 400 })
      return privateApiJson(await readHrEvaluationPeriodOverview(prisma, hrCtx, id, query.get('cursor')))
    }

    const evaluationWhere = await getEvaluationReadWhere(hrCtx)
    const reader = await getEvaluationReader(hrCtx)
    if (!reader) return privateApiJson({ error: 'この操作に必要な権限がありません。組織の管理者にご相談ください。' }, { status: 403 })

    const period = await prisma.hrEvaluationPeriod.findFirst({
      where: { id, organizationId: hrCtx.organizationId },
      include: {
        _count: { select: { evaluations: { where: evaluationWhere } } },
      },
    })
    if (!period) {
      return privateApiJson({ error: 'この評価期間は見つかりませんでした。一覧から選び直してください。' }, { status: 404 })
    }

    return privateApiJson({
      success: true,
      period: {
        ...period,
        canManageEvaluations: reader.employeeId === null,
        ...(reader.employeeId === null ? { deletionRevision: await getHrEvaluationPeriodDeletionRevision(prisma, hrCtx.organizationId, id) } : {}),
        evaluationTemplate: period.evaluationTemplate as any,
        evaluationCount: period._count.evaluations,
      },
    })
  } catch (e: any) {
    if (e instanceof HrEvaluationOverviewError) return privateApiJson({ error: e.message, code: e.status === 409 ? 'PERIOD_OVERVIEW_CHANGED' : 'PERIOD_OVERVIEW_UNAVAILABLE' }, { status: e.status })
    console.error('[hr/evaluations/periods/[id]] unexpected error')
    return privateApiJson(
      { error: '評価期間を読み込めませんでした。時間をおいて再読み込みしてください。' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as { id?: string } | undefined)?.id) return privateApiJson({ error: 'ログイン状態か所属する組織を確かめて、もう一度お試しください。' }, { status: 401 })
    const hrCtx = await getHrContext()
    if (!hrCtx) return privateApiJson({ error: 'ログイン状態か所属する組織を確かめて、もう一度お試しください。' }, { status: 401 })
    if (!hasMinRole(hrCtx.role, HrMemberRole.ADMIN)) return privateApiJson({ error: 'この操作に必要な権限がありません。組織の管理者にご相談ください。' }, { status: 403 })
    const expectedOrganization = req.headers.get('X-HR-Organization-Id')
    if (expectedOrganization && expectedOrganization !== hrCtx.organizationId) return privateApiJson({ error: '組織が変更されています。再取得してください。' }, { status: 403 })
    const { id } = await ctx.params
    const { expectedUpdatedAt, expectedDeletionRevision } = readHrEvaluationPeriodDeletionInput(await req.json().catch(() => null))
    const result = await runHrEvaluationAdminMutation(prisma, hrCtx, async tx => {
      await tx.$queryRaw`SELECT id FROM hr_evaluation_periods WHERE id = ${id} AND "organizationId" = ${hrCtx.organizationId} FOR UPDATE`
      const existing = await tx.hrEvaluationPeriod.findFirst({ where: { id, organizationId: hrCtx.organizationId } })
      if (!existing) return privateApiJson({ error: 'この評価期間は見つかりませんでした。一覧から選び直してください。' }, { status: 404 })
      if (existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()) return privateApiJson({ error: '評価期間が変更されています。削除前に再取得してください。', code: 'PERIOD_CHANGED' }, { status: 409 })
      await tx.$queryRaw`SELECT id FROM hr_evaluations WHERE "periodId" = ${id} ORDER BY id FOR UPDATE`
      if (await getHrEvaluationPeriodDeletionRevision(tx, hrCtx.organizationId, id) !== expectedDeletionRevision) return privateApiJson({ error: '対象の評価が変更されています。削除前に評価期間を再取得してください。', code: 'PERIOD_CHANGED' }, { status: 409 })
      const deleted = await tx.hrEvaluationPeriod.deleteMany({ where: { id, organizationId: hrCtx.organizationId, updatedAt: expectedUpdatedAt } })
      return deleted.count === 1 ? privateApiJson({ success: true, periodId: id, organizationId: hrCtx.organizationId }) : privateApiJson({ error: '評価期間が変更されています。再取得してください。' }, { status: 409 })
    })
    return result.allowed ? result.value : privateApiJson({ error: '削除権限が変更されています。' }, { status: 403 })
  } catch (error: unknown) {
    if (error instanceof HrEvaluationInputError) return privateApiJson({ error: error.message }, { status: 400 })
    console.error('[hr/evaluations/periods/[id]][DELETE] failed')
    return privateApiJson({ error: '評価期間を削除できませんでした。時間をおいて、もう一度お試しください。' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as { id?: string } | undefined)?.id) return privateApiJson({ error: 'ログイン状態か所属する組織を確かめて、もう一度お試しください。' }, { status: 401 })
    const hrCtx = await getHrContext()
    if (!hrCtx) return privateApiJson({ error: 'ログイン状態か所属する組織を確かめて、もう一度お試しください。' }, { status: 401 })
    if (!hasMinRole(hrCtx.role, HrMemberRole.ADMIN)) return privateApiJson({ error: 'この操作に必要な権限がありません。組織の管理者にご相談ください。' }, { status: 403 })
    const expectedOrganization = req.headers.get('X-HR-Organization-Id')
    const operationId = req.headers.get('X-HR-Evaluation-Period-Operation-Id')
    if (operationId !== null && !validHrEvaluationPeriodOperationId(operationId)) return privateApiJson({ error: '評価期間の操作情報を確認してください。' }, { status: 400 })
    if (operationId !== null ? expectedOrganization !== hrCtx.organizationId : expectedOrganization && expectedOrganization !== hrCtx.organizationId) return privateApiJson({ error: '組織が変更されています。再取得してください。' }, { status: 403 })
    const { id } = await ctx.params
    const body = await req.json().catch(() => null)
    const input = readHrEvaluationPeriodPatch(body)
    const result = await runHrEvaluationAdminMutation(prisma, hrCtx, async tx => {
      if (operationId) {
        const replay = await replayHrEvaluationPeriodOperation(tx, hrCtx, operationId, id, body)
        if (replay) return privateApiJson({ success: true, operation: { operationId, organizationId: hrCtx.organizationId, periodId: id, ...replay } })
      }
      const existing = await tx.hrEvaluationPeriod.findFirst({ where: { id, organizationId: hrCtx.organizationId } })
      if (!existing) return privateApiJson({ error: 'この評価期間は見つかりませんでした。一覧から選び直してください。' }, { status: 404 })
      if (existing.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) return privateApiJson({ error: '評価期間が変更されています。再取得して内容を確認してください。', code: 'PERIOD_CHANGED' }, { status: 409 })
      if (!['DRAFT', 'OPEN', 'IN_REVIEW', 'CLOSED'].includes(existing.status)) return privateApiJson({ error: '評価期間の状態を確認できません。内容を変更せず再取得してください。', code: 'PERIOD_STATE_UNKNOWN' }, { status: 409 })
      validateHrEvaluationPeriodRange(input.data, existing)
      const { evaluationTemplate, ...fields } = input.data
      const changed = await tx.hrEvaluationPeriod.updateMany({ where: { id, organizationId: hrCtx.organizationId, updatedAt: input.expectedUpdatedAt }, data: {
        ...fields,
        ...(Object.prototype.hasOwnProperty.call(input.data, 'evaluationTemplate') ? { evaluationTemplate: evaluationTemplate === null ? Prisma.DbNull : evaluationTemplate as Prisma.InputJsonValue } : {}),
        updatedAt: new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1)),
      } })
      if (changed.count !== 1) return privateApiJson({ error: '評価期間が変更されています。再取得してください。', code: 'PERIOD_CHANGED' }, { status: 409 })
      const updated = await tx.hrEvaluationPeriod.findFirst({ where: { id, organizationId: hrCtx.organizationId } })
      if (!updated) throw Error('Updated evaluation period unavailable')
      if (operationId) await completeHrEvaluationPeriodOperation(tx, hrCtx, operationId, id, body, input.expectedUpdatedAt, updated.updatedAt)
      return privateApiJson({ success: true, period: updated, ...(operationId ? { operation: { operationId, organizationId: hrCtx.organizationId, periodId: id, state: 'completed', updatedAt: updated.updatedAt.toISOString() } } : {}) })
    })
    if (!result.allowed) return privateApiJson({ error: '更新権限が変更されています。ログイン状態と権限を確認してください。' }, { status: 403 })
    return result.value
  } catch (error: unknown) {
    if (error instanceof HrEvaluationPeriodOperationConflict) return privateApiJson({ error: '評価期間の操作情報が一致しません。' }, { status: 409 })
    if (error instanceof HrEvaluationPeriodOperationAccessError) return privateApiJson({ error: error.message }, { status: error.status })
    if (error instanceof HrEvaluationPeriodInputError) return privateApiJson({ error: error.message }, { status: 400 })
    console.error('[hr/evaluations/periods/[id]] unexpected error')
    return privateApiJson({ error: '評価期間を保存できませんでした。時間をおいて、もう一度お試しください。' }, { status: 500 })
  }
}
