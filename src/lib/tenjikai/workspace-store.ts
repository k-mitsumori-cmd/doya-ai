import { randomUUID } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { lockTenjikaiActor } from './project-revision'
import type { BoothPlan, BudgetCategory, CreativeKind, ElementKind, Goal, BoothPosition } from './engine'
import type { GraphicZone } from './graphics'
import type { MaterializedWorkspace } from './workspace-materialize'
import { readFullTenjikaiWorkspaceDto, type FullTenjikaiWorkspace, type SavedPlan } from './workspace-dto'

const variantOrder = ['A', 'B', 'C'] as const
const creativeKinds: CreativeKind[] = ['backwall', 'rollup', 'flyer', 'clearfile', 'card', 'loop']
const elementKinds: ElementKind[] = ['wall', 'monitor', 'counter', 'table', 'demo', 'rollup', 'storage', 'sign']
const budgetCategories: BudgetCategory[] = ['space', 'build', 'electric', 'print', 'novelty', 'staff', 'logistics']
const goals: Goal[] = ['lead', 'brand', 'demo']
const positions: BoothPosition[] = ['inline', 'corner', 'peninsula', 'island']
const owners = ['自社', '主催者', '装飾業者', '印刷・ノベルティ'] as const
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const integer = (v: unknown): v is number => finite(v) && Number.isSafeInteger(v) && v >= 0
const present = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const fail = (): never => { throw new Error('TENJIKAI_FULL_WORKSPACE_INCOMPLETE') }
const dateAtJstMidnight = (s: string) => new Date(`${s}T00:00:00+09:00`)
function fromJstMidnight(date: Date): string {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return fail()
  const day = new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
  if (dateAtJstMidnight(day).getTime() !== date.getTime()) return fail()
  return day
}
function ordered<T extends { sortOrder: number | null; id: string }>(rows: T[]): T[] {
  if (rows.some(row => !integer(row.sortOrder)) || new Set(rows.map(row => row.sortOrder)).size !== rows.length) return fail()
  return [...rows].sort((a, b) => a.sortOrder! - b.sortOrder!)
}
function zonesOf(value: unknown): GraphicZone[] {
  if (!Array.isArray(value) || !value.every(zone => record(zone) && present(zone.label) && integer(zone.fromMm) && integer(zone.toMm) && zone.toMm >= zone.fromMm && typeof zone.content === 'string' && ['primary', 'secondary', 'light', 'muted'].includes(String(zone.tone)))) return fail()
  return value.map(zone => ({ label: zone.label, fromMm: zone.fromMm, toMm: zone.toMm, content: zone.content, tone: zone.tone })) as GraphicZone[]
}

