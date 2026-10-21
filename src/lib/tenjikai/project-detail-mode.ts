import { sectionHref, type Section } from './nav'
import type { TenjikaiProjectDetail } from './project-detail-read'

export type ProjectMode =
  | { kind: 'new' }
  | { kind: 'invalid'; values: string[] }
  | { kind: 'saved'; id: string }

type ProjectQuery = Pick<URLSearchParams, 'has' | 'getAll'>

export function projectModeFromQuery(query: ProjectQuery): ProjectMode {
  if (!query.has('project')) return { kind: 'new' }
  const values = query.getAll('project')
  if (values.length !== 1 || !values[0].trim()) return { kind: 'invalid', values }
  return { kind: 'saved', id: values[0] }
}

export function projectSectionHref(section: Section, mode: ProjectMode): string {
  const base = sectionHref(section)
  if (section === 'new' || mode.kind === 'new') return base
  const params = new URLSearchParams()
  if (mode.kind === 'saved') params.append('project', mode.id)
  else for (const value of mode.values) params.append('project', value)
  return `${base}?${params.toString()}`
}

export type ReadyProjectDetail = Extract<TenjikaiProjectDetail, { state: 'ready_partial' }>
export type ProjectDetailResponse = ReadyProjectDetail & { actorId: string }

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}
function string(value: unknown): value is string { return typeof value === 'string' }
function number(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) }
function iso(value: unknown): value is string { return string(value) && !Number.isNaN(Date.parse(value)) }
function colors(value: unknown): boolean {
  const row = record(value)
  return !!row && string(row.primary) && string(row.secondary) && string(row.accent)
}
function validAnalysis(value: unknown, reasons: string[]): boolean {
  const row = record(value)
  if (!row) return false
  if (row.state === 'missing') return row.value === null && reasons.includes('analysis_not_saved')
  if (row.state === 'invalid') {
    return row.value === null && reasons.includes('analysis_invalid') && Array.isArray(row.invalidFields)
      && row.invalidFields.length > 0 && row.invalidFields.every(field => ['valueProps', 'targets', 'brandColors'].includes(field))
  }
  if (row.state !== 'saved' || reasons.includes('analysis_not_saved') || reasons.includes('analysis_invalid')) return false
  const saved = record(row.value)
  return !!saved && ['brand', 'category', 'headline', 'subline', 'tone'].every(key => string(saved[key]))
    && (saved.logoUrl === null || string(saved.logoUrl))
    && Array.isArray(saved.targets) && saved.targets.every(string)
    && Array.isArray(saved.valueProps) && saved.valueProps.every(item => {
      const prop = record(item)
      return !!prop && string(prop.title) && string(prop.body)
    }) && colors(saved.colors)
}

/** c2aの実DTOを表示前に検査する。業務DTOへunknownを直接castしない。 */
export function readProjectDetailResponse(body: unknown, actorId: string, projectId: string): ProjectDetailResponse | null {
  const row = record(body)
  if (!row || row.state !== 'ready_partial' || row.actorId !== actorId) return null
  const project = record(row.project)
  if (!project || project.id !== projectId || project.key !== `tenjikai:project:${projectId}`) return null
  const textFields = ['id', 'key', 'projectName', 'serviceUrl', 'eventName', 'eventDate', 'boothPosition', 'goal', 'status']
  const dateFields = ['eventStartAt', 'createdAt', 'updatedAt']
  const numberFields = ['eventDays', 'komaCols', 'komaRows', 'boothWidthM', 'boothDepthM', 'budgetYen', 'staffCount']
  if (!textFields.every(key => string(project[key])) || !dateFields.every(key => iso(project[key])) || !numberFields.every(key => number(project[key]))) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(project.eventDate as string)) return null
  if (project.venueId !== null && !string(project.venueId)) return null
  const children = record(row.children)
  const reasons = row.partialReasons
  if (!children || children.state !== 'not_read' || !Array.isArray(reasons) || !reasons.every(string)) return null
  if (!reasons.includes('children_not_read') || reasons.some(reason => !['children_not_read', 'venue_not_saved', 'analysis_not_saved', 'analysis_invalid'].includes(reason))) return null
  if (reasons.includes('venue_not_saved') !== (project.venueId === null)) return null
  if (!validAnalysis(row.analysis, reasons)) return null
  return row as ProjectDetailResponse
}
