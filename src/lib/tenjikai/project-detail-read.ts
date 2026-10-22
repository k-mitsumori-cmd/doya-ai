// 保存された案件の所有者限定read。認証済userIdの取得・検証は呼出元の責務。
// 完全なGeneratedPlan/ProjectInputの復元ではない。未保存値をmockや既定会場で埋めない。
import type { Prisma, PrismaClient } from '@prisma/client'

export const PROJECT_DETAIL_SELECT = {
  id: true, name: true, serviceUrl: true, venueId: true, eventName: true, eventStart: true,
  eventDays: true, komaCols: true, komaRows: true, boothWidthM: true, boothDepthM: true,
  boothPosition: true, budgetYen: true, goal: true, staffCount: true, status: true,
  createdAt: true, updatedAt: true,
  analysis: { select: {
    brand: true, category: true, headline: true, subline: true, valueProps: true,
    targets: true, brandColors: true, tone: true, logoUrl: true,
  } },
} as const satisfies Prisma.TenjikaiProjectSelect

export type ProjectDetailRow = Prisma.TenjikaiProjectGetPayload<{ select: typeof PROJECT_DETAIL_SELECT }>
export interface ProjectDetailQuery {
  where: { id: string; userId: string }
  select: typeof PROJECT_DETAIL_SELECT
}
export interface TenjikaiProjectDetailContext {
  userId: unknown
  db: Pick<PrismaClient, 'tenjikaiProject'>
}

/** 保存された入力事実。venueIdなどの不足があるためProjectInputとは別型にする。 */
export interface SavedProjectDetail {
  id: string
  key: `tenjikai:project:${string}`
  projectName: string
  serviceUrl: string
  venueId: string | null
  eventName: string
  eventStartAt: string
  eventDate: string
  eventDays: number
  komaCols: number
  komaRows: number
  boothWidthM: number
  boothDepthM: number
  boothPosition: string
  budgetYen: number
  goal: string
  staffCount: number
  status: string
  createdAt: string
  updatedAt: string
}

/** domainは保存列がないので追加しない。SiteAnalysisを捏造して返さない。 */
export interface SavedProjectAnalysis {
  brand: string
  category: string
  headline: string
  subline: string
  valueProps: { title: string; body: string }[]
  targets: string[]
  colors: { primary: string; secondary: string; accent: string }
  tone: string
  logoUrl: string | null
}

type AnalysisJsonField = 'valueProps' | 'targets' | 'brandColors'
export type ProjectDetailAnalysis =
  | { state: 'missing'; value: null }
  | { state: 'invalid'; value: null; invalidFields: AnalysisJsonField[] }
  | { state: 'saved'; value: SavedProjectAnalysis }
export type ProjectDetailPartialReason = 'children_not_read' | 'venue_not_saved' | 'analysis_not_saved' | 'analysis_invalid'
export type TenjikaiProjectDetail =
  | { state: 'not_authenticated' }
  | { state: 'not_found' }
  | { state: 'error'; reason: 'read_failed' | 'invalid_project' }
  | {
    state: 'ready_partial'
    project: SavedProjectDetail
    analysis: ProjectDetailAnalysis
    partialReasons: ProjectDetailPartialReason[]
    /** 子行を照会していない。0件・保存完了・準備完了を意味しない。 */
    children: { state: 'not_read' }
  }

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}
function readValueProps(value: unknown): SavedProjectAnalysis['valueProps'] | null {
  if (!Array.isArray(value)) return null
  const result: SavedProjectAnalysis['valueProps'] = []
  for (const item of value) {
    const row = record(item)
    if (!row || typeof row.title !== 'string' || typeof row.body !== 'string') return null
    result.push({ title: row.title, body: row.body })
  }
  return result
}
function readColors(value: unknown): SavedProjectAnalysis['colors'] | null {
  const row = record(value)
  return row && typeof row.primary === 'string' && typeof row.secondary === 'string' && typeof row.accent === 'string'
    ? { primary: row.primary, secondary: row.secondary, accent: row.accent } : null
}
function readAnalysis(row: ProjectDetailRow['analysis']): ProjectDetailAnalysis {
  if (!row) return { state: 'missing', value: null }
  const valueProps = readValueProps(row.valueProps)
  const targets = Array.isArray(row.targets) && row.targets.every((value): value is string => typeof value === 'string') ? [...row.targets] : null
  const colors = readColors(row.brandColors)
  if (!valueProps || !targets || !colors) {
    const invalidFields: AnalysisJsonField[] = []
    if (!valueProps) invalidFields.push('valueProps')
    if (!targets) invalidFields.push('targets')
    if (!colors) invalidFields.push('brandColors')
    return { state: 'invalid', value: null, invalidFields }
  }
  return { state: 'saved', value: {
    brand: row.brand, category: row.category, headline: row.headline, subline: row.subline,
    valueProps, targets, colors, tone: row.tone, logoUrl: row.logoUrl,
  } }
}

/** 所有条件を含むfindFirst1回。会期の過去/未来やstatusは所有詳細の可否に使わない。 */
export async function readTenjikaiProjectDetail(ctx: TenjikaiProjectDetailContext, projectId: unknown): Promise<TenjikaiProjectDetail> {
  if (typeof ctx.userId !== 'string' || !ctx.userId.trim()) return { state: 'not_authenticated' }
  if (typeof projectId !== 'string' || !projectId.trim()) return { state: 'not_found' }
  let row: ProjectDetailRow | null
  try {
    row = await ctx.db.tenjikaiProject.findFirst({ where: { id: projectId, userId: ctx.userId }, select: PROJECT_DETAIL_SELECT })
  } catch {
    return { state: 'error', reason: 'read_failed' }
  }
  if (!row) return { state: 'not_found' }
  if (![row.eventStart, row.createdAt, row.updatedAt].every(date => date instanceof Date && Number.isFinite(date.getTime()))) return { state: 'error', reason: 'invalid_project' }
  const eventEpoch = row.eventStart.getTime()
  const analysis = readAnalysis(row.analysis)
  const partialReasons: ProjectDetailPartialReason[] = ['children_not_read']
  if (row.venueId === null) partialReasons.push('venue_not_saved')
  if (analysis.state === 'missing') partialReasons.push('analysis_not_saved')
  if (analysis.state === 'invalid') partialReasons.push('analysis_invalid')
  return {
    state: 'ready_partial',
    project: {
      id: row.id, key: `tenjikai:project:${row.id}`, projectName: row.name, serviceUrl: row.serviceUrl,
      venueId: row.venueId, eventName: row.eventName, eventStartAt: row.eventStart.toISOString(),
      eventDate: new Date(eventEpoch + 9 * 3_600_000).toISOString().slice(0, 10), eventDays: row.eventDays,
      komaCols: row.komaCols, komaRows: row.komaRows, boothWidthM: row.boothWidthM, boothDepthM: row.boothDepthM,
      boothPosition: row.boothPosition, budgetYen: row.budgetYen, goal: row.goal, staffCount: row.staffCount,
      status: row.status, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    },
    analysis, partialReasons, children: { state: 'not_read' },
  }
}
