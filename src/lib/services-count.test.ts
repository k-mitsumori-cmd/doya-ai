import assert from 'node:assert/strict'
import { SERVICES, HIDDEN_SERVICE_IDS, getListedServices, getListedServiceCount } from './services'
import { SHELL_GROUPS } from '../components/shell/tools'

const listed = getListedServices()
assert.equal(getListedServiceCount(), listed.length)

// 数は SERVICES の status と非表示の指定だけから決まる（直書きしない）
const expected = SERVICES.filter((s) => (s.status === 'active' || s.status === 'beta') && !HIDDEN_SERVICE_IDS.has(s.id)).length
assert.equal(listed.length, expected)

// ベータで隠したもの（cunning）は数えない
assert.ok(!listed.some((s) => s.hidden === 'beta'))
assert.ok(!listed.some((s) => s.id === 'cunning'))
assert.ok(listed.length > 0)

// 公開中のツールは、すべて4つの分類のどれかに入る（LP の絞り込みから漏れない）
const stageById = new Map<string, string>()
for (const g of SHELL_GROUPS) for (const t of g.tools) stageById.set(t.id, g.stage)
for (const s of listed) {
  const stage = stageById.get(s.id)
  assert.ok(stage && stage !== 'other', `${s.id} が4つの分類に入っていません`)
}
assert.deepEqual(
  SHELL_GROUPS.filter((g) => g.stage !== 'other').map((g) => g.label),
  ['マーケティング', '営業（セールス）', '採用・人材管理', '経理・バックオフィス'],
)
console.log('services-count ok', listed.length)
