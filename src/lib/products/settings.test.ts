// 実行: npx tsx --test src/lib/products/settings.test.ts
// 製品の設定（会社が使う製品・メンバーの担当と既定）の決まり
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  NO_MEMBER_PRODUCTS, decideCompanyProductsUpdate, decideMemberProductsUpdate, enabledProductsFrom, memberProductsFor, orderProductsForSwitcher,
} from './settings'

test('会社が使う製品: 行が無い製品は使う。経営管理は止められない', () => {
  assert.deepEqual(enabledProductsFrom([]), ['management', 'sales', 'marketing', 'hr', 'budget'])
  assert.deepEqual(enabledProductsFrom([{ productId: 'hr', enabled: false }, { productId: 'management', enabled: false }, { productId: 'xx', enabled: false }]), ['management', 'sales', 'marketing', 'budget'])
})

test('会社が使う製品の保存: 知らない値は全体を断る。経営管理はいつも入る', () => {
  assert.deepEqual(decideCompanyProductsUpdate(['sales', 'budget']), { ok: true, enabled: ['management', 'sales', 'budget'] })
  assert.deepEqual(decideCompanyProductsUpdate([]), { ok: true, enabled: ['management'] })
  assert.equal(decideCompanyProductsUpdate(['sales', 'admin']).ok, false)
  assert.equal(decideCompanyProductsUpdate('sales').ok, false)
  assert.equal(decideCompanyProductsUpdate(new Array(20).fill('sales')).ok, false)
})

test('メンバーの担当と既定の保存', () => {
  assert.deepEqual(decideMemberProductsUpdate({ products: ['budget', 'sales', 'sales'], defaultProduct: 'sales' }), { ok: true, products: ['sales', 'budget'], defaultProduct: 'sales' })
  assert.deepEqual(decideMemberProductsUpdate({ products: [], defaultProduct: null }), { ok: true, products: [], defaultProduct: null })
  // 担当が空なら、既定はどの製品でもよい
  assert.deepEqual(decideMemberProductsUpdate({ products: [], defaultProduct: 'hr' }), { ok: true, products: [], defaultProduct: 'hr' })
  assert.deepEqual(decideMemberProductsUpdate({ products: ['sales'], defaultProduct: 'hr' }), { ok: false, status: 400, code: 'DEFAULT_NOT_ASSIGNED' })
  assert.equal(decideMemberProductsUpdate({ products: ['admin'] }).ok, false)
  assert.equal(decideMemberProductsUpdate({ products: ['sales'], defaultProduct: 'x' }).ok, false)
  assert.equal(decideMemberProductsUpdate(null).ok, false)
})

test('今の人の製品: オーナーと管理者は全部を見る。使っていない製品は既定にしない', () => {
  const enabled = enabledProductsFrom([{ productId: 'hr', enabled: false }])
  assert.deepEqual(memberProductsFor({ role: 'member', row: { products: ['budget', 'xx'], defaultProduct: 'budget' }, enabled }), { assigned: ['budget'], adminDefault: 'budget', all: false, enabled, canManage: false })
  assert.equal(memberProductsFor({ role: 'admin', row: null, enabled }).all, true)
  assert.equal(memberProductsFor({ role: 'admin', row: null, enabled }).canManage, true)
  // 旗が off・会社が無いときは、設定の画面への案内を出さない
  assert.equal(NO_MEMBER_PRODUCTS.canManage, false)
  assert.equal(memberProductsFor({ role: 'member', row: { products: ['hr'], defaultProduct: 'hr' }, enabled }).adminDefault, null)
  assert.deepEqual(NO_MEMBER_PRODUCTS.enabled, ['management', 'sales', 'marketing', 'hr', 'budget'])
})

test('切り替えの並び: 担当を先に、使っていない製品は「ほかの製品」へ（隠さない）', () => {
  assert.deepEqual(orderProductsForSwitcher({ assigned: ['budget'], all: false, enabled: ['management', 'sales', 'marketing', 'budget'] }), {
    main: ['budget', 'management', 'sales', 'marketing'], others: ['hr'],
  })
  // 全部を見る人は、決まった並びのまま
  assert.deepEqual(orderProductsForSwitcher({ assigned: ['budget'], all: true, enabled: ['management', 'sales', 'marketing', 'hr', 'budget'] }).main, ['management', 'sales', 'marketing', 'hr', 'budget'])
})
