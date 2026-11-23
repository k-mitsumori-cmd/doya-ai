import test from 'node:test'
import assert from 'node:assert/strict'
import { navForMode } from './nav'
import { APP_NEUTRAL_LIMIT_MESSAGE, mapLimitMessage } from './limit-message'

const ITEMS = [
  { href: '/copy' }, { href: '/copy/history' }, { href: '/copy/pricing' }, { href: '/banner/dashboard/plan' }, { href: '/hr/settings/billing' }, { href: '/seo/pricing-tips' },
]

test('navForMode: アプリ表示モードでなければ、同じ配列をそのまま返す（Web のブラウザでは何も変わらない）', () => {
  assert.equal(navForMode(ITEMS, false), ITEMS)
})

test('navForMode: アプリ表示モードのときだけ、止める経路のナビ項目を除く', () => {
  assert.deepEqual(navForMode(ITEMS, true).map((i) => i.href), ['/copy', '/copy/history', '/seo/pricing-tips'])
})

test('mapLimitMessage: アプリ表示モードでなければ、どんな文もそのまま返す', () => {
  for (const m of ['プロプラン契約が必要です', '今月の上限に達しました。料金プランをご確認ください。', '入力が正しくありません', '']) assert.equal(mapLimitMessage(m, false), m)
  assert.equal(mapLimitMessage(null, false), '')
})

test('mapLimitMessage: アプリ表示モードのとき、料金・プラン・契約の語を含む文だけ、中立の文に差し替える', () => {
  for (const m of ['プロプラン契約が必要です', '今月の上限に達しました。料金プランをご確認ください。', 'アップグレードすると使えます', '初月無料でお試しください', '追加購入が必要です']) {
    assert.equal(mapLimitMessage(m, true), APP_NEUTRAL_LIMIT_MESSAGE, m)
  }
  assert.equal(mapLimitMessage('プランの確認', true, ''), '')
  for (const m of ['入力が正しくありません', 'PROJECT_NOT_FOUND', '時間をおいてもう一度お試しください']) assert.equal(mapLimitMessage(m, true), m)
})
