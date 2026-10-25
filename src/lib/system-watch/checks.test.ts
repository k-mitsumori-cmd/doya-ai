import { test } from 'node:test'
import assert from 'node:assert/strict'
import { freeChecks, pageChecks } from './checks'
import { paidChecks } from './paid-checks'
import { SERVICES, RETIRED_SERVICE_IDS } from '@/lib/services'

test('確認の名前は重複せず、どれにも直し方の候補がある', () => {
  const all = [...freeChecks(), ...paidChecks()]
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
  assert.ok(paidChecks().every(c => c.id.startsWith('paid:')))
})
