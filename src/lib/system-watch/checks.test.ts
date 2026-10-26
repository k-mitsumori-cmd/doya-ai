import { test } from 'node:test'
import assert from 'node:assert/strict'
import { freeChecks, pageChecks } from './checks'
import { paidChecks } from './paid-checks'
import { paidAgentChecks } from './agent-checks'
import { canSpend, DAILY_CAP_YEN, jstDay } from './budget'
import { SERVICES, RETIRED_SERVICE_IDS } from '@/lib/services'

test('確認の名前は重複せず、どれにも直し方の候補がある', () => {
  const all = [...freeChecks(), ...paidChecks(), ...paidAgentChecks()]
  const ids = all.map(c => c.id)
  assert.equal(new Set(ids).size, ids.length, `重複: ${ids.filter((x, i) => ids.indexOf(x) !== i).join(', ')}`)
  for (const c of all) {
    assert.ok(c.hints.length > 0, `${c.id} に直し方の候補が無い`)
    assert.ok(c.threshold >= 1, `${c.id} のしきい値`)
    assert.ok(c.label.length > 0)
  }
})

test('公開中のツールの入口は、すべて画面の確認に入る（新しいツールも自動で増える）', () => {
  const pages = new Set(pageChecks('https://example.test').map(c => c.id))
  for (const s of SERVICES.filter(s => s.status === 'active' && !RETIRED_SERVICE_IDS.has(s.id) && s.href?.startsWith('/'))) {
    assert.ok(pages.has(`page:${s.href}`), `${s.name}（${s.href}）が確認に入っていない`)
  }
  for (const fixed of ['/', '/pricing', '/auth/signin']) assert.ok(pages.has(`page:${fixed}`))
})

test('有料の確認は、無料の確認の一覧に混ざらない', () => {
  assert.ok(freeChecks().every(c => !c.id.startsWith('paid:')))
  assert.ok([...paidChecks(), ...paidAgentChecks()].every(c => c.id.startsWith('paid:')))
})

test('有料の確認には、どれも1回の見込み額があり、ふだんの1日の合計は上限より小さい', () => {
  const paid = [...paidChecks(), ...paidAgentChecks()]
  for (const c of paid) assert.ok(c.costYen > 0, `${c.id} に見込み額が無い`)
  const total = paid.reduce((s, c) => s + c.costYen, 0)
  assert.ok(total < DAILY_CAP_YEN, `1日の合計 ${total}円 が上限 ${DAILY_CAP_YEN}円 以上`)
})

test('1日の上限: 累計が上限に届いたら次を回さない', () => {
  assert.equal(canSpend(0), true)
  assert.equal(canSpend(9.99), true)
  assert.equal(canSpend(10), false)
  assert.equal(canSpend(17), false)
})

test('上限の日付は日本時間で切り替わる', () => {
  assert.equal(jstDay(Date.parse('2026-10-26T14:59:00Z')), '2026-10-26')
  assert.equal(jstDay(Date.parse('2026-10-26T15:00:00Z')), '2026-10-27')
})

test('エージェントの API の門前払いの確認が、無料の確認に入っている', () => {
  assert.ok(freeChecks().some(c => c.id === 'api:agent-guard'))
  assert.ok(freeChecks().some(c => c.id === 'agent:sample-sites'))
})

test('見本の会社は3つで、B1 が1つ目、B2 が残りを読む（1URL 1日1回）', async () => {
  const { DEFAULT_SAMPLE_COMPANIES } = await import('./agent-checks')
  assert.equal(DEFAULT_SAMPLE_COMPANIES.length, 3)
  assert.deepEqual(DEFAULT_SAMPLE_COMPANIES.map(s => s.url), ['https://surisuta.jp/', 'https://doyamarke.surisuta.jp/', 'https://doya-ai.surisuta.jp/'])
  assert.equal(DEFAULT_SAMPLE_COMPANIES[0].expectName, 'スリスタ')
  // 毎日読むので、自社のサイトだけにする
  assert.ok(DEFAULT_SAMPLE_COMPANIES.every(s => new URL(s.url).hostname.endsWith('surisuta.jp')))
  assert.equal(DEFAULT_SAMPLE_COMPANIES[0].jsRendered, true)
})

test('Shift_JIS のサイトを文字化けさせずに読む', async () => {
  const { decodeBody } = await import('./agent-checks')
  // 「カカクコム」を Shift_JIS にしたバイト列
  const sjis = Buffer.from([0x83, 0x4a, 0x83, 0x4a, 0x83, 0x4e, 0x83, 0x52, 0x83, 0x80])
  assert.equal(decodeBody(sjis, 'text/html; charset=Shift_JIS'), 'カカクコム')
  assert.equal(decodeBody(sjis, 'text/html; charset=windows-31j'), 'カカクコム')
  const meta = Buffer.concat([Buffer.from('<meta charset="shift_jis">'), sjis])
  assert.match(decodeBody(meta, 'text/html'), /カカクコム/)
  assert.equal(decodeBody(Buffer.from('トヨタ自動車'), 'text/html; charset=UTF-8'), 'トヨタ自動車')
})
