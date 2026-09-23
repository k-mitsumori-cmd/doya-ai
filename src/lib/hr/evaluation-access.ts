import { prisma } from '@/lib/prisma'
import type { HrContext } from './types'
import type { Prisma } from '@prisma/client'

/** nullは閲覧不可。employeeId=nullは組織管理者、それ以外は本人／指定評価者。 */
export async function getEvaluationReader(ctx: HrContext): Promise<{ employeeId: string | null } | null> {
  if (!['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'].includes(ctx.role)) return null
  const member = await prisma.hrOrganizationMember.findFirst({
    where: { id: ctx.memberId, userId: ctx.userId, organizationId: ctx.organizationId, status: 'ACTIVE' },
    select: { employeeId: true, role: true },
  })
  if (!member || member.role !== ctx.role) return null
  if (member.role === 'OWNER' || member.role === 'ADMIN') return { employeeId: null }
  return member.employeeId ? { employeeId: member.employeeId } : null
}

/** 評価の対象者・指定評価者と、組織管理者だけに詳細を公開する。 */
export async function canReadEvaluation(
  ctx: HrContext,
  evaluation: { employeeId: string; evaluatorId: string | null }
): Promise<boolean> {
  const reader = await getEvaluationReader(ctx)
  if (!reader) return false
  return reader.employeeId === null || reader.employeeId === evaluation.employeeId || reader.employeeId === evaluation.evaluatorId
}

/** 関連取得・集計でも同じ評価範囲を使う。閲覧不可なら評価を1件も返さない。 */
export async function getEvaluationReadWhere(ctx: HrContext): Promise<Prisma.HrEvaluationWhereInput> {
  const reader = await getEvaluationReader(ctx)
  const organization = { period: { is: { organizationId: ctx.organizationId } } }
  if (!reader) return { ...organization, id: { in: [] } }
  if (reader.employeeId === null) return organization
  return { ...organization, OR: [{ employeeId: reader.employeeId }, { evaluatorId: reader.employeeId }] }
}

export type EvaluationRatingField = 'selfRating' | 'managerRating' | 'finalRating'

/** 自己・指定評価者・組織管理者の点数を別々の列へ保存する。 */
export async function getEvaluationRatingField(
  ctx: HrContext,
  evaluation: { employeeId: string; evaluatorId: string | null }
): Promise<EvaluationRatingField | null> {
  const reader = await getEvaluationReader(ctx)
  if (!reader) return null
  if (reader.employeeId === null) return 'finalRating'
  if (reader.employeeId === evaluation.employeeId) return 'selfRating'
  if (reader.employeeId === evaluation.evaluatorId) return 'managerRating'
  return null
}
