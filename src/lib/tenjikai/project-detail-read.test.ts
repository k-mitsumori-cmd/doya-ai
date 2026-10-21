// 合成readのみ。認証済userIdの由来は呼出元の責務で、非空IDだけでは認証を証明しない。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PROJECT_DETAIL_SELECT,
  readTenjikaiProjectDetail,
  type ProjectDetailQuery,
  type ProjectDetailRow,
  type TenjikaiProjectDetailContext,
} from './project-detail-read'

const saved = (id = 'p1'): ProjectDetailRow => ({
  id, name: '営業部の保存案件', serviceUrl: 'https://example.test/product', venueId: null,
  eventName: '合同展示会', eventStart: new Date('2025-12-31T15:30:00Z'), eventDays: 3,
  komaCols: 2, komaRows: 1, boothWidthM: 5.94, boothDepthM: 2.97, boothPosition: 'corner',
  budgetYen: 0, goal: 'lead', staffCount: 4, status: 'done',
  createdAt: new Date('2025-01-01T00:00:00Z'), updatedAt: new Date('2026-01-02T00:00:00Z'),
  analysis: null,
})
const analysis = (): NonNullable<ProjectDetailRow['analysis']> => ({
  brand: '保存ブランド', category: '保存カテゴリ', headline: '保存見出し', subline: '保存補足',
  valueProps: [{ title: '保存訴求', body: '保存本文' }], targets: ['保存対象'],
  brandColors: { primary: '#123456', secondary: '#abcdef', accent: '#654321' }, tone: '保存トーン', logoUrl: null,
})
function fixture(rows: { owner: string; value: ProjectDetailRow }[] = [{ owner: 'actor-a', value: saved() }], failure?: unknown) {
  const calls: ProjectDetailQuery[] = []
  const db = { tenjikaiProject: { findFirst: async (query: ProjectDetailQuery) => {
    calls.push(query)
    if (failure) throw failure
    return rows.find(row => (query.where.userId === undefined || row.owner === query.where.userId) && row.value.id === query.where.id)?.value ?? null
  } } }
  // 合成Prisma delegate境界だけを適合させる。partial DTOや入力型はcastしない。
  return { ctx: { db: db as unknown as TenjikaiProjectDetailContext['db'], userId: 'actor-a' } satisfies TenjikaiProjectDetailContext, calls }
}

for (const userId of [undefined, null, '', '  ', 0]) test(`認証actorなしは照会0: ${String(userId)}`, async () => {
  const f = fixture()
  assert.deepEqual(await readTenjikaiProjectDetail({ ...f.ctx, userId }, 'p1'), { state: 'not_authenticated' })
  assert.equal(f.calls.length, 0)
})
for (const id of [undefined, null, '', ' \t', 0]) test(`案件IDなしは照会0: ${String(id)}`, async () => {
  const f = fixture()
  assert.deepEqual(await readTenjikaiProjectDetail(f.ctx, id), { state: 'not_found' })
  assert.equal(f.calls.length, 0)
})

test('所有id/userId条件のfindFirst1回で保存入力を返し、過去doneも日付/statusで落とさない', async () => {
  const f = fixture()
  const result = await readTenjikaiProjectDetail(f.ctx, 'p1')
  assert.equal(f.calls.length, 1)
  assert.deepEqual(f.calls[0], { where: { id: 'p1', userId: 'actor-a' }, select: PROJECT_DETAIL_SELECT })
  assert.equal(result.state, 'ready_partial')
  if (result.state !== 'ready_partial') return
  assert.deepEqual(result.project, {
    id: 'p1', key: 'tenjikai:project:p1', projectName: '営業部の保存案件', serviceUrl: 'https://example.test/product', venueId: null,
    eventName: '合同展示会', eventStartAt: '2025-12-31T15:30:00.000Z', eventDate: '2026-01-01', eventDays: 3,
    komaCols: 2, komaRows: 1, boothWidthM: 5.94, boothDepthM: 2.97, boothPosition: 'corner', budgetYen: 0,
    goal: 'lead', staffCount: 4, status: 'done', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z',
  })
  assert.deepEqual(result.analysis, { state: 'missing', value: null })
  assert.deepEqual(result.partialReasons, ['children_not_read', 'venue_not_saved', 'analysis_not_saved'])
  assert.deepEqual(result.children, { state: 'not_read' })
  for (const key of ['tasks', 'budgetLines', 'documents', 'generationJobs', 'completed', 'progress', 'href', 'userId']) assert.ok(!(key in result))
})

