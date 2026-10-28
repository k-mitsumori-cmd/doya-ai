// 実行: npx tsx --test 'src/app/(shell)/home/quick-request.test.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseQuickRequest, parseYenAmount, readAmountParam } from './quick-request'

test('金額: 万・千・億・カンマ・全角・小数を円で読む', () => {
  assert.equal(parseYenAmount('20万円'), 200_000)
  assert.equal(parseYenAmount('20万'), 200_000)
  assert.equal(parseYenAmount('200,000円'), 200_000)
  assert.equal(parseYenAmount('２０万円'), 200_000)
  assert.equal(parseYenAmount('1.5万円'), 15_000)
  assert.equal(parseYenAmount('3千円'), 3_000)
  assert.equal(parseYenAmount('2億円'), 200_000_000)
})

test('金額: 単位も円も無い数は読まない', () => {
  assert.equal(parseYenAmount('3つの柱'), null)
  assert.equal(parseYenAmount('2025年の支出'), null)
  assert.equal(parseYenAmount(''), null)
  assert.equal(parseYenAmount('0円'), null)
})

test('「20万円支出を登録したい」は、支出の登録画面を金額つきで開く', () => {
  const q = parseQuickRequest('20万円支出を登録したい')
  assert.equal(q?.kind, 'expense')
  assert.equal(q?.amount, 200_000)
  assert.equal(q?.href, '/expense?to=new-contract&amount=200000')
})

test('請求・売上の登録は、請求書の作成画面を金額つきで開く', () => {
  assert.equal(parseQuickRequest('30万円の請求書を作りたい')?.href, '/income/invoices/new?amount=300000')
  assert.equal(parseQuickRequest('売上50万円を登録')?.kind, 'invoice')
})

test('見るだけの依頼・金額の無い依頼・ほかの依頼は、すぐ開かない', () => {
  assert.equal(parseQuickRequest('今月の売上を見たい'), null)
  assert.equal(parseQuickRequest('支出を登録したい'), null)
  assert.equal(parseQuickRequest('20万円の予算で商談の準備をしたい'), null)
  assert.equal(parseQuickRequest(''), null)
})

test('URL の amount は、正の整数の円だけを受け取る', () => {
  assert.equal(readAmountParam('200000'), '200000')
  assert.equal(readAmountParam(''), '')
  assert.equal(readAmountParam(null), '')
  assert.equal(readAmountParam('-5'), '')
  assert.equal(readAmountParam('1e9'), '')
  assert.equal(readAmountParam('0'), '')
  assert.equal(readAmountParam('99999999999'), '')
})
