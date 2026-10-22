// 合成DBのみ。保存条件を準備完了・生成成功へ読み替えない独立readの契約。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readSavedTenjikaiProjects, type SavedTenjikaiReadCtx } from './saved-projects-read'

const DAY_MS = 86_400_000
const REF = new Date('2026-10-20T15:00:00Z')
const row = (id: string, offset = 0) => ({ id, userId: 'u1', name: `保存案件${id}`, eventName: `展示会${id}`, eventStart: new Date(REF.getTime() + offset * DAY_MS), status: 'planning' })

function fixture(rows = [row('a')], failure?: unknown, afterRead?: () => void) {
  const calls: any[] = []
  const db = { tenjikaiProject: { findMany: async (args: any) => {
    calls.push(args)
    if (failure) throw failure
    const selected = rows.filter(p => p.userId === args.where.userId && p.eventStart >= args.where.eventStart.gte && p.eventStart < args.where.eventStart.lt)
      .sort((a, b) => a.eventStart.getTime() - b.eventStart.getTime() || a.id.localeCompare(b.id)).slice(0, args.take)
    afterRead?.()
    return selected.map(({ id, name, eventName, eventStart }) => ({ id, ...(args.select.name ? { name } : {}), eventName, eventStart }))
  } } }
  return { ctx: { db, userId: 'u1' } as unknown as SavedTenjikaiReadCtx, calls }
}

test('保存された展示会名・JST会期・日数と一般入口だけを返し、進捗や生成成功を作らない', async () => {
  const { ctx, calls } = fixture([row('a')])
  assert.deepEqual(await readSavedTenjikaiProjects(ctx, REF), {
    state: 'ready', items: [{ key: 'tenjikai:project:a', projectName: '保存案件a', eventName: '展示会a', eventDate: '2026-10-21', daysUntil: 0 }], href: '/tenjikai',
  })
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].select, { id: true, name: true, eventName: true, eventStart: true })
  assert.deepEqual(calls[0].orderBy, [{ eventStart: 'asc' }, { id: 'asc' }])
  assert.equal(calls[0].take, 20)
  assert.equal(calls[0].where.userId, 'u1')
  assert.ok(!('status' in calls[0].where) && !('analysis' in calls[0].where))
})

test('provider失敗・analysis不在・任意statusでも保存事実だけで扱う', async () => {
  const { ctx } = fixture(['draft', 'planning', 'done', 'unknown'].map((status, index) => ({ ...row(String(index)), status })))
  const result = await readSavedTenjikaiProjects(ctx, REF)
  assert.equal(result.state, 'ready')
  assert.equal(result.items?.length, 4)
  for (const item of result.items ?? []) assert.deepEqual(Object.keys(item), ['key', 'projectName', 'eventName', 'eventDate', 'daysUntil'])
})

test('正常な空はready配列、失敗や未反映テーブルはerror/nullにする', async () => {
  assert.deepEqual(await readSavedTenjikaiProjects(fixture([]).ctx, REF), { state: 'ready', items: [], href: '/tenjikai' })
  for (const failure of [new Error('synthetic failure'), { code: 'P2021' }]) {
    assert.deepEqual(await readSavedTenjikaiProjects(fixture([], failure).ctx, REF), { state: 'error', items: null, href: '/tenjikai' })
  }
})

test('他user・D-1・D61を除外し、D0/D60末尾まで含める', async () => {
  const { ctx, calls } = fixture([
    { ...row('past'), eventStart: new Date(REF.getTime() - 1) }, row('today'),
    { ...row('sixty', 60), eventStart: new Date(REF.getTime() + 61 * DAY_MS - 1) }, row('future', 61), { ...row('foreign'), userId: 'u2' },
  ])
  const result = await readSavedTenjikaiProjects(ctx, REF)
  assert.deepEqual(result.items?.map(p => [p.key, p.daysUntil]), [['tenjikai:project:today', 0], ['tenjikai:project:sixty', 60]])
  assert.equal(calls[0].where.eventStart.gte.getTime(), REF.getTime())
  assert.equal(calls[0].where.eventStart.lt.getTime(), REF.getTime() + 61 * DAY_MS)
})

