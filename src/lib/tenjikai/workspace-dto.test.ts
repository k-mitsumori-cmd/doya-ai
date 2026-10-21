import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mockGeneratedPlan, SAMPLE_INPUT, VENUES, type GeneratedPlan, type ProjectInput } from './engine'
import { materializeTenjikaiWorkspace } from './workspace-materialize'
import { previewWorkspaceBudget, readFullTenjikaiWorkspaceDto } from './workspace-dto'

function fixture(input: ProjectInput = SAMPLE_INPUT, generated: GeneratedPlan = mockGeneratedPlan(input)) {
  const m = materializeTenjikaiWorkspace(input, generated)
  const venue = VENUES.find(item => item.id === input.venueId)!
  const plans = m.plans.map(({ plan, panels, cost, electric }, pi) => {
    const elements = plan.elements.map((item, order) => ({ ...item, z: item.z ?? 0, dbId: 'element-' + pi + '-' + order, sortOrder: order }))
    const dbId = new Map(elements.map(item => [item.id, item.dbId]))
    return { dbId: 'plan-' + pi, plan: { ...plan, elements: elements.map(item => ({ ...item })) }, cost, electric, elements,
      panels: panels.map((item, order) => ({ ...item, dbId: 'panel-' + pi + '-' + order,
        elementDbId: dbId.get(item.elementId)!, sortOrder: order })) }
  })
  return {
    schemaVersion: 1, actorId: 'actor-a', projectId: 'project-a', revision: '1',
    coverage: { graph: 'saved', images: 'not_saved', documents: 'not_saved', vendors: 'illustrative' },
    input, venueSnapshot: { code: venue.id, name: venue.name, note: venue.note, komaSizeM: venue.komaM,
      komaPriceYen: venue.komaPriceYen, maxHeightM: venue.maxHeightM, source: 'design_reference' },
    analysis: { ...m.analysis, source: m.source, notice: m.notice, modelId: null },
    projectedVisitors: m.projectedVisitors, selectedVariant: m.selectedVariant, plans,
    creatives: m.creatives.map((item, order) => ({ ...item, dbId: 'creative-' + order, sortOrder: order })),
    novelties: m.novelties.map(({ novelty, quantity, selected }, order) => ({ ...novelty,
      dbId: 'novelty-' + order, quantity, selected, sortOrder: order })),
    budgetLines: m.budgetLines.map((item, order) => ({ ...item, dbId: 'budget-' + order, source: 'ai', status: 'planned' })),
    deadlines: m.deadlines.map((item, order) => ({ ...item, dbId: 'deadline-' + order, done: false, sortOrder: order })),
  }
}

test('materialized A/B/C graph is accepted without reading current engine values', () => {
  const saved = readFullTenjikaiWorkspaceDto(fixture())
  assert.ok(saved)
  assert.deepEqual(saved.plans.map(item => item.plan.variant), ['A', 'B', 'C'])
  assert.deepEqual(saved.plans.map(item => item.electric.amountYen), [78000, 96000, 78000])
  assert.ok(saved.plans.every(item => item.panels.every(panel => item.elements.some(element => element.dbId === panel.elementDbId))))
})

test('saved budget preview uses plan-local electric snapshots and preserves manual or paid rows', () => {
  const saved = readFullTenjikaiWorkspaceDto(fixture())!
  const paid = { ...saved.budgetLines.find(item => item.sourceLineKey === 'print')!, source: 'quote', status: 'paid' }
  saved.budgetLines = saved.budgetLines.map(line => line.sourceLineKey === 'print' ? paid : line)
  assert.ok(readFullTenjikaiWorkspaceDto(saved), 'a protected paid line must remain restorable')
  const preview = previewWorkspaceBudget(saved, 'B', ['n1'])
  assert.equal(preview.find(item => item.sourceLineKey === 'electric')?.amountYen, saved.plans[1].electric.amountYen)
  assert.equal(preview.find(item => item.sourceLineKey === 'electric')?.detail, saved.plans[1].electric.detail)
  assert.deepEqual(preview.find(item => item.sourceLineKey === 'print'), paid)
  assert.equal(preview.find(item => item.sourceLineKey === 'novelty')?.amountYen,
    saved.novelties.find(item => item.id === 'n1')!.unitYen * saved.novelties.find(item => item.id === 'n1')!.quantity)
})

