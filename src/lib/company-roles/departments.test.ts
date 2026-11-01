// 実行: npm run test:roles
// 社員ごとの部署（departments.ts）の決まりを確かめる。DB には触らない。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ALL_DEPARTMENTS, decideDepartmentsUpdate, memberDepartmentsFor, normalizeDepartments } from './departments'

test('部署の id は4つだけ。知らない値と重複は捨て、決まった順に並べる', () => {
  assert.deepEqual(normalizeDepartments(['hr', 'sales', 'hr', 'finance', 3, null]), ['sales', 'hr'])
  assert.deepEqual(normalizeDepartments('sales'), [])
  assert.deepEqual(normalizeDepartments(null), [])
})

test('オーナーと管理者は all。ほかの役割は、設定した部署だけ', () => {
  assert.deepEqual(memberDepartmentsFor({ role: 'owner', departments: ['sales'] }), { primary: ['sales'], all: true })
  assert.deepEqual(memberDepartmentsFor({ role: 'admin', departments: [] }), { primary: [], all: true })
  for (const role of ['manager', 'billing', 'member', 'guest', null, 'unknown']) {
    assert.deepEqual(memberDepartmentsFor({ role, departments: ['marketing', 'admin'] }), { primary: ['marketing', 'admin'], all: false }, String(role))
  }
})

test('決まらないとき（旗 off・会社なし）は、全部を出す形', () => {
  assert.deepEqual(ALL_DEPARTMENTS, { primary: [], all: true })
})

test('部署の変更: 知らない値が1つでもあれば全体を断る。空は受け付ける', () => {
  assert.deepEqual(decideDepartmentsUpdate(['sales', 'hr']), { ok: true, departments: ['sales', 'hr'] })
  assert.deepEqual(decideDepartmentsUpdate([]), { ok: true, departments: [] })
  assert.equal(decideDepartmentsUpdate(['sales', 'finance']).ok, false)
  assert.equal(decideDepartmentsUpdate('sales').ok, false)
  assert.equal(decideDepartmentsUpdate(null).ok, false)
  assert.equal(decideDepartmentsUpdate(Array(9).fill('sales')).ok, false)
})