test('日付同値をidで安定順にし、保存Projectは20件まで', async () => {
  const { ctx } = fixture(Array.from({ length: 25 }, (_, i) => row(String(24 - i).padStart(2, '0'))))
  const result = await readSavedTenjikaiProjects(ctx, REF)
  assert.equal(result.items?.length, 20)
  assert.deepEqual(result.items?.map(p => p.key), Array.from({ length: 20 }, (_, i) => `tenjikai:project:${String(i).padStart(2, '0')}`))
})

for (const userId of ['', '  ', undefined]) test(`実user IDなしはDBを読まない: ${String(userId)}`, async () => {
  const { ctx, calls } = fixture()
  ctx.userId = userId as unknown as string
  assert.equal((await readSavedTenjikaiProjects(ctx, REF)).state, 'error')
  assert.equal(calls.length, 0)
})

test('無効referenceは現在時刻や0で代替せずerror・DB読取0', async () => {
  const { ctx, calls } = fixture()
  assert.equal((await readSavedTenjikaiProjects(ctx, new Date('invalid'))).state, 'error')
  assert.equal(calls.length, 0)
})

for (const zone of ['UTC', 'Asia/Tokyo', 'America/Los_Angeles']) for (const reference of ['2026-10-20T14:59:59.999Z', '2026-10-20T15:00:00Z', '2026-10-31T15:00:00Z', '2026-12-31T15:00:00Z']) {
  test(`固定JST日月年境界: ${zone} / ${reference}`, async () => {
    const previousTZ = process.env.TZ
    try {
      process.env.TZ = zone
      const now = new Date(reference)
      const ordinal = Math.floor((now.getTime() + 9 * 3_600_000) / DAY_MS)
      const expectedDate = reference.includes('14:59') ? '2026-10-20' : reference.includes('10-20') ? '2026-10-21' : reference.includes('10-31') ? '2026-11-01' : '2027-01-01'
      const today = new Date(ordinal * DAY_MS - 9 * 3_600_000)
      const { ctx } = fixture([{ ...row('a'), eventStart: new Date(today.getTime() + DAY_MS - 1) }], undefined, () => now.setTime(now.getTime() + DAY_MS))
      const result = await readSavedTenjikaiProjects(ctx, now)
      assert.deepEqual(result.items?.map(p => [p.eventDate, p.daysUntil]), [[expectedDate, 0]])
    } finally { if (previousTZ === undefined) delete process.env.TZ; else process.env.TZ = previousTZ }
  })
}

test('DB以外の依存を呼ばず、findMany以外のread/writeへ拡大しない', async () => {
  const calls: string[] = []
  const db = new Proxy({}, { get: (_, model) => {
    assert.equal(model, 'tenjikaiProject')
    return new Proxy({}, { get: (_, method) => {
      assert.equal(method, 'findMany')
      return async () => { calls.push(`${String(model)}.${String(method)}`); return [] }
    } })
  } })
  const previousFetch = global.fetch
  const network: string[] = []
  global.fetch = async () => { network.push('fetch'); throw new Error('network forbidden') }
  try {
    assert.equal((await readSavedTenjikaiProjects({ db: db as SavedTenjikaiReadCtx['db'], userId: 'u1' }, REF)).state, 'ready')
    assert.deepEqual(calls, ['tenjikaiProject.findMany'])
    assert.deepEqual(network, [])
  } finally { global.fetch = previousFetch }
})


test('同一展示会・会期の別保存案件をprojectNameとtyped IDで区別する', async () => {
  const { ctx } = fixture([
    { ...row('b'), name: '営業部の出展条件', eventName: '合同展示会' },
    { ...row('a'), name: '開発部の出展条件', eventName: '合同展示会' },
  ])
  const result = await readSavedTenjikaiProjects(ctx, REF)
  assert.equal(result.state, 'ready')
  assert.deepEqual(result.items, [
    { key: 'tenjikai:project:a', projectName: '開発部の出展条件', eventName: '合同展示会', eventDate: '2026-10-21', daysUntil: 0 },
    { key: 'tenjikai:project:b', projectName: '営業部の出展条件', eventName: '合同展示会', eventDate: '2026-10-21', daysUntil: 0 },
  ])
  assert.equal(result.href, '/tenjikai')
})