test('consumer mirror, parent reference, AI shape and finite numbers are rejected before render', () => {
  const base = fixture()
  for (const change of [
    (v: ReturnType<typeof fixture>) => { v.plans[0].plan.elements[0].x = 999 },
    (v: ReturnType<typeof fixture>) => { v.plans[0].panels[0].elementDbId = 'foreign-element' },
    (v: ReturnType<typeof fixture>) => { v.analysis.valueProps = [] },
    (v: ReturnType<typeof fixture>) => { v.plans[0].cost.total = Number.NaN },
    (v: ReturnType<typeof fixture>) => { v.plans[0].electric.detail = '' },
  ]) {
    const altered = structuredClone(base)
    change(altered)
    assert.equal(readFullTenjikaiWorkspaceDto(altered), null)
  }
})

test('bounded maximum accepted graph and response remain below 128 KiB', t => {
  const input: ProjectInput = { ...SAMPLE_INPUT, komaCols: 10, komaRows: 10, days: 14, staff: 100,
    eventName: 'あ'.repeat(120), serviceUrl: 'https://' + 'a'.repeat(480) }
  const generated = mockGeneratedPlan(input)
  generated.source = 'ai'
  generated.analysis = { ...generated.analysis, brand: 'あ'.repeat(40), category: 'あ'.repeat(60), headline: 'あ'.repeat(40),
    subline: 'あ'.repeat(80), tone: 'あ'.repeat(40), valueProps: Array.from({ length: 3 }, () => ({ title: 'あ'.repeat(24), body: 'あ'.repeat(80) })),
    targets: Array.from({ length: 3 }, () => 'あ'.repeat(40)) }
  generated.boothCopy = Object.fromEntries(['A', 'B', 'C'].map(key => [key, { name: 'あ'.repeat(24), concept: 'あ'.repeat(180), flow: 'あ'.repeat(100) }]))
  generated.creativeCopy = Object.fromEntries(['backwall', 'rollup', 'flyer', 'clearfile', 'card', 'loop']
    .map(key => [key, { copy: 'あ'.repeat(80), purpose: 'あ'.repeat(120) }]))
  const workspace = fixture(input, generated)
  workspace.actorId = 'a'.repeat(128)
  workspace.projectId = 'p'.repeat(128)
  let idCounter = 0
  const dbId = () => 'id' + String(++idCounter).padStart(34, '0')
  for (const plan of workspace.plans) {
    plan.dbId = dbId()
    const remap = new Map<string, string>()
    for (const element of plan.elements) { const old = element.dbId; element.dbId = dbId(); remap.set(old, element.dbId) }
    plan.plan.elements = plan.elements.map(element => ({ ...element }))
    for (const panel of plan.panels) { panel.dbId = dbId(); panel.elementDbId = remap.get(panel.elementDbId)! }
  }
  for (const row of [...workspace.creatives, ...workspace.novelties, ...workspace.budgetLines, ...workspace.deadlines]) row.dbId = dbId()
  assert.ok(readFullTenjikaiWorkspaceDto(workspace), 'max metadata graph remains valid')
  const bytes = Buffer.byteLength(JSON.stringify({ state: 'generated', actorId: workspace.actorId,
    clientRequestId: 'f'.repeat(36), operationId: '1'.repeat(50), projectId: workspace.projectId,
    plan: generated, workspace, save: { project: 'basic', venue: 'not_saved', analysis: 'saved', plan: 'saved' } }))
  assert.ok(bytes > 80_000)
  assert.ok(bytes < 128 * 1024, String(bytes))
  t.diagnostic(`maximum synthetic AI workspace/envelope bytes: ${Buffer.byteLength(JSON.stringify(workspace))}/${bytes}`)
})