/** Called only after claim CAS while User, generation operation, and owned project are locked. */
export async function writeInitialTenjikaiWorkspace(tx: Prisma.TransactionClient, projectId: string, workspace: MaterializedWorkspace) {
  const plans = workspace.plans.map(item => ({ id: randomUUID(), item }))
  const elements = plans.flatMap(({ id: planId, item }) => item.plan.elements.map((element, sortOrder) => ({ id: randomUUID(), planId, element, sortOrder })))
  const byPlanAndSource = new Map(elements.map(row => [`${row.planId}:${row.element.id}`, row.id]))
  const panels = plans.flatMap(({ id: planId, item }) => item.panels.map((panel, sortOrder) => {
    const elementId = byPlanAndSource.get(`${planId}:${panel.elementId}`)
    if (!elementId) return fail()
    return { id: randomUUID(), planId, elementId, panel, sortOrder }
  }))
  await tx.tenjikaiBoothPlan.createMany({ data: plans.map(({ id, item }) => ({
    id, projectId, variant: item.plan.variant, version: 1, name: item.plan.name, concept: item.plan.concept,
    flow: item.plan.flow, estimateYen: item.cost.total, widthM: item.plan.widthM, depthM: item.plan.depthM,
    carpetYen: item.cost.carpet, designYen: item.cost.design, laborYen: item.cost.labor,
    electricYen: item.electric.amountYen, electricDetail: item.electric.detail,
    selected: item.plan.variant === workspace.selectedVariant, renderUrls: [],
  })) })
  await tx.tenjikaiBoothElement.createMany({ data: elements.map(({ id, planId, element, sortOrder }) => ({
    id, planId, sourceElementId: element.id, sortOrder, note: element.note ?? null,
    kind: element.kind, label: element.label, x: element.x, y: element.y, z: element.z ?? 0,
    w: element.w, d: element.d, h: element.h, costYen: element.costYen,
  })) })
  await tx.tenjikaiGraphicPanel.createMany({ data: panels.map(({ id, planId, elementId, panel, sortOrder }) => ({
    id, planId, elementId, sourcePanelId: panel.id, sortOrder, face: panel.face, name: panel.name,
    offsetMm: panel.offsetMm, widthMm: panel.widthMm, heightMm: panel.heightMm, baseMm: panel.baseMm,
    viewDistanceM: panel.viewDistanceM, role: panel.role, visual: panel.visual, headline: panel.headline,
    zones: panel.zones, material: panel.material, imageUrl: null,
  })) })
  await tx.tenjikaiCreative.createMany({ data: workspace.creatives.map((item, sortOrder) => ({
    id: randomUUID(), projectId, kind: item.kind, name: item.name, displaySize: item.size, sortOrder,
    widthMm: item.widthMm, heightMm: item.heightMm, qty: item.qty, unitYen: item.unitYen,
    copy: item.copy, purpose: item.purpose, imageUrls: [],
  })) })
  await tx.tenjikaiNovelty.createMany({ data: workspace.novelties.map(({ novelty, quantity, selected }, sortOrder) => ({
    id: randomUUID(), projectId, sourceNoveltyId: novelty.id, recommended: novelty.recommended,
    name: novelty.name, tier: novelty.tier, unitYen: novelty.unitYen, quantity, leadDays: novelty.leadDays,
    reason: novelty.reason, selected, sortOrder,
  })) })
  await tx.tenjikaiBudgetLine.createMany({ data: workspace.budgetLines.map(item => ({
    id: randomUUID(), projectId, sourceLineKey: item.sourceLineKey, sortOrder: item.sortOrder,
    category: item.category, label: item.detail, amountYen: item.amountYen, source: 'ai', status: 'planned',
  })) })
  await tx.tenjikaiTask.createMany({ data: workspace.deadlines.map((item, sortOrder) => ({
    id: randomUUID(), projectId, sourceDeadlineId: item.id, sortOrder, documentId: null,
    title: item.title, kind: item.daysBefore === 0 ? 'task' : 'submission', owner: item.owner,
    daysBefore: item.daysBefore, dueAt: dateAtJstMidnight(item.date), done: false,
  })) })
  await tx.tenjikaiProject.update({ where: { id: projectId }, data: { workspaceSchemaVersion: 1, projectedVisitors: workspace.projectedVisitors } })
  // The revision and small generation receipt are committed by finalizeGeneration.
}

