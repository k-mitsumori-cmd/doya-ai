import { Prisma } from '@prisma/client'
import { privateApiJson } from '@/lib/private-api-response'
import { runHrEvaluationAdminMutation } from '@/lib/hr/evaluation-mutation'
import { validHrEvaluationOperationId, readHrEvaluationCreationInput, readHrEvaluationCreationOperation, hrEvaluationCreationFingerprint, readHrEvaluationCreationReceipt, saveHrEvaluationCreationReceipt, cancelHrEvaluationCreation, HrEvaluationCreationInputError, HrEvaluationCreationConflict } from '@/lib/hr/evaluation-creation-operation'
import { redactEvaluationDepartment } from '@/lib/hr/evaluation-scope'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHrContext } from '@/lib/hr/access'
import { getEvaluationReader, getEvaluationReadWhere } from '@/lib/hr/evaluation-access'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/lib/hr/constants'

export async function GET(req: NextRequest) {
  try {
    const ctx = await getHrContext()
    if (!ctx) {
      return privateApiJson({ error: 'Unauthorized' }, { status: 401 })
    }

    if (req.nextUrl.searchParams.get('format') === 'operation') return await evaluationOperationRequest(req, ctx, false)

    const reader = await getEvaluationReader(ctx)
    if (!reader) return privateApiJson({ error: '評価を閲覧する権限がありません' }, { status: 403 })

    const url = req.nextUrl
    const periodId = url.searchParams.get('periodId') || ''
    const employeeId = url.searchParams.get('employeeId') || ''
    const status = url.searchParams.get('status') || ''
    const page = Number(url.searchParams.get('page') || '1')
    const requestedPageSize = Number(url.searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE))
    if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000 ||
        !Number.isSafeInteger(requestedPageSize) || requestedPageSize < 1) {
      return privateApiJson({ error: 'ページ番号・件数が不正です' }, { status: 400 })
    }
    const pageSize = Math.min(MAX_PAGE_SIZE, requestedPageSize)

    const where: any = await getEvaluationReadWhere(ctx)

    if (periodId) {
      where.periodId = periodId
      const period = await prisma.hrEvaluationPeriod.findFirst({
        where: { id: periodId, organizationId: ctx.organizationId },
      })
      if (!period) {
        return privateApiJson({ error: 'Period not found' }, { status: 404 })
      }
    }

    if (employeeId) where.employeeId = employeeId
    if (status) where.status = status

    const [items, total] = await Promise.all([
      prisma.hrEvaluation.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true, firstName: true, lastName: true,
              position: true, departmentId: true,
              department: { select: { id: true, name: true, organizationId: true } },
            },
          },
          evaluator: {
            select: { id: true, firstName: true, lastName: true },
          },
          period: { select: { id: true, name: true, startDate: true, endDate: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.hrEvaluation.count({ where }),
    ])

    return privateApiJson({
      success: true,
      items: items.map((e) => ({
        ...e,
        employee: redactEvaluationDepartment(e.employee, ctx.organizationId),
        goals: e.goals as any,
        competencies: e.competencies as any,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch {
    console.error('[hr/evaluations][GET] failed')
    return privateApiJson(
      { error: 'Failed to fetch evaluations' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as { id?: string } | undefined)?.id) return privateApiJson({ error: 'Unauthorized' }, { status: 401 })
    const ctx = await getHrContext()
    if (!ctx) return privateApiJson({ error: 'Unauthorized' }, { status: 401 })
    const reader = await getEvaluationReader(ctx)
    if (!reader || reader.employeeId !== null) return privateApiJson({ error: '評価の作成はオーナー・管理者のみ実行できます' }, { status: 403 })
    const operation = readHrEvaluationCreationOperation(req)
    if (operation === false) return privateApiJson({ error: '評価作成の操作情報を確認してください。' }, { status: 400 })
    if (operation && operation.organizationId !== ctx.organizationId) return privateApiJson({ error: '組織が変更されています。作成結果を元の組織で確認してください。' }, { status: 403 })
    const input = readHrEvaluationCreationInput(await req.json().catch(() => null)), fingerprint = hrEvaluationCreationFingerprint(input)
    const result = await runHrEvaluationAdminMutation(prisma, ctx, async tx => {
      if (operation) {
        const state = await readHrEvaluationCreationReceipt(tx, ctx, operation.operationId, fingerprint)
        if (state.state === 'created') return privateApiJson({ success: true, operationId: operation.operationId, organizationId: ctx.organizationId, ...state })
        if (state.state !== 'not_received') return privateApiJson({ error: '終了済みの操作で評価を作成することはできません。', state: state.state }, { status: 409 })
      }
      const period = await tx.hrEvaluationPeriod.findFirst({ where: { id: input.periodId, organizationId: ctx.organizationId }, select: { id: true } })
      if (!period) return privateApiJson({ error: 'Period not found' }, { status: 404 })
      if (await tx.hrEmployee.count({ where: { id: input.employeeId, organizationId: ctx.organizationId } }) !== 1) return privateApiJson({ error: 'Employee not found' }, { status: 404 })
      if (input.evaluatorId && await tx.hrEmployee.count({ where: { id: input.evaluatorId, organizationId: ctx.organizationId } }) !== 1) return privateApiJson({ error: '評価者が同じ組織に存在しません' }, { status: 400 })
      const existing = await tx.hrEvaluation.findUnique({ where: { periodId_employeeId: { periodId: input.periodId, employeeId: input.employeeId } }, select: { id: true } })
      if (existing) return privateApiJson({ error: 'この従業員の評価はこの期間に既に作成されています' }, { status: 400 })
      const evaluation = await tx.hrEvaluation.create({ data: { ...input, goals: input.goals === null ? Prisma.DbNull : input.goals, competencies: input.competencies === null ? Prisma.DbNull : input.competencies, status: 'DRAFT' },
        include: { employee: { select: { id: true, firstName: true, lastName: true, position: true } }, period: { select: { id: true, name: true } } } })
      if (!operation) return privateApiJson({ success: true, evaluation })
      const snapshot = { id: evaluation.id, periodId: evaluation.periodId, employeeId: evaluation.employeeId, evaluatorId: evaluation.evaluatorId, status: evaluation.status, updatedAt: evaluation.updatedAt.toISOString() }
      await saveHrEvaluationCreationReceipt(tx, ctx, operation.operationId, fingerprint, snapshot)
      return privateApiJson({ success: true, operationId: operation.operationId, organizationId: ctx.organizationId, state: 'created', evaluation: snapshot })
    })
    return result.allowed ? result.value : privateApiJson({ error: '評価作成の権限が変更されています。' }, { status: 403 })
  } catch (error: unknown) {
    if (error instanceof HrEvaluationCreationInputError) return privateApiJson({ error: '評価の作成内容が正しくありません。' }, { status: 400 })
    if (error instanceof HrEvaluationCreationConflict) return privateApiJson({ error: '同じ操作に異なる作成内容を指定することはできません。' }, { status: 409 })
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') return privateApiJson({ error: '評価が作成または変更されています。作成結果を確認してください。' }, { status: 409 })
    console.error('[hr/evaluations][POST] failed')
    return privateApiJson({ error: 'Failed to create evaluation' }, { status: 500 })
  }
}

async function evaluationOperationRequest(req: NextRequest, ctx: NonNullable<Awaited<ReturnType<typeof getHrContext>>>, cancel: boolean) {
  if (!['OWNER', 'ADMIN'].includes(ctx.role)) return privateApiJson({ error: '権限がありません' }, { status: 403 })
  const query = req.nextUrl.searchParams, operationId = query.get('operationId'), organizationId = query.get('organizationId')
  if (query.getAll('format').length !== 1 || query.get('format') !== 'operation' || query.getAll('operationId').length !== 1 || query.getAll('organizationId').length !== 1 ||
    !validHrEvaluationOperationId(operationId) || !organizationId || [...query.keys()].some(key => !['format', 'operationId', 'organizationId'].includes(key))) return privateApiJson({ error: '評価作成の操作情報を確認してください。' }, { status: 400 })
  if (organizationId !== ctx.organizationId) return privateApiJson({ error: '組織が変更されています。元の組織で結果を確認してください。' }, { status: 403 })
  const result = await runHrEvaluationAdminMutation(prisma, ctx, tx => cancel ? cancelHrEvaluationCreation(tx, ctx, operationId) : readHrEvaluationCreationReceipt(tx, ctx, operationId))
  return result.allowed ? privateApiJson({ success: true, operationId, organizationId, ...result.value }) : privateApiJson({ error: '権限が変更されています。' }, { status: 403 })
}
export async function DELETE(req: NextRequest) {
  try {
    const ctx = await getHrContext()
    if (!ctx) return privateApiJson({ error: 'Unauthorized' }, { status: 401 })
    if (req.nextUrl.searchParams.get('format') !== 'operation') return privateApiJson({ error: 'この操作はサポートされていません。' }, { status: 405 })
    return await evaluationOperationRequest(req, ctx, true)
  } catch {
    console.error('[hr/evaluations][DELETE] failed')
    return privateApiJson({ error: '作成結果を確認できませんでした。' }, { status: 500 })
  }
}
