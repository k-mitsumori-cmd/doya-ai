// 実行: npx tsx --test src/lib/departments.test.ts
// 部署の表（src/lib/departments.ts）の決まり。
// - 経営ホーム以外のツールは、ちょうど1つの部署に入る（入れ忘れ・二重登録をここで止める）
// - cookie の読み方・並べ方
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ALL_SHELL_TOOLS } from '@/components/shell/tools'
import {
  DEPARTMENTS, departmentOfPath, departmentOfTool, orderDepartments, parseDepartmentsCookie, parseDeptQuery, serializeDepartments,
} from './departments'

test('メニューに出るツールは、ちょうど1つの部署に入る', () => {
  for (const t of ALL_SHELL_TOOLS) {
    if (t.id === 'home') continue
    const hits = DEPARTMENTS.filter((d) => d.toolIds.includes(t.id))
    assert.equal(hits.length, 1, `${t.id} は ${hits.length} 個の部署に入っている`)
  }
})

test('表の中でツールの id が重ならない', () => {
  const all = DEPARTMENTS.flatMap((d) => d.toolIds)
  assert.equal(new Set(all).size, all.length)
})

test('部署の名前と並び', () => {
  assert.deepEqual(DEPARTMENTS.map((d) => d.id), ['marketing', 'sales', 'hr', 'admin'])
  assert.deepEqual(DEPARTMENTS.map((d) => d.name), ['ドヤマーケAI', 'ドヤセールスAI', 'ドヤ人事AI', 'ドヤ管理AI'])
  assert.deepEqual(DEPARTMENTS.map((d) => d.short), ['マーケ', 'セールス', '人事', '管理'])
})

test('departmentOfTool / departmentOfPath', () => {
  assert.equal(departmentOfTool('quote'), 'sales')
  assert.equal(departmentOfTool('income'), 'admin')
  assert.equal(departmentOfTool('home'), null)
  assert.equal(departmentOfPath('/banner/dashboard/create'), 'marketing')
  assert.equal(departmentOfPath('/hr/employees/new'), 'hr')
  assert.equal(departmentOfPath('/'), null)
})

test('parseDepartmentsCookie: 知らない id を捨て、重複を除く', () => {
  assert.deepEqual(parseDepartmentsCookie('sales,hr'), ['sales', 'hr'])
  assert.deepEqual(parseDepartmentsCookie('sales,bogus,sales,admin'), ['sales', 'admin'])
  assert.deepEqual(parseDepartmentsCookie(encodeURIComponent('hr,marketing')), ['hr', 'marketing'])
  assert.deepEqual(parseDepartmentsCookie(' sales , '), ['sales'])
  assert.deepEqual(parseDepartmentsCookie(''), [])
  assert.deepEqual(parseDepartmentsCookie(undefined), [])
  assert.deepEqual(parseDepartmentsCookie('%E0%A4%A'), [])
  assert.equal(serializeDepartments(['sales', 'sales', 'hr']), 'sales%2Chr')
})

test('orderDepartments: 主の部署を渡した順で先に、残りは既定の順', () => {
  assert.deepEqual(orderDepartments([]), ['marketing', 'sales', 'hr', 'admin'])
  assert.deepEqual(orderDepartments(['hr']), ['hr', 'marketing', 'sales', 'admin'])
  assert.deepEqual(orderDepartments(['admin', 'sales']), ['admin', 'sales', 'marketing', 'hr'])
  assert.deepEqual(orderDepartments(['sales', 'sales']), ['sales', 'marketing', 'hr', 'admin'])
})

test('parseDeptQuery: 知らない値は null', () => {
  assert.equal(parseDeptQuery('sales'), 'sales')
  assert.equal(parseDeptQuery(['hr', 'sales']), 'hr')
  assert.equal(parseDeptQuery('x'), null)
  assert.equal(parseDeptQuery(undefined), null)
})