/** Same-transaction hydration is used by both initial finalize and authenticated full reads. */
export async function readFullTenjikaiWorkspaceTx(tx: Prisma.TransactionClient, actor: string, projectId: string): Promise<FullTenjikaiWorkspace | null> {
  const project = await tx.tenjikaiProject.findFirst({ where: { id: projectId, userId: actor }, include: {
    analysis: true, boothPlans: { include: { elements: true, panels: true } },
    creatives: true, novelties: true, budgetLines: true, tasks: true,
  } })
  if (!project || project.workspaceSchemaVersion !== 1) return null
  const a = project.analysis
  if (!a || !present(a.domain) || !present(project.planningVenueCode) || !present(project.planningVenueName) || !present(project.planningVenueSource) ||
      project.planningVenueSource !== 'design_reference' || typeof project.planningVenueNote !== 'string' ||
      !finite(project.planningKomaSizeM) || !integer(project.planningKomaPriceYen) || !finite(project.planningMaxHeightM) ||
      !integer(project.projectedVisitors) || !goals.includes(project.goal as Goal) || !positions.includes(project.boothPosition as BoothPosition) ||
      !record(a.brandColors) || !Array.isArray(a.valueProps) || !Array.isArray(a.targets)) return fail()
  const colors = a.brandColors
  if (!['primary', 'secondary', 'accent'].every(key => typeof colors[key] === 'string') ||
      !a.valueProps.every(item => record(item) && typeof item.title === 'string' && typeof item.body === 'string') ||
      !a.targets.every(item => typeof item === 'string') ||
      !(a.generatedSource === null || a.generatedSource === 'ai' || a.generatedSource === 'mock')) return fail()
  const input = {
    serviceUrl: project.serviceUrl, eventName: project.eventName, venueId: project.planningVenueCode,
    eventStart: fromJstMidnight(project.eventStart), days: project.eventDays,
    komaCols: project.komaCols, komaRows: project.komaRows, position: project.boothPosition as BoothPosition,
    budgetYen: project.budgetYen, goal: project.goal as Goal, staff: project.staffCount,
  }
  const planRows = project.boothPlans
  if (planRows.length !== 3 || new Set(planRows.map(row => row.variant)).size !== 3 || planRows.filter(row => row.selected).length !== 1) return fail()
  const plans: SavedPlan[] = variantOrder.map(variant => {
    const row = planRows.find(item => item.variant === variant)
    if (!row || !finite(row.widthM) || !finite(row.depthM) || !integer(row.carpetYen) || !integer(row.designYen) || !integer(row.laborYen) ||
        !integer(row.electricYen) || !present(row.electricDetail) || row.electricDetail.length > 240) return fail()
    const elements = ordered(row.elements).map(element => {
      if (!present(element.sourceElementId) || !elementKinds.includes(element.kind as ElementKind) ||
          ![element.x, element.y, element.z, element.w, element.d, element.h].every(finite) || !integer(element.costYen)) return fail()
      return { dbId: element.id, id: element.sourceElementId, sortOrder: element.sortOrder!, kind: element.kind as ElementKind,
        label: element.label, x: element.x, y: element.y, z: element.z, w: element.w, d: element.d, h: element.h,
        costYen: element.costYen, note: element.note ?? undefined }
    })
    const elementById = new Map(elements.map(element => [element.dbId, element]))
    const panels = ordered(row.panels).map(panel => {
      const element = elementById.get(panel.elementId)
      if (!element || !present(panel.sourcePanelId) || !['front', 'side'].includes(panel.face) ||
          ![panel.offsetMm, panel.widthMm, panel.heightMm, panel.baseMm, panel.viewDistanceM].every(finite)) return fail()
      return { dbId: panel.id, id: panel.sourcePanelId, elementId: element.id, elementDbId: element.dbId,
        sortOrder: panel.sortOrder!, face: panel.face as 'front' | 'side', name: panel.name, offsetMm: panel.offsetMm,
        widthMm: panel.widthMm, heightMm: panel.heightMm, baseMm: panel.baseMm, viewDistanceM: panel.viewDistanceM,
        role: panel.role, visual: panel.visual, headline: panel.headline, zones: zonesOf(panel.zones), material: panel.material }
    })
    const parts = elements.reduce((sum, item) => sum + item.costYen, 0)
    const cost = { parts, carpet: row.carpetYen, design: row.designYen, labor: row.laborYen, total: row.estimateYen }
    if (!integer(parts) || cost.total !== parts + cost.carpet + cost.design + cost.labor ||
        new Set(elements.map(item => item.id)).size !== elements.length || new Set(panels.map(item => item.id)).size !== panels.length) return fail()
    const plan: BoothPlan = { variant, name: row.name, concept: row.concept, flow: row.flow, widthM: row.widthM, depthM: row.depthM, elements }
    return { dbId: row.id, plan, cost, electric: { amountYen: row.electricYen, detail: row.electricDetail }, elements, panels }
  })
  const creatives = ordered(project.creatives).map(row => {
    if (!creativeKinds.includes(row.kind as CreativeKind) || !present(row.name) || !present(row.displaySize) ||
        ![row.widthMm, row.heightMm, row.qty, row.unitYen].every(integer)) return fail()
    return { dbId: row.id, sortOrder: row.sortOrder!, kind: row.kind as CreativeKind, name: row.name,
      size: row.displaySize, widthMm: row.widthMm, heightMm: row.heightMm, qty: row.qty, unitYen: row.unitYen,
      copy: row.copy, purpose: row.purpose }
  })
  const novelties = ordered(project.novelties).map(row => {
    if (!present(row.sourceNoveltyId) || typeof row.recommended !== 'boolean' ||
        ![row.unitYen, row.quantity, row.leadDays].every(integer) || !['名刺交換者', '来場者全員', '商談者'].includes(row.tier)) return fail()
    return { dbId: row.id, sortOrder: row.sortOrder!, id: row.sourceNoveltyId, name: row.name,
      unitYen: row.unitYen, leadDays: row.leadDays, tier: row.tier as '名刺交換者' | '来場者全員' | '商談者',
      reason: row.reason, recommended: row.recommended, quantity: row.quantity, selected: row.selected }
  })
  const budgetLines = ordered(project.budgetLines).map(row => {
    if (!(row.sourceLineKey === null || present(row.sourceLineKey)) || !budgetCategories.includes(row.category as BudgetCategory) || !integer(row.amountYen)) return fail()
    return { dbId: row.id, sortOrder: row.sortOrder!, sourceLineKey: row.sourceLineKey, category: row.category as BudgetCategory,
      amountYen: row.amountYen, detail: row.label, source: row.source, status: row.status }
  })
  const deadlines = ordered(project.tasks).map(row => {
    if (!present(row.sourceDeadlineId) || !owners.includes(row.owner as typeof owners[number]) ||
        !Number.isInteger(row.daysBefore)) return fail()
    return { dbId: row.id, sortOrder: row.sortOrder!, id: row.sourceDeadlineId,
      daysBefore: row.daysBefore, title: row.title, owner: row.owner as typeof owners[number],
      date: fromJstMidnight(row.dueAt), done: row.done }
  })
  if (creatives.length !== 6 || novelties.length !== 6 || budgetLines.length < 7 || deadlines.length !== 10 ||
      new Set(creatives.map(row => row.kind)).size !== creatives.length ||
      new Set(novelties.map(row => row.id)).size !== novelties.length ||
      new Set(budgetLines.filter(row => row.sourceLineKey !== null).map(row => row.sourceLineKey)).size !== budgetLines.filter(row => row.sourceLineKey !== null).length ||
      !budgetCategories.every(key => budgetLines.some(row => row.sourceLineKey === key)) ||
      new Set(deadlines.map(row => row.id)).size !== deadlines.length) return fail()
  const selectedVariant = planRows.find(row => row.selected)!.variant as BoothPlan['variant']
  const result: FullTenjikaiWorkspace = {
    schemaVersion: 1, actorId: actor, projectId, revision: project.revision.toString(),
    coverage: { graph: 'saved', images: 'not_saved', documents: 'not_saved', vendors: 'illustrative' },
    input,
    venueSnapshot: { code: project.planningVenueCode, name: project.planningVenueName, note: project.planningVenueNote,
      komaSizeM: project.planningKomaSizeM, komaPriceYen: project.planningKomaPriceYen,
      maxHeightM: project.planningMaxHeightM, source: 'design_reference' },
    analysis: { brand: a.brand, domain: a.domain, category: a.category, headline: a.headline,
      subline: a.subline, valueProps: a.valueProps as Array<{ title: string; body: string }>,
      targets: a.targets as string[], colors: colors as { primary: string; secondary: string; accent: string },
      tone: a.tone, source: a.generatedSource, notice: a.generationNotice, modelId: a.modelId },
    projectedVisitors: project.projectedVisitors, selectedVariant, plans, creatives, novelties, budgetLines, deadlines,
  }
  // Both the direct read and the generation envelope use the bounded 128 KiB client reader.
  // A corrupt or later-expanded graph is unknown; never silently truncate saved children.
  if (Buffer.byteLength(JSON.stringify(result)) > 112 * 1024 || !readFullTenjikaiWorkspaceDto(result)) return fail()
  return result
}

/** A single owned snapshot; a retired actor or missing/partial project returns no full graph. */
export async function readFullTenjikaiWorkspace(actor: string, projectId: string, db: Pick<PrismaClient, '$transaction'> = prisma) {
  return db.$transaction(async tx => {
    await lockTenjikaiActor(tx, actor)
    const owned = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM tenjikai_project WHERE id = ${projectId} AND "userId" = ${actor} FOR SHARE
    `
    if (owned.length !== 1) return null
    return readFullTenjikaiWorkspaceTx(tx, actor, projectId)
  }, { isolationLevel: 'RepeatableRead', maxWait: 10000, timeout: 20000 })
}
