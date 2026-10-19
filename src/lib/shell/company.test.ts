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
  assert.deepEqual(pickAccountCompany([{ name: ' アルファ株式会社 ' }, { name: 'ベータ株式会社' }]), { name: 'アルファ株式会社' })
  assert.deepEqual(pickAccountCompany([{ name: '' }, { name: 'ベータ株式会社' }]), { name: 'ベータ株式会社' })
})