test('他人と不存在は同じnot_foundで、所有者情報や解析を返さない', async () => {
  const f = fixture([{ owner: 'actor-b', value: { ...saved(), analysis: analysis() } }])
  assert.deepEqual(await readTenjikaiProjectDetail(f.ctx, 'p1'), { state: 'not_found' })
  assert.deepEqual(await readTenjikaiProjectDetail(f.ctx, 'absent'), { state: 'not_found' })
  assert.equal(f.calls.length, 2)
  assert.ok(f.calls.every(c => c.where.userId === 'actor-a'))
})

test('DB障害/未反映tableを不存在や空として返さない', async () => {
  for (const failure of [new Error('PRIVATE synthetic DB detail'), { code: 'P2021' }]) {
    const f = fixture([], failure)
    const result = await readTenjikaiProjectDetail(f.ctx, 'p1')
    assert.deepEqual(result, { state: 'error', reason: 'read_failed' })
    assert.ok(!JSON.stringify(result).includes('PRIVATE'))
    assert.equal(f.calls.length, 1)
  }
})

for (const status of ['draft', 'planning', 'ready', 'done', 'unknown']) test(`status=${status}でも生成や準備の完了を推測しない`, async () => {
  const f = fixture([{ owner: 'actor-a', value: { ...saved(), status, venueId: 'saved-venue-id', analysis: analysis() } }])
  const result = await readTenjikaiProjectDetail(f.ctx, 'p1')
  assert.equal(result.state, 'ready_partial')
  if (result.state !== 'ready_partial') return
  assert.equal(result.project.venueId, 'saved-venue-id')
  assert.equal(result.project.status, status)
  assert.deepEqual(result.partialReasons, ['children_not_read'])
  assert.equal(result.analysis.state, 'saved')
  assert.deepEqual(result.children, { state: 'not_read' })
})

test('実在する保存analysisを検査して返すが、未保存domainや既定値を加えない', async () => {
  const row = { ...saved(), analysis: analysis() }
  const result = await readTenjikaiProjectDetail(fixture([{ owner: 'actor-a', value: row }]).ctx, 'p1')
  assert.equal(result.state, 'ready_partial')
  if (result.state !== 'ready_partial') return
  assert.deepEqual(result.analysis, { state: 'saved', value: {
    brand: '保存ブランド', category: '保存カテゴリ', headline: '保存見出し', subline: '保存補足',
    valueProps: [{ title: '保存訴求', body: '保存本文' }], targets: ['保存対象'],
    colors: { primary: '#123456', secondary: '#abcdef', accent: '#654321' }, tone: '保存トーン', logoUrl: null,
  } })
  assert.ok(!('domain' in (result.analysis.value ?? {})))
  assert.ok(!JSON.stringify(result).includes('bigsight'))
  if (result.analysis.state === 'saved') {
    result.analysis.value.targets.push('caller-only')
    assert.deepEqual(row.analysis.targets, ['保存対象'], 'DTO mutation must not alter the read row')
  }
})

const invalidJson: { field: 'valueProps' | 'targets' | 'brandColors'; value: NonNullable<ProjectDetailRow['analysis']>['valueProps'] }[] = [
  { field: 'valueProps', value: null }, { field: 'valueProps', value: 'serialized json is not an array' },
  { field: 'valueProps', value: [{ title: 'only title' }] }, { field: 'valueProps', value: [false] },
  { field: 'targets', value: { first: 'not an array' } }, { field: 'targets', value: ['valid', 1] },
  { field: 'brandColors', value: [] }, { field: 'brandColors', value: { primary: '#123456' } },
  { field: 'brandColors', value: { primary: '#123456', secondary: 3, accent: '#000000' } },
]
for (const { field, value } of invalidJson) test(`壊れた保存JSONをmockで補完しない: ${field}/${JSON.stringify(value)}`, async () => {
  const f = fixture([{ owner: 'actor-a', value: { ...saved(), analysis: { ...analysis(), [field]: value } } }])
  const result = await readTenjikaiProjectDetail(f.ctx, 'p1')
  assert.equal(result.state, 'ready_partial')
  if (result.state !== 'ready_partial') return
  assert.deepEqual(result.analysis, { state: 'invalid', value: null, invalidFields: [field] })
  assert.ok(result.partialReasons.includes('analysis_invalid'))
  assert.ok(!result.partialReasons.includes('analysis_not_saved'))
  assert.equal(result.project.projectName, '営業部の保存案件')
})

