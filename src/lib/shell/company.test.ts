// 実行: npx tsx --test src/lib/shell/company.test.ts
// 枠の左下に出す「登録会社」の選び方（UI 品質 B-1）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { companyHref, pickCurrentCompany, type ShellCompany } from './company'

const c = (tool: string, slug: string, name = `${tool}-${slug}`): ShellCompany => ({ tool, slug, name, href: companyHref(tool, slug) })
const list = [c('sfa', 'alpha', 'アルファ株式会社'), c('sfa', 'beta', 'ベータ株式会社'), c('quote', 'q1', '見積の会社'), c('aio', '日本語', 'AIO の会社')]

test('組織が無ければ null', () => {
  assert.equal(pickCurrentCompany([], '/sfa/alpha', null, null), null)
})

test('URL の組織を最優先する', () => {
  assert.equal(pickCurrentCompany(list, '/sfa/beta/deals', null, null)?.slug, 'beta')
  assert.equal(pickCurrentCompany(list, `/aio/${encodeURIComponent('日本語')}/scan`, null, null)?.slug, '日本語')
  assert.equal(pickCurrentCompany(list, '/quote', 'q1', { tool: 'sfa', slug: 'beta' })?.tool, 'quote')
})

test('そのツールの組織が URL に無ければ、そのツールの最初の組織', () => {
  assert.equal(pickCurrentCompany(list, '/sfa', null, { tool: 'quote', slug: 'q1' })?.slug, 'alpha')
  assert.equal(pickCurrentCompany(list, '/sfa/unknown', null, null)?.slug, 'alpha')
})

test('ツールの外では、最後に使った組織、無ければ最初の組織', () => {
  assert.equal(pickCurrentCompany(list, '/home', null, { tool: 'sfa', slug: 'beta' })?.slug, 'beta')
  assert.equal(pickCurrentCompany(list, '/home', null, { tool: 'sfa', slug: 'gone' })?.slug, 'alpha')
  assert.equal(pickCurrentCompany(list, '/banner', null, null)?.slug, 'alpha')
})

test('切り替え先の URL は、そのツールの組織の画面', () => {
  assert.equal(companyHref('sfa', 'a b'), '/sfa/a%20b')
  assert.equal(companyHref('aio', 'x'), '/aio/x/scan')
  assert.equal(companyHref('quote', 'x'), '/quote?org=x')
  assert.equal(companyHref('mensetsu', 'x'), '/mensetsu')
})
