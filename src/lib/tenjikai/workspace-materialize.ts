import {
  applyBoothCopy, applyCreativeCopy, computeBudget, expectedVisitors,
  generateBoothPlans, generateCreatives, generateDeadlines, generateNovelties,
  noveltyQty, planCost,
  type BoothPlan, type BudgetLine, type Creative, type Deadline,
  type GeneratedPlan, type Novelty, type ProjectInput, type SiteAnalysis,
} from './engine'
import { generateGraphicPlan, type GraphicPanel } from './graphics'

export type MaterializedPlan = { plan: BoothPlan; panels: GraphicPanel[]; cost: ReturnType<typeof planCost>; electric: { amountYen: number; detail: string } }
export type MaterializedNovelty = { novelty: Novelty; quantity: number; selected: boolean }
export type MaterializedBudgetLine = BudgetLine & { sourceLineKey: string; sortOrder: number }
export type MaterializedWorkspace = {
  input: ProjectInput
  analysis: SiteAnalysis
  source: GeneratedPlan['source']
  notice: string | null
  selectedVariant: BoothPlan['variant']
  projectedVisitors: number
  plans: MaterializedPlan[]
  creatives: Creative[]
  novelties: MaterializedNovelty[]
  budgetLines: MaterializedBudgetLine[]
  deadlines: Deadline[]
}

const budgetKeys = ['space', 'build', 'electric', 'print', 'novelty', 'staff', 'logistics'] as const
const integer = (value: number, max = 2_147_483_647) => Number.isSafeInteger(value) && value >= 0 && value <= max
const finite = (value: number) => Number.isFinite(value) && value >= 0
const text = (value: string, max: number) => typeof value === 'string' && value.length <= max

/** A pure, one-time server materialization. Neither the reader nor saved UI calls this. */
export function materializeTenjikaiWorkspace(input: ProjectInput, generated: GeneratedPlan): MaterializedWorkspace {
  const frozenInput = { ...input }
  const analysis = {
    ...generated.analysis,
    valueProps: generated.analysis.valueProps.map(item => ({ ...item })),
    targets: [...generated.analysis.targets],
    colors: { ...generated.analysis.colors },
  }
  const plans = applyBoothCopy(generateBoothPlans(frozenInput), generated.boothCopy)
    .map(plan => ({ plan, panels: generateGraphicPlan(plan, analysis), cost: planCost(plan, frozenInput) }))
  const creatives = applyCreativeCopy(generateCreatives(analysis, frozenInput), generated.creativeCopy)
  const selectedVariant: BoothPlan['variant'] = input.goal === 'demo' ? 'A' : input.goal === 'brand' ? 'B' : 'C'
  const selectedPlan = plans.find(item => item.plan.variant === selectedVariant)
  if (!selectedPlan || plans.length !== 3 || new Set(plans.map(item => item.plan.variant)).size !== 3) throw new Error('INVALID_WORKSPACE_PLANS')
  const novelties = generateNovelties(frozenInput).map(novelty => ({ novelty, quantity: noveltyQty(novelty, frozenInput), selected: novelty.recommended }))
  const selectedNovelty = novelties.filter(item => item.selected).map(item => item.novelty.id)
  const budgetLines = computeBudget(frozenInput, selectedPlan.plan, creatives, novelties.map(item => item.novelty), selectedNovelty)
    .map((line, sortOrder) => ({ ...line, sourceLineKey: budgetKeys[sortOrder], sortOrder }))
  const savedPlans: MaterializedPlan[] = plans.map(item => {
    const electric = computeBudget(frozenInput, item.plan, creatives, novelties.map(row => row.novelty), selectedNovelty)
      .find(line => line.category === 'electric')
    if (!electric || !integer(electric.amountYen) || !text(electric.detail, 240) || !electric.detail) throw new Error('INVALID_WORKSPACE_ELECTRIC')
    return { ...item, electric: { amountYen: electric.amountYen, detail: electric.detail } }
  })
  const deadlines = generateDeadlines(frozenInput)
  const projectedVisitors = expectedVisitors(frozenInput)
  if (!integer(projectedVisitors) || budgetLines.length !== budgetKeys.length || deadlines.length !== 10 ||
      new Set(deadlines.map(item => item.id)).size !== deadlines.length ||
      new Set(novelties.map(item => item.novelty.id)).size !== novelties.length ||
      !analysis.valueProps.length || !analysis.valueProps.every(item => text(item.title, 256) && text(item.body, 1024))) throw new Error('INVALID_WORKSPACE_SHAPE')
  for (const item of plans) {
    const p = item.plan, c = item.cost
    if (!finite(p.widthM) || !finite(p.depthM) || !integer(c.parts) || !integer(c.carpet) || !integer(c.design) || !integer(c.labor) || !integer(c.total) ||
        c.total !== c.parts + c.carpet + c.design + c.labor ||
        new Set(p.elements.map(element => element.id)).size !== p.elements.length ||
        new Set(item.panels.map(panel => panel.id)).size !== item.panels.length) throw new Error('INVALID_WORKSPACE_PLAN')
    for (const element of p.elements) {
      if (!integer(element.costYen) || ![element.x, element.y, element.z ?? 0, element.w, element.d, element.h].every(finite)) throw new Error('INVALID_WORKSPACE_ELEMENT')
    }
    const elements = new Set(p.elements.map(element => element.id))
    for (const panel of item.panels) {
      if (!elements.has(panel.elementId) || ![panel.offsetMm, panel.widthMm, panel.heightMm, panel.baseMm, panel.viewDistanceM].every(finite) ||
          !panel.zones.every(zone => integer(zone.fromMm) && integer(zone.toMm) && zone.toMm >= zone.fromMm)) throw new Error('INVALID_WORKSPACE_PANEL')
    }
  }
  if (!creatives.every(item => integer(item.qty) && integer(item.unitYen) && integer(item.widthMm) && integer(item.heightMm)) ||
      !novelties.every(item => integer(item.quantity) && integer(item.novelty.unitYen) && integer(item.novelty.leadDays)) ||
      !budgetLines.every(item => integer(item.amountYen)) ||
      !deadlines.every(item => Number.isInteger(item.daysBefore) && /^\d{4}-\d{2}-\d{2}$/.test(item.date))) throw new Error('INVALID_WORKSPACE_VALUES')
  return {
    input: frozenInput, analysis, source: generated.source, notice: generated.notice ?? null,
    selectedVariant, projectedVisitors, plans: savedPlans, creatives, novelties, budgetLines, deadlines,
  }
}
