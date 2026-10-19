// 実行: npx tsx --test src/lib/shell/company.test.ts
// アカウントの会社の名前の選び方（UI 品質 B-1）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickAccountCompany } from './company'

test('候補が無ければ null', () => {
  assert.equal(pickAccountCompany([]), null)
  assert.equal(pickAccountCompany([{ name: '' }, { name: '  ' }]), null)
})

test('最初に見つかった名前を1つだけ返す', () => {
  assert.deepEqual(pickAccountCompany([{ name: ' アルファ株式会社 ' }, { name: 'ベータ株式会社' }]), { name: 'アルファ株式会社', source: 'tool' })
  assert.deepEqual(pickAccountCompany([{ name: '' }, { name: 'ベータ株式会社' }]), { name: 'ベータ株式会社', source: 'tool' })
})

import { parseCompanyInput, uniqueCandidateNames } from './company'

test('候補は空白を除き、同じ名前を1つにまとめる', () => {
  assert.deepEqual(uniqueCandidateNames([' 株式会社スリスタ', '株式会社スリスタ', 'スリスタ', '', null, 3]), ['株式会社スリスタ', 'スリスタ'])
})

test('登録の入力を確かめる', () => {
  assert.deepEqual(parseCompanyInput({ name: ' 株式会社スリスタ ', websiteUrl: 'surisuta.jp', industry: '' }), { ok: true, data: { name: '株式会社スリスタ', websiteUrl: 'https://surisuta.jp/', industry: null } })
  assert.equal(parseCompanyInput({ name: '' }).ok, false)
  assert.equal(parseCompanyInput({ name: 'a'.repeat(101) }).ok, false)
  for (const bad of ['javascript:alert(1)', 'ftp://x.jp', 'localhost', 'https://', 'not a url']) {
    assert.equal(parseCompanyInput({ name: 'x', websiteUrl: bad }).ok, false, bad)
  }
  assert.equal(parseCompanyInput(null).ok, false)
  // userId などの余計な値は、結果に入らない
  const r = parseCompanyInput({ name: 'x', userId: 'someone-else' })
  assert.deepEqual(r, { ok: true, data: { name: 'x', websiteUrl: null, industry: null } })
})
