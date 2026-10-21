import type { BoothPlan, BudgetLine, Creative, Deadline, Novelty, ProjectInput, SiteAnalysis } from './engine'
import type { GraphicPanel } from './graphics'

export type SavedPlan = {
  dbId: string
  plan: BoothPlan
  cost: { parts: number; carpet: number; design: number; labor: number; total: number }
  electric: { amountYen: number; detail: string }
  elements: Array<BoothPlan['elements'][number] & { dbId: string; sortOrder: number }>
  panels: Array<GraphicPanel & { dbId: string; elementDbId: string; sortOrder: number }>
}
export type SavedCreative = Creative & { dbId: string; sortOrder: number }
export type SavedNovelty = Novelty & { dbId: string; quantity: number; selected: boolean; sortOrder: number }
export type SavedBudgetLine = BudgetLine & { dbId: string; sourceLineKey: string | null; source: string; status: string; sortOrder: number }
export type SavedDeadline = Deadline & { dbId: string; done: boolean; sortOrder: number }

/** Versioned, bounded response. No data URL, file bytes, or vendor request is implied. */
export type FullTenjikaiWorkspace = {
  schemaVersion: 1
  actorId: string
  projectId: string
  revision: string
  coverage: { graph: 'saved'; images: 'not_saved'; documents: 'not_saved'; vendors: 'illustrative' }
  input: ProjectInput
  venueSnapshot: { code: string; name: string; note: string; komaSizeM: number; komaPriceYen: number; maxHeightM: number; source: 'design_reference' }
  analysis: SiteAnalysis & { source: 'ai' | 'mock' | null; notice: string | null; modelId: string | null }
  projectedVisitors: number
  selectedVariant: BoothPlan['variant']
  plans: SavedPlan[]
  creatives: SavedCreative[]
  novelties: SavedNovelty[]
  budgetLines: SavedBudgetLine[]
  deadlines: SavedDeadline[]
}

/** A local edit preview using only saved prices and quantities; the server CAS is authoritative. */
export function previewWorkspaceBudget(workspace: FullTenjikaiWorkspace, variant: BoothPlan['variant'], selectedNoveltyIds: string[]): SavedBudgetLine[] {
  const selected = workspace.plans.find(item => item.plan.variant === variant)
  if (!selected || selectedNoveltyIds.some(id => !workspace.novelties.some(item => item.id === id))) return workspace.budgetLines
  const noveltyAmount = workspace.novelties.filter(item => selectedNoveltyIds.includes(item.id))
    .reduce((sum, item) => sum + item.unitYen * item.quantity, 0)
  return workspace.budgetLines.map(line => line.source === 'ai' && line.status === 'planned'
    ? line.sourceLineKey === 'build' ? { ...line, amountYen: selected.cost.total,
      detail: `部材 ¥${selected.cost.parts.toLocaleString()} / 床 ¥${selected.cost.carpet.toLocaleString()} / デザイン・施工費` }
      : line.sourceLineKey === 'electric' ? { ...line, amountYen: selected.electric.amountYen, detail: selected.electric.detail }
      : line.sourceLineKey === 'novelty' ? { ...line, amountYen: noveltyAmount, detail: `${selectedNoveltyIds.length}品目` }
      : line : line)
}

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const string = (value: unknown): value is string => typeof value === 'string'
const id = (value: unknown): value is string => string(value) && /^[A-Za-z0-9_-]{1,128}$/.test(value)
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const int = (value: unknown): value is number => number(value) && Number.isSafeInteger(value) && value >= 0
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(string)
const unique = (values: unknown[]) => new Set(values).size === values.length
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
  : object(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value
const sameData = (left: unknown, right: unknown) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right))

