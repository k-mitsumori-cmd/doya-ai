import test from 'node:test'
import assert from 'node:assert/strict'
import { decideAppModeClient, hasAppCookie, hasAppUserAgent, isAppModeEnabled, isAppRequest } from './detect'

const ON = { APP_MODE_ENABLED: '1' }
const UA_APP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 DoyaBuddyApp'
const UA_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const h = (o: Record<string, string>) => new Headers(o)

test('旗: APP_MODE_ENABLED が 1 のときだけオン（未設定・0・空・true はオフ）', () => {
  assert.equal(isAppModeEnabled(ON), true)
  for (const v of [undefined, '', '0', 'true', 'on', ' 1']) assert.equal(isAppModeEnabled({ APP_MODE_ENABLED: v }), false)
})

test('User-Agent: DoyaBuddyApp を1語として含むときだけ。大文字小文字は区別しない。似た名前は対象外', () => {
  assert.equal(hasAppUserAgent(UA_APP), true)
  assert.equal(hasAppUserAgent('DoyaBuddyApp'), true)
  assert.equal(hasAppUserAgent('Foo DoyaBuddyApp/1.2.3 Bar'), true)
  assert.equal(hasAppUserAgent('foo doyabuddyapp'), true)
  assert.equal(hasAppUserAgent('FOO DOYABUDDYAPP/2'), true)
  for (const ua of [UA_SAFARI, '', null, undefined, 'DoyaBuddy', 'DoyaBuddyApps', 'NotDoyaBuddyApp', 'DoyaBuddyAppX/1', 'Doya Buddy App', 'xDoyaBuddyApp']) {
    assert.equal(hasAppUserAgent(ua), false, String(ua))
  }
})

test('Cookie: doya_app=1 だけ。名前と値の完全一致', () => {
  assert.equal(hasAppCookie('doya_app=1'), true)
  assert.equal(hasAppCookie('a=b; doya_app=1; c=d'), true)
  assert.equal(hasAppCookie('a=b;doya_app=1'), true)
  for (const c of [null, undefined, '', 'doya_app=0', 'doya_app=', 'doya_app=11', 'xdoya_app=1', 'doya_app_x=1', 'DOYA_APP=1', 'a=doya_app=1', 'doya_app']) {
    assert.equal(hasAppCookie(c), false, String(c))
  }
})

test('サーバー: 旗オン＋（UA または Cookie）でアプリ。どちらも無ければ違う', () => {
  assert.equal(isAppRequest(h({ 'user-agent': UA_APP }), ON), true)
  assert.equal(isAppRequest(h({ cookie: 'doya_app=1', 'user-agent': UA_SAFARI }), ON), true)
  assert.equal(isAppRequest(h({ 'user-agent': UA_SAFARI }), ON), false)
  assert.equal(isAppRequest(h({}), ON), false)
  assert.equal(isAppRequest(h({ cookie: 'doya_app=0' }), ON), false)
})

test('サーバー: 旗オフなら、UA も Cookie もあっても、常にアプリではない', () => {
  for (const env of [{}, { APP_MODE_ENABLED: '0' }, { APP_MODE_ENABLED: '' }, { APP_AUTH_ENABLED: '1' }]) {
    assert.equal(isAppRequest(h({ 'user-agent': UA_APP, cookie: 'doya_app=1' }), env), false)
  }
})

test('ブラウザ: 旗オン＋（UA または document.cookie）でアプリ。旗オフなら常に違う', () => {
  assert.equal(decideAppModeClient({ enabled: true, userAgent: UA_APP, cookie: '' }), true)
  assert.equal(decideAppModeClient({ enabled: true, userAgent: UA_SAFARI, cookie: 'x=y; doya_app=1' }), true)
  assert.equal(decideAppModeClient({ enabled: true, userAgent: UA_SAFARI, cookie: 'x=y' }), false)
  assert.equal(decideAppModeClient({ enabled: true, userAgent: undefined, cookie: undefined }), false)
  assert.equal(decideAppModeClient({ enabled: false, userAgent: UA_APP, cookie: 'doya_app=1' }), false)
})
