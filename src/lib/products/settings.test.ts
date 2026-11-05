// 実行: npx tsx --test src/lib/products/settings.test.ts
// 製品の設定（会社が使う製品・メンバーの担当と既定）の決まり
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  NO_MEMBER_PRODUCTS, decideCompanyProductsUpdate, decideMemberProductsUpdate, decideSelfProductsUpdate, enabledProductsFrom, memberProductsFor, orderProductsForSwitcher,
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
  // 「本人に変えさせない」は真偽だけ
  assert.deepEqual(decideMemberProductsUpdate({ products: ['sales'], defaultProduct: 'sales', locked: true }), { ok: true, products: ['sales'], defaultProduct: 'sales', locked: true })
  assert.equal(decideMemberProductsUpdate({ products: ['sales'], locked: 'yes' }).ok, false)
})

test('本人の担当の保存: 管理者がロックしていたら断る。reset で管理者の値に戻す', () => {
  assert.deepEqual(decideSelfProductsUpdate({ products: ['hr', 'sales'], defaultProduct: 'hr' }, false), { ok: true, reset: false, products: ['sales', 'hr'], defaultProduct: 'hr' })
  assert.deepEqual(decideSelfProductsUpdate({ products: ['sales'], defaultProduct: 'sales' }, true), { ok: false, status: 403, code: 'LOCKED' })
  assert.deepEqual(decideSelfProductsUpdate({ reset: true }, true), { ok: false, status: 403, code: 'LOCKED' })
  assert.deepEqual(decideSelfProductsUpdate({ reset: true }, false), { ok: true, reset: true })
  assert.deepEqual(decideSelfProductsUpdate({ products: ['sales'], defaultProduct: 'hr' }, false), { ok: false, status: 400, code: 'DEFAULT_NOT_ASSIGNED' })
  assert.equal(decideSelfProductsUpdate({ products: ['admin'] }, false).ok, false)
  assert.equal(decideSelfProductsUpdate(null, false).ok, false)
})

test('本人の値と管理者の値: 本人が変えたら本人の値。ロック中は管理者の値だけ', () => {
  const enabled = enabledProductsFrom([{ productId: 'hr', enabled: false }])
  const admin = { products: ['sales'], defaultProduct: 'sales' }
  // 本人がまだ決めていない → 管理者の値
  assert.deepEqual(memberProductsFor({ role: 'member', row: { ...admin, selfProducts: ['budget'], selfDefaultProduct: 'budget', selfSet: false }, enabled }).assigned, ['sales'])
  // 本人が変えた → 本人の値
  const mine = memberProductsFor({ role: 'member', row: { ...admin, selfProducts: ['budget', 'marketing'], selfDefaultProduct: 'budget', selfSet: true }, enabled })
  assert.deepEqual([mine.assigned, mine.defaultProduct, mine.source, mine.canEditSelf], [['marketing', 'budget'], 'budget', 'self', true])
  // 本人が担当を空にした → 空のまま（管理者の値に戻らない）
  assert.deepEqual(memberProductsFor({ role: 'member', row: { ...admin, selfProducts: [], selfDefaultProduct: null, selfSet: true }, enabled }).assigned, [])
  // ロック中 → 本人の値は残っていても使わない。本人は変えられない
  const locked = memberProductsFor({ role: 'member', row: { ...admin, selfProducts: ['budget'], selfDefaultProduct: 'budget', selfSet: true, locked: true }, enabled })
  assert.deepEqual([locked.assigned, locked.defaultProduct, locked.source, locked.locked, locked.canEditSelf], [['sales'], 'sales', 'admin', true, false])
  // 本人が既定にした製品を会社が止めた → 既定にしない
  assert.equal(memberProductsFor({ role: 'member', row: { ...admin, selfProducts: ['hr'], selfDefaultProduct: 'hr', selfSet: true }, enabled }).defaultProduct, null)
})

test('今の人の製品: オーナーと管理者は全部を見る。使っていない製品は既定にしない', () => {
  const enabled = enabledProductsFrom([{ productId: 'hr', enabled: false }])
  assert.deepEqual(memberProductsFor({ role: 'member', row: { products: ['budget', 'xx'], defaultProduct: 'budget' }, enabled }), { assigned: ['budget'], defaultProduct: 'budget', source: 'admin', locked: false, all: false, enabled, canManage: false, canEditSelf: true })
  assert.equal(memberProductsFor({ role: 'admin', row: null, enabled }).all, true)
  assert.equal(memberProductsFor({ role: 'admin', row: null, enabled }).canManage, true)
  // 旗が off・会社が無いときは、設定の画面への案内を出さない
  assert.equal(NO_MEMBER_PRODUCTS.canManage, false)
  assert.equal(NO_MEMBER_PRODUCTS.canEditSelf, false)
  assert.equal(memberProductsFor({ role: 'member', row: { products: ['hr'], defaultProduct: 'hr' }, enabled }).defaultProduct, null)
  // 行がまだ無い人も、自分で決められる
  assert.deepEqual(memberProductsFor({ role: 'member', row: null, enabled }).source, 'none')
  assert.equal(memberProductsFor({ role: 'member', row: null, enabled }).canEditSelf, true)
  assert.deepEqual(NO_MEMBER_PRODUCTS.enabled, ['management', 'sales', 'marketing', 'hr', 'budget'])
})

test('切り替えの並び: 担当を先に、使っていない製品は「ほかの製品」へ（隠さない）', () => {
  assert.deepEqual(orderProductsForSwitcher({ assigned: ['budget'], all: false, enabled: ['management', 'sales', 'marketing', 'budget'] }), {
    main: ['budget', 'management', 'sales', 'marketing'], others: ['hr'],
  })
  // 全部を見る人は、決まった並びのまま
  assert.deepEqual(orderProductsForSwitcher({ assigned: ['budget'], all: true, enabled: ['management', 'sales', 'marketing', 'hr', 'budget'] }).main, ['management', 'sales', 'marketing', 'hr', 'budget'])
})
