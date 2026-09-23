import type { HrContext } from './types'
import { getEvaluationReader } from './evaluation-access'
import type { Prisma } from '@prisma/client'

export const getOneOnOneViewer = getEvaluationReader
type Viewer = { employeeId: string | null } | null

export function canViewManagerNotes(viewer: Viewer, record: { managerId: string }): boolean {
  return !!viewer && (viewer.employeeId === null || viewer.employeeId === record.managerId)
}

/** 上司メモと、それを含み得る要約を当事者へ漏らさない。 */
export function filterOneOnOneFields<T extends { managerId: string }>(record: T, viewer: Viewer) {
  const permitted = canViewManagerNotes(viewer, record)
  return {
    ...record,
    ...(!permitted ? { managerNotes: undefined, managerNote: undefined, privateNotes: undefined, aiSummary: undefined, aiInsights: undefined } : {}),
    canViewManagerNotes: permitted,
  }
}

/** 一覧・関連履歴・件数にも同じ組織と当事者条件を適用する。 */
export async function getOneOnOneReadWhere(ctx: HrContext): Promise<Prisma.HrOneOnOneWhereInput> {
  const member = await getEvaluationReader(ctx)
  const organization = { organizationId: ctx.organizationId }
  if (!member) return { ...organization, id: { in: [] } }
  if (member.employeeId === null) return organization
  return { ...organization, OR: [{ employeeId: member.employeeId }, { managerId: member.employeeId }] }
}

/** 1on1の当事者・担当上司・有効な組織管理者だけにアクセスを許可する。 */
export async function canAccessOneOnOne(
  ctx: HrContext,
  record: { employeeId: string; managerId: string }
): Promise<boolean> {
  const member = await getEvaluationReader(ctx)
  if (!member) return false
  return member.employeeId === null || member.employeeId === record.employeeId || member.employeeId === record.managerId
}