test('保存された正常な空JSON配列/空文字を捏造値へ置換しない', async () => {
  const f = fixture([{ owner: 'actor-a', value: { ...saved(), analysis: { ...analysis(), valueProps: [], targets: [], brandColors: { primary: '', secondary: '', accent: '' } } } }])
  const result = await readTenjikaiProjectDetail(f.ctx, 'p1')
  assert.equal(result.state, 'ready_partial')
  if (result.state !== 'ready_partial' || result.analysis.state !== 'saved') return
  assert.deepEqual(result.analysis.value.valueProps, [])
  assert.deepEqual(result.analysis.value.targets, [])
  assert.deepEqual(result.analysis.value.colors, { primary: '', secondary: '', accent: '' })
})

for (const zone of ['UTC', 'Asia/Tokyo', 'America/Los_Angeles']) test(`保存会期をJST日付へ安定変換: ${zone}`, async () => {
  const previous = process.env.TZ
  try {
    process.env.TZ = zone
    for (const [at, expected] of [['2026-10-31T14:59:59.999Z', '2026-10-31'], ['2026-10-31T15:00:00Z', '2026-11-01'], ['2026-12-31T15:00:00Z', '2027-01-01']]) {
      const result = await readTenjikaiProjectDetail(fixture([{ owner: 'actor-a', value: { ...saved(), eventStart: new Date(at) } }]).ctx, 'p1')
      assert.equal(result.state, 'ready_partial')
      if (result.state === 'ready_partial') assert.equal(result.project.eventDate, expected)
    }
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous }
})

test('不正保存日時は現在時刻やepoch0で埋めずerrorへ', async () => {
  for (const field of ['eventStart', 'createdAt', 'updatedAt'] as const) {
    const f = fixture([{ owner: 'actor-a', value: { ...saved(), [field]: new Date('invalid') } }])
    assert.deepEqual(await readTenjikaiProjectDetail(f.ctx, 'p1'), { state: 'error', reason: 'invalid_project' })
  }
})

test('同一展示会/会期の別案件を保存名とtyped IDで区別する', async () => {
  const f = fixture([{ owner: 'actor-a', value: saved('one') }, { owner: 'actor-a', value: { ...saved('two'), name: '開発部の保存案件' } }])
  const one = await readTenjikaiProjectDetail(f.ctx, 'one'), two = await readTenjikaiProjectDetail(f.ctx, 'two')
  assert.equal(one.state, 'ready_partial'); assert.equal(two.state, 'ready_partial')
  if (one.state !== 'ready_partial' || two.state !== 'ready_partial') return
  assert.equal(one.project.eventName, two.project.eventName)
  assert.equal(one.project.eventDate, two.project.eventDate)
  assert.notEqual(one.project.projectName, two.project.projectName)
  assert.notEqual(one.project.key, two.project.key)
})

test('親read1回以外の子read/書込/providerを呼ばず、未読を0件にしない', async () => {
  const calls: string[] = []
  const db = new Proxy({}, { get: (_, model) => {
    assert.equal(model, 'tenjikaiProject')
    return new Proxy({}, { get: (_, method) => {
      assert.equal(method, 'findFirst')
      return async () => { calls.push('findFirst'); return saved() }
    } })
  } })
  const result = await readTenjikaiProjectDetail({ userId: 'actor-a', db: db as TenjikaiProjectDetailContext['db'] }, 'p1')
  assert.deepEqual(calls, ['findFirst'])
  assert.equal(result.state, 'ready_partial')
  if (result.state === 'ready_partial') assert.deepEqual(result.children, { state: 'not_read' })
})
