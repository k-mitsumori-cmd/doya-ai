export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getEvaluationReadWhere } from '@/lib/hr/evaluation-access'
import { prisma } from '@/lib/prisma'
import { getHrContext, hasMinRole } from '@/lib/hr/access'
import { HrMemberRole } from '@/lib/hr/types'
import { Prisma } from '@prisma/client'
import { privateApiJson } from '@/lib/private-api-response'
import { runHrEvaluationAdminMutation } from '@/lib/hr/evaluation-mutation'
import { readHrEvaluationPeriodCreate, HrEvaluationPeriodInputError } from '@/lib/hr/evaluation-period-input'
import { validHrEvaluationPeriodCreationId, hrEvaluationPeriodCreationFingerprint, readHrEvaluationPeriodCreation, saveHrEvaluationPeriodCreation, cancelHrEvaluationPeriodCreation, HrEvaluationPeriodCreationConflict } from '@/lib/hr/evaluation-period-creation-operation'
import { readHrEvaluationPeriodListPage, HrEvaluationPeriodListError } from '@/lib/hr/evaluation-period-list'

export async function GET(req: NextRequest) {
  try {
    const ctx = await getHrContext()
    if (!ctx) {
      return privateApiJson({ error: 'Unauthorized' }, { status: 401 })
    }

    if (req.nextUrl.searchParams.get('format') === 'creation-operation') return await creationOperationRequest(req, ctx, false)

    const expectedOrganization = req.headers.get('X-HR-Organization-Id')
    if (expectedOrganization !== null && expectedOrganization !== ctx.organizationId) return privateApiJson({ error: '組織が変更されています。再取得してください。' }, { status: 403 })
    if (req.nextUrl.searchParams.get('format') === 'pages') {
      const query = req.nextUrl.searchParams
      if (query.getAll('format').length !== 1 || query.getAll('cursor').length > 1 || [...query.keys()].some(k => !['format', 'cursor'].includes(k))) return privateApiJson({ error: '評価期間一覧の取得条件が正しくありません。' }, { status: 400 })
      return privateApiJson(await readHrEvaluationPeriodListPage(prisma, ctx, query.get('cursor')))
    }

    const evaluationWhere = await getEvaluationReadWhere(ctx)

    const periods = await prisma.hrEvaluationPeriod.findMany({
      where: { organizationId: ctx.organizationId },
      include: {
        _count: { select: { evaluations: { where: evaluationWhere } } },
      },
      orderBy: { startDate: 'desc' },
    })

    return privateApiJson({
      success: true,
      canCreatePeriods: hasMinRole(ctx.role, HrMemberRole.ADMIN),
      periods: periods.map((p) => ({
        ...p,
        evaluationTemplate: p.evaluationTemplate as any,
        evaluationCount: p._count.evaluations,
      })),
    })
  } catch (e: any) {
    if (e instanceof HrEvaluationPeriodListError) return privateApiJson({ error: e.status === 409 ? '評価期間または評価が更新されました。再取得してください。' : '評価期間一覧を確認できませんでした。', code: e.code }, { status: e.status })
    console.error('[hr/evaluations/periods] unexpected error')
    return privateApiJson(
      { error: 'Failed to fetch evaluation periods' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as any)?.id) {
      return privateApiJson({ error: 'Unauthorized' }, { status: 401 })
    }

    const ctx = await getHrContext()
    if (!ctx) {
      return privateApiJson({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasMinRole(ctx.role, HrMemberRole.ADMIN)) {
      return privateApiJson({ error: 'Forbidden' }, { status: 403 })
    }

    const expectedOrganization = req.headers.get('X-HR-Organization-Id')
    if (expectedOrganization && expectedOrganization !== ctx.organizationId) return privateApiJson({ error: '組織が変更されています。作成前に再取得してください。' }, { status: 403 })
    const operationId = req.headers.get('X-HR-Evaluation-Period-Creation-Operation')
    if (operationId !== null && (!validHrEvaluationPeriodCreationId(operationId) || !expectedOrganization)) return privateApiJson({ error: '評価期間作成の操作情報を確認してください。' }, { status: 400 })
    const input = readHrEvaluationPeriodCreate(await req.json().catch(() => null))
    const fingerprint = hrEvaluationPeriodCreationFingerprint(input)
    const result = await runHrEvaluationAdminMutation(prisma, ctx, async tx => {
      if (operationId) {
        const previous = await readHrEvaluationPeriodCreation(tx, ctx, operationId, fingerprint)
        if (previous.state === 'created') return privateApiJson({ success: true, operationId, organizationId: ctx.organizationId, ...previous })
        if (previous.state !== 'not_received') return privateApiJson({ error: '終了済みの操作で評価期間を作成することはできません。', state: previous.state }, { status: 409 })
      }
      const period = await tx.hrEvaluationPeriod.create({ data: {
        organizationId: ctx.organizationId,
        name: input.name, startDate: input.startDate, endDate: input.endDate, status: input.status,
        evaluationTemplate: input.evaluationTemplate === undefined || input.evaluationTemplate === null ? Prisma.DbNull : input.evaluationTemplate as Prisma.InputJsonValue,
      } })
      if (!operationId) return privateApiJson({ success: true, period })
      const summary = { id: period.id, organizationId: period.organizationId, status: period.status, createdAt: period.createdAt.toISOString(), updatedAt: period.updatedAt.toISOString() }
      await saveHrEvaluationPeriodCreation(tx, ctx, operationId, fingerprint, summary)
      return privateApiJson({ success: true, operationId, organizationId: ctx.organizationId, state: 'created', fingerprint, period: summary })
    })
    return result.allowed ? result.value : privateApiJson({ error: '評価期間を作成する権限が変更されています。' }, { status: 403 })
  } catch (error: unknown) {
    if (error instanceof HrEvaluationPeriodInputError) return privateApiJson({ error: '評価期間の作成内容を確認してください。名称・期間・状態を正しく指定してください。' }, { status: 400 })
    if (error instanceof HrEvaluationPeriodCreationConflict) return privateApiJson({ error: '評価期間の作成操作と保存記録が一致しません。作成結果を確認してください。' }, { status: 409 })
    console.error('[hr/evaluations/periods][POST] failed')
    return privateApiJson({ error: 'Failed to create evaluation period' }, { status: 500 })
  }
}

async function creationOperationRequest(req: NextRequest, ctx: NonNullable<Awaited<ReturnType<typeof getHrContext>>>, cancel: boolean) {
  if (!['OWNER', 'ADMIN'].includes(ctx.role)) return privateApiJson({ error: '評価期間の作成結果を確認する権限がありません。' }, { status: 403 })
  const query = req.nextUrl.searchParams, operationId = query.get('operationId'), organizationId = query.get('organizationId')
  if (query.getAll('format').length !== 1 || query.get('format') !== 'creation-operation' || query.getAll('operationId').length !== 1 || query.getAll('organizationId').length !== 1 ||
    !validHrEvaluationPeriodCreationId(operationId) || !organizationId || [...query.keys()].some(k => !['format', 'operationId', 'organizationId'].includes(k))) return privateApiJson({ error: '評価期間作成の操作情報を確認してください。' }, { status: 400 })
  const expectedOrganization = req.headers.get('X-HR-Organization-Id')
  if (organizationId !== ctx.organizationId || expectedOrganization !== null && expectedOrganization !== ctx.organizationId) return privateApiJson({ error: '組織が変更されています。元の組織で結果を確認してください。' }, { status: 403 })
  const result = await runHrEvaluationAdminMutation(prisma, ctx, tx => cancel ? cancelHrEvaluationPeriodCreation(tx, ctx, operationId) : readHrEvaluationPeriodCreation(tx, ctx, operationId))
  return result.allowed ? privateApiJson({ success: true, operationId, organizationId, ...result.value }) : privateApiJson({ error: '評価期間の作成権限が変更されています。' }, { status: 403 })
}

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await getHrContext()
    if (!ctx) return privateApiJson({ error: 'Unauthorized' }, { status: 401 })
    if (req.nextUrl.searchParams.get('format') !== 'creation-operation') return privateApiJson({ error: 'この操作はサポートされていません。' }, { status: 405 })
    return await creationOperationRequest(req, ctx, true)
  } catch (error: unknown) {
    if (error instanceof HrEvaluationPeriodCreationConflict) return privateApiJson({ error: '評価期間の作成操作と保存記録が一致しません。' }, { status: 409 })
    console.error('[hr/evaluations/periods][DELETE] failed')
    return privateApiJson({ error: '評価期間の作成結果を確認できませんでした。' }, { status: 500 })
  }
}