/** Validate the complete network DTO before any saved-mode consumer receives it. */
export function readFullTenjikaiWorkspaceDto(value: unknown): FullTenjikaiWorkspace | null {
  const w = object(value) ? value : null
  if (!w || w.schemaVersion !== 1 || !id(w.actorId) || !id(w.projectId) ||
      !string(w.revision) || !/^(0|[1-9]\d{0,18})$/.test(w.revision) || BigInt(w.revision) > 9_223_372_036_854_775_807n) return null
  const coverage = object(w.coverage) ? w.coverage : null
  if (!coverage || coverage.graph !== 'saved' || coverage.images !== 'not_saved' || coverage.documents !== 'not_saved' || coverage.vendors !== 'illustrative') return null
  const input = object(w.input) ? w.input : null, venue = object(w.venueSnapshot) ? w.venueSnapshot : null
  const analysis = object(w.analysis) ? w.analysis : null, colors = object(analysis?.colors) ? analysis.colors : null
  if (!input || !venue || !analysis || !colors ||
      !string(input.serviceUrl) || !string(input.eventName) || !string(input.venueId) || !/^\d{4}-\d{2}-\d{2}$/.test(String(input.eventStart)) ||
      !Number.isFinite(new Date(String(input.eventStart) + 'T00:00:00Z').getTime()) ||
      new Date(String(input.eventStart) + 'T00:00:00Z').toISOString().slice(0, 10) !== input.eventStart ||
      ![input.days, input.komaCols, input.komaRows, input.budgetYen, input.staff].every(int) ||
      input.days < 1 || input.days > 14 || input.komaCols < 1 || input.komaCols > 10 ||
      input.komaRows < 1 || input.komaRows > 10 || input.staff < 1 || input.staff > 100 || input.budgetYen > 1_000_000_000 ||
      !['inline', 'corner', 'peninsula', 'island'].includes(String(input.position)) || !['lead', 'brand', 'demo'].includes(String(input.goal)) ||
      !string(venue.code) || !string(venue.name) || !string(venue.note) || !number(venue.komaSizeM) ||
      !int(venue.komaPriceYen) || !number(venue.maxHeightM) || venue.source !== 'design_reference' || venue.code !== input.venueId ||
      !['brand', 'domain', 'category', 'headline', 'subline', 'tone'].every(key => string(analysis[key]) && !!analysis[key]) ||
      !['primary', 'secondary', 'accent'].every(key => string(colors[key]) && /^#[a-fA-F0-9]{6}$/.test(colors[key] as string)) ||
      !Array.isArray(analysis.valueProps) || analysis.valueProps.length !== 3 ||
      !analysis.valueProps.every(item => object(item) && string(item.title) && !!item.title && string(item.body) && !!item.body) ||
      !strings(analysis.targets) || analysis.targets.length < 1 || analysis.targets.length > 3 ||
      !(analysis.source === null || analysis.source === 'ai' || analysis.source === 'mock') ||
      !(analysis.notice === null || string(analysis.notice)) || !(analysis.modelId === null || string(analysis.modelId)) ||
      !int(w.projectedVisitors) || !['A', 'B', 'C'].includes(String(w.selectedVariant))) return null
  if (!Array.isArray(w.plans) || w.plans.length !== 3 || !Array.isArray(w.creatives) || w.creatives.length !== 6 ||
      !Array.isArray(w.novelties) || w.novelties.length !== 6 || !Array.isArray(w.budgetLines) || w.budgetLines.length < 7 ||
      !Array.isArray(w.deadlines) || w.deadlines.length !== 10) return null
  if (!unique(w.plans.map(item => object(item) && object(item.plan) ? item.plan.variant : null))) return null
  for (const item of w.plans) {
    const saved = object(item) ? item : null, plan = object(saved?.plan) ? saved.plan : null, cost = object(saved?.cost) ? saved.cost : null
    const electric = object(saved?.electric) ? saved.electric : null
    if (!saved || !plan || !cost || !electric || !int(electric.amountYen) || !string(electric.detail) || !electric.detail || electric.detail.length > 240 ||
        !id(saved.dbId) || !['A', 'B', 'C'].includes(String(plan.variant)) ||
        ![plan.name, plan.concept, plan.flow].every(string) || ![plan.widthM, plan.depthM].every(number) ||
        ![cost.parts, cost.carpet, cost.design, cost.labor, cost.total].every(int) ||
        cost.total !== (cost.parts as number) + (cost.carpet as number) + (cost.design as number) + (cost.labor as number) ||
        !Array.isArray(saved.elements) || !Array.isArray(saved.panels) || !Array.isArray(plan.elements) ||
        plan.elements.length !== saved.elements.length || !sameData(plan.elements, saved.elements)) return null
    const elements = new Map<string, string>()
    for (const e of saved.elements) {
      if (!object(e) || !id(e.dbId) || !id(e.id) || !int(e.sortOrder) || !['wall', 'monitor', 'counter', 'table', 'demo', 'rollup', 'storage', 'sign'].includes(String(e.kind)) ||
          !string(e.label) || ![e.x, e.y, e.z, e.w, e.d, e.h].every(number) || !int(e.costYen) ||
          !(e.note === undefined || string(e.note))) return null
      elements.set(e.dbId, e.id)
    }
    if (elements.size !== saved.elements.length || !unique(saved.elements.map(item => item.id)) ||
        !unique(saved.elements.map(item => item.sortOrder))) return null
    if (cost.parts !== saved.elements.reduce((sum, item) => sum + item.costYen, 0)) return null
    for (const panel of saved.panels) {
      if (!object(panel) || !id(panel.dbId) || !id(panel.id) || !id(panel.elementDbId) ||
          elements.get(panel.elementDbId) !== panel.elementId || !int(panel.sortOrder) ||
          !['front', 'side'].includes(String(panel.face)) ||
          ![panel.name, panel.role, panel.visual, panel.headline, panel.material].every(string) ||
          ![panel.offsetMm, panel.widthMm, panel.heightMm, panel.baseMm, panel.viewDistanceM].every(number) ||
          !Array.isArray(panel.zones) || !panel.zones.every(zone => object(zone) && string(zone.label) &&
            int(zone.fromMm) && int(zone.toMm) && zone.toMm >= zone.fromMm && zone.toMm <= panel.heightMm &&
            string(zone.content) && ['primary', 'secondary', 'light', 'muted'].includes(String(zone.tone)))) return null
    }
    if (!unique(saved.panels.map(item => item.id)) || !unique(saved.panels.map(item => item.sortOrder))) return null
  }
  if (!unique(w.plans.map(item => item.dbId)) ||
      !unique(w.plans.flatMap(item => item.elements.map(element => element.dbId))) ||
      !unique(w.plans.flatMap(item => item.panels.map(panel => panel.dbId)))) return null
  for (const creative of w.creatives) {
    if (!object(creative) || !id(creative.dbId) || !int(creative.sortOrder) ||
        !['backwall', 'rollup', 'flyer', 'clearfile', 'card', 'loop'].includes(String(creative.kind)) ||
        ![creative.name, creative.size, creative.copy, creative.purpose].every(string) ||
        ![creative.widthMm, creative.heightMm, creative.qty, creative.unitYen].every(int)) return null
  }
  if (!unique(w.creatives.map(item => item.kind)) || !unique(w.creatives.map(item => item.sortOrder))) return null
  for (const novelty of w.novelties) {
    if (!object(novelty) || !id(novelty.dbId) || !id(novelty.id) || !int(novelty.sortOrder) ||
        ![novelty.name, novelty.reason].every(string) || !['名刺交換者', '来場者全員', '商談者'].includes(String(novelty.tier)) ||
        ![novelty.unitYen, novelty.leadDays, novelty.quantity].every(int) ||
        typeof novelty.selected !== 'boolean' || typeof novelty.recommended !== 'boolean') return null
  }
  if (!unique(w.novelties.map(item => item.id)) || !unique(w.novelties.map(item => item.sortOrder))) return null
  for (const line of w.budgetLines) {
    if (!object(line) || !id(line.dbId) || !(line.sourceLineKey === null || id(line.sourceLineKey)) || !int(line.sortOrder) ||
        !['space', 'build', 'electric', 'print', 'novelty', 'staff', 'logistics'].includes(String(line.category)) ||
        !string(line.detail) || !int(line.amountYen) || !string(line.source) || !string(line.status)) return null
  }
  if (!unique(w.budgetLines.filter(item => item.sourceLineKey !== null).map(item => item.sourceLineKey)) || !unique(w.budgetLines.map(item => item.sortOrder)) ||
      !['space', 'build', 'electric', 'print', 'novelty', 'staff', 'logistics'].every(key => w.budgetLines.some(line => line.sourceLineKey === key))) return null
  for (const deadline of w.deadlines) {
    if (!object(deadline) || !id(deadline.dbId) || !id(deadline.id) || !int(deadline.sortOrder) ||
        !Number.isInteger(deadline.daysBefore) || ![deadline.title, deadline.owner].every(string) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(String(deadline.date)) || typeof deadline.done !== 'boolean') return null
  }
  if (!unique(w.deadlines.map(item => item.id)) || !unique(w.deadlines.map(item => item.sortOrder))) return null
  return w as FullTenjikaiWorkspace
}
