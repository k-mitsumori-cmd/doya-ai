import { evaluationOrganizationWhere } from '@/lib/hr/evaluation-scope'
import { prisma } from '@/lib/prisma'
import type { HrContext } from './types'
import type { Prisma } from '@prisma/client'
import { lowerToolRole } from '@/lib/company-roles/tool-roles'
type EvaluationAccessDb = Pick<Prisma.TransactionClient, 'hrOrganizationMember' | 'hrEmployee'>

/** nullは閲覧不可。employeeId=nullは組織管理者、それ以外は本人／指定評価者。 */
export async function getEvaluationReader(ctx: HrContext, db: EvaluationAccessDb = prisma): Promise<{ employeeId: string | null } | null> {
  if (!['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'].includes(ctx.role)) return null
  const member = await db.hrOrganizationMember.findFirst({
    where: { id: ctx.memberId, userId: ctx.userId, organizationId: ctx.organizationId, status: 'ACTIVE' },
    select: { employeeId: true, role: true },
  })
  // DB の役割が下がっていたら止める。DB の役割が ctx 以上なら通し、判定は ctx の役割（会社の上限を当てたもの）で行う
  if (!member || lowerToolRole('hr', member.role, ctx.role) !== ctx.role) return null
  if (ctx.role === 'OWNER' || ctx.role === 'ADMIN') return { employeeId: null }
  if (!member.employeeId) return null
  const ownEmployee = await db.hrEmployee.count({ where: { id: member.employeeId, organizationId: ctx.organizationId } })
  return ownEmployee === 1 ? { employeeId: member.employeeId } : null
}

/** 評価の対象者・指定評価者と、組織管理者だけに詳細を公開する。 */
export async function canReadEvaluation(
  ctx: HrContext,
  evaluation: { employeeId: string; evaluatorId: string | null }, db: EvaluationAccessDb = prisma
): Promise<boolean> {
  const reader = await getEvaluationReader(ctx, db)
  if (!reader || !(await evaluationRelationsAreOwn(ctx, evaluation, db))) return false
  return reader.employeeId === null || reader.employeeId === evaluation.employeeId || reader.employeeId === evaluation.evaluatorId
}

/** 関連取得・集計でも同じ評価範囲を使う。閲覧不可なら評価を1件も返さない。 */
export async function getEvaluationReadWhere(ctx: HrContext): Promise<Prisma.HrEvaluationWhereInput> {
  const reader = await getEvaluationReader(ctx)
  const organization = evaluationOrganizationWhere(ctx.organizationId)
  if (!reader) return { ...organization, id: { in: [] } }
  if (reader.employeeId === null) return organization
  return { ...organization, OR: [{ employeeId: reader.employeeId }, { evaluatorId: reader.employeeId }] }
}

export type EvaluationRatingField = 'selfRating' | 'managerRating' | 'finalRating'

/** 自己・指定評価者・組織管理者の点数を別々の列へ保存する。 */
export async function getEvaluationRatingField(
  ctx: HrContext,
  evaluation: { employeeId: string; evaluatorId: string | null }, db: EvaluationAccessDb = prisma
): Promise<EvaluationRatingField | null> {
  const reader = await getEvaluationReader(ctx, db)
  if (!reader || !(await evaluationRelationsAreOwn(ctx, evaluation, db))) return null
  if (reader.employeeId === null) return 'finalRating'
  if (reader.employeeId === evaluation.employeeId) return 'selfRating'
  if (reader.employeeId === evaluation.evaluatorId) return 'managerRating'
  return null
}

/** Recheck both relation identifiers before exposing details or allowing rating/submit/AI work. */
async function evaluationRelationsAreOwn(ctx: HrContext, evaluation: { employeeId: string; evaluatorId: string | null }, db: EvaluationAccessDb) {
  const identifiers = [...new Set([evaluation.employeeId, ...(evaluation.evaluatorId ? [evaluation.evaluatorId] : [])])]
  const count = await db.hrEmployee.count({ where: { id: { in: identifiers }, organizationId: ctx.organizationId } })
  return identifiers.length > 0 && count === identifiers.length
}
