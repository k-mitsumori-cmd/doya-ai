import type { GeneratedPlan } from './engine'

export type GenerationSave = {
  project: 'basic' | 'unknown' | 'not_created'
  venue: 'not_saved'
  analysis: 'saved' | 'unknown' | 'not_saved'
  plan: 'not_saved'
}

export type GenerationResult =
  | { state: 'generated'; actorId: string; clientRequestId: string; operationId?: string | null; projectId: string; plan: GeneratedPlan; save: GenerationSave }
  | { state: 'generation_failed'; actorId: string; clientRequestId: string; operationId?: string | null; projectId: string; message: string; save: GenerationSave }
  | { state: 'auth_changed'; actorId: string; clientRequestId: string; operationId?: string | null; projectId: null; message: string; save: GenerationSave }
  | { state: 'rejected' | 'outcome_unknown'; actorId: string | null; clientRequestId: string | null; operationId?: string | null; projectId: string | null; message: string; save: GenerationSave }

export const noProjectSave: GenerationSave = { project: 'not_created', venue: 'not_saved', analysis: 'not_saved', plan: 'not_saved' }
export const unknownProjectSave: GenerationSave = { ...noProjectSave, project: 'unknown', analysis: 'unknown' }
export const basicProjectSave: GenerationSave = { ...noProjectSave, project: 'basic' }

const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(nonempty)
function validPlan(value: unknown): boolean {
  const plan = object(value), analysis = object(plan?.analysis), colors = object(analysis?.colors)
  if (!plan || plan.source !== 'ai' || (plan.notice !== undefined && typeof plan.notice !== 'string') || !analysis || !colors) return false
  if (!['brand', 'domain', 'category', 'headline', 'subline', 'tone'].every(key => nonempty(analysis[key]))) return false
  if (!['primary', 'secondary', 'accent'].every(key => typeof colors[key] === 'string' && /^#[0-9a-fA-F]{6}$/.test(colors[key] as string))) return false
  if (!strings(analysis.targets) || analysis.targets.length < 1 || analysis.targets.length > 3
      || !Array.isArray(analysis.valueProps) || analysis.valueProps.length !== 3 || !analysis.valueProps.every(item => {
    const prop = object(item)
    return !!prop && nonempty(prop.title) && nonempty(prop.body)
  })) return false
  const booth = object(plan.boothCopy), creative = object(plan.creativeCopy)
  if (!booth || !creative || Object.keys(booth).some(key => !['A', 'B', 'C'].includes(key))
      || Object.keys(creative).some(key => !['backwall', 'rollup', 'flyer', 'clearfile', 'card', 'loop'].includes(key))) return false
  return Object.values(booth).every(value => {
    const row = object(value)
    return !!row && nonempty(row.name) && nonempty(row.concept) && nonempty(row.flow)
  }) && Object.values(creative).every(value => {
    const row = object(value)
    return !!row && nonempty(row.copy) && nonempty(row.purpose)
  })
}

export function readGenerationResult(body: unknown, actorId: string, requestId: string, operationId?: string): GenerationResult | null {
  const row = object(body)
  if (!row || row.actorId !== actorId || row.clientRequestId !== requestId) return null
  if (operationId !== undefined && row.operationId !== operationId) return null
  const save = object(row.save)
  if (!save || !['basic', 'unknown', 'not_created'].includes(String(save.project)) || save.venue !== 'not_saved'
      || !['saved', 'unknown', 'not_saved'].includes(String(save.analysis)) || save.plan !== 'not_saved') return null
  if (row.state === 'generated') {
    if (!nonempty(row.projectId) || save.project !== 'basic' || !validPlan(row.plan)) return null
  } else if (row.state === 'generation_failed') {
    if (!nonempty(row.projectId) || save.project !== 'basic' || !nonempty(row.message)) return null
  } else if (row.state === 'rejected' || row.state === 'outcome_unknown') {
    if (row.projectId !== null || !nonempty(row.message)) return null
  } else return null
  return row as GenerationResult
}
