// 実行: npm run test:roles
// 会社ごとの切り替え（policy.ts）の読み込みと更新の決まり
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { COMPANY_ROLES } from './roles'
import { CURRENT_TOOL_BEHAVIOR, DEFAULT_ROLE_POLICY, decidePolicyUpdate, normalizeRolePolicy, POLICY_KEYS, policyChoices } from './policy'

test('初期値は、請求はマネージャー以上・契約はマネージャー以上・見積の自己確定は不可・HR はオーナーだけ', () => {
  assert.deepEqual({ ...DEFAULT_ROLE_POLICY }, { invoiceIssueMin: 'manager', contractEditMin: 'manager', quoteFinalizeMin: 'manager', quoteSelfFinalize: 'deny', hrSelfFinalize: 'owner_only' })
  assert.equal(Object.isFrozen(DEFAULT_ROLE_POLICY), true)
})

test('今のツールの動きの値は、契約をメンバーも直せて、見積と HR の自己確定を許す', () => {
  assert.equal(CURRENT_TOOL_BEHAVIOR.contractEditMin, 'member')
  assert.equal(CURRENT_TOOL_BEHAVIOR.quoteSelfFinalize, 'allow')
  assert.equal(CURRENT_TOOL_BEHAVIOR.hrSelfFinalize, 'owner_and_admin')
})

test('normalizeRolePolicy: null・undefined・配列・文字列・数値は、初期値になる', () => {
  for (const raw of [null, undefined, [], ['invoiceIssueMin'], 'admin', '', 0, 42, true]) {
    assert.deepEqual(normalizeRolePolicy(raw), { ...DEFAULT_ROLE_POLICY }, JSON.stringify(raw))
  }
})

test('normalizeRolePolicy: 知らないキーは捨てる', () => {
  const out = normalizeRolePolicy({ invoiceIssueMin: 'admin', evil: 'x', __proto__: { polluted: 1 } }) as unknown as Record<string, unknown>
  assert.equal(out.invoiceIssueMin, 'admin')
  assert.equal('evil' in out, false)
  assert.deepEqual(Object.keys(out).sort(), [...POLICY_KEYS].sort())
})

test('normalizeRolePolicy: 知らない値は、そのキーだけ初期値に戻る（ほかのキーは生かす）', () => {
  const out = normalizeRolePolicy({ invoiceIssueMin: 'owner', contractEditMin: 'admin', quoteFinalizeMin: 7, quoteSelfFinalize: 'ALLOW', hrSelfFinalize: 'owner_and_admin' })
  assert.deepEqual(out, { invoiceIssueMin: 'manager', contractEditMin: 'admin', quoteFinalizeMin: 'manager', quoteSelfFinalize: 'deny', hrSelfFinalize: 'owner_and_admin' })
})

test('normalizeRolePolicy: 選択肢のすべての値が、そのまま通る', () => {
  for (const key of POLICY_KEYS) {
    for (const v of policyChoices(key)) assert.equal(normalizeRolePolicy({ [key]: v })[key], v, `${key}=${v}`)
  }
})

test('decidePolicyUpdate: オーナー以外は 403（役割 5 つすべて）', () => {
  for (const actor of COMPANY_ROLES.filter((r) => r !== 'owner')) {
    assert.deepEqual(decidePolicyUpdate({ actor, current: DEFAULT_ROLE_POLICY, patch: { invoiceIssueMin: 'admin' } }), { ok: false, status: 403, code: 'OWNER_REQUIRED' }, actor)
  }
})

test('decidePolicyUpdate: オーナーが有効な値を送ると変わる。changed に変わったキーだけが入る', () => {
  const r = decidePolicyUpdate({ actor: 'owner', current: DEFAULT_ROLE_POLICY, patch: { invoiceIssueMin: 'admin', quoteSelfFinalize: 'deny', hrSelfFinalize: 'nobody' } })
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.deepEqual(r.changed.sort(), ['hrSelfFinalize', 'invoiceIssueMin'])
  assert.deepEqual(r.policy, { ...DEFAULT_ROLE_POLICY, invoiceIssueMin: 'admin', hrSelfFinalize: 'nobody' })
})

test('decidePolicyUpdate: 今の値を元の policy から書き換えない（current は変わらない）', () => {
  const current = { ...DEFAULT_ROLE_POLICY }
  decidePolicyUpdate({ actor: 'owner', current, patch: { invoiceIssueMin: 'admin' } })
  assert.deepEqual(current, { ...DEFAULT_ROLE_POLICY })
})

test('decidePolicyUpdate: 知らない値が1つでもあれば、有効な値があっても全体を断る', () => {
  for (const patch of [
    { invoiceIssueMin: 'admin', contractEditMin: 'owner' },
    { invoiceIssueMin: 'admin', quoteSelfFinalize: 'maybe' },
    { invoiceIssueMin: 'admin', unknownKey: 'x' },
    { invoiceIssueMin: 'admin', hrSelfFinalize: null },
    { invoiceIssueMin: 'admin', quoteFinalizeMin: 1 },
  ]) {
    assert.deepEqual(decidePolicyUpdate({ actor: 'owner', current: DEFAULT_ROLE_POLICY, patch }), { ok: false, status: 400, code: 'INVALID_VALUE' }, JSON.stringify(patch))
  }
})

test('decidePolicyUpdate: patch が null・配列・文字列・数値なら INVALID_VALUE', () => {
  for (const patch of [null, undefined, [], [{ invoiceIssueMin: 'admin' }], 'admin', 3]) {
    assert.deepEqual(decidePolicyUpdate({ actor: 'owner', current: DEFAULT_ROLE_POLICY, patch }), { ok: false, status: 400, code: 'INVALID_VALUE' }, JSON.stringify(patch))
  }
})

test('decidePolicyUpdate: 変わらないなら NO_CHANGE（空の patch も、今と同じ値だけの patch も）', () => {
  assert.deepEqual(decidePolicyUpdate({ actor: 'owner', current: DEFAULT_ROLE_POLICY, patch: {} }), { ok: false, status: 400, code: 'NO_CHANGE' })
  assert.deepEqual(decidePolicyUpdate({ actor: 'owner', current: DEFAULT_ROLE_POLICY, patch: { invoiceIssueMin: 'manager', hrSelfFinalize: 'owner_only' } }), { ok: false, status: 400, code: 'NO_CHANGE' })
})

test('decidePolicyUpdate: オーナー以外の判定は、patch の中身より先に出る（権限の無い人に値の良し悪しを教えない）', () => {
  assert.equal(decidePolicyUpdate({ actor: 'admin', current: DEFAULT_ROLE_POLICY, patch: 'ゴミ' }).ok, false)
  const r = decidePolicyUpdate({ actor: 'admin', current: DEFAULT_ROLE_POLICY, patch: 'ゴミ' })
  assert.equal(!r.ok && r.status, 403)
})
