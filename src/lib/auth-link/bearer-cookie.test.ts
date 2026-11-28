import test from 'node:test'
import assert from 'node:assert/strict'
import { APP_REQUEST_HEADER, bearerToCookie as rawBearerToCookie, isAppAuthRoute, sessionCookieName, SAFE_BEARER_VALUE } from './bearer-cookie'
import { isSafeTokenValue } from './device-token'

const T = 'a'.repeat(43)
// 既定でアプリのヘッダー（x-doya-app: 1）を付ける。ヘッダー無しの試験は appHeader を明示する
const bearerToCookie = (a: Parameters<typeof rawBearerToCookie>[0]) => rawBearerToCookie({ appHeader: '1', ...a })

test('Authorization が無い・Bearer でないときは何もしない', () => {
  for (const authorization of [undefined, null, '', 'Basic abc', 'Token xyz']) {
    assert.deepEqual(bearerToCookie({ authorization, cookie: 'a=b', nextauthUrl: 'https://x.example' }), { kind: 'none' })
  }
})

test('Bearer の値を、https なら __Secure- 付きの Cookie 名に置き換える。http は付けない', () => {
  assert.deepEqual(bearerToCookie({ authorization: `Bearer ${T}`, cookie: null, nextauthUrl: 'https://doya-ai.example' }), { kind: 'replace', cookie: `__Secure-next-auth.session-token=${T}` })
  assert.deepEqual(bearerToCookie({ authorization: `bearer ${T}`, cookie: '', nextauthUrl: 'http://localhost:3000' }), { kind: 'replace', cookie: `next-auth.session-token=${T}` })
  assert.equal(sessionCookieName(undefined), 'next-auth.session-token')
})

test('Bearer と Cookie が両方あるとき、Bearer が勝ち、古いセッション Cookie（分割したものを含む）は捨て、ほかの Cookie は残す', () => {
  const r = bearerToCookie({ authorization: `Bearer ${T}`, cookie: 'foo=bar; __Secure-next-auth.session-token=STALE; next-auth.session-token.0=x; baz=1', nextauthUrl: 'https://x.example' })
  assert.deepEqual(r, { kind: 'replace', cookie: `foo=bar; baz=1; __Secure-next-auth.session-token=${T}` })
})

test('不正な Bearer の値は invalid（Cookie に別の Cookie を紛れ込ませる値、短すぎる値、空）', () => {
  for (const bad of ['Bearer ', 'Bearer short', `Bearer ${T}; admin=1`, `Bearer ${T},x`, `Bearer ${T}=`, `Bearer ${'a'.repeat(300)}`, `Bearer ${T} extra`, 'Bearer a b']) {
    assert.deepEqual(bearerToCookie({ authorization: bad, cookie: 'a=b', nextauthUrl: 'https://x.example' }), { kind: 'invalid' }, bad)
  }
})

test('device-token の isSafeTokenValue と同じ範囲を許す', () => {
  for (const v of ['a'.repeat(15), 'a'.repeat(16), 'a'.repeat(256), 'a'.repeat(257), '123e4567-e89b-12d3-a456-426614174000', 'a;b'.padEnd(20, 'a'), '日本語'.repeat(10)]) {
    assert.equal(SAFE_BEARER_VALUE.test(v), isSafeTokenValue(v), v)
  }
})

test('アプリ用の認証 API は置き換えの対象外', () => {
  assert.equal(isAppAuthRoute('/api/app/auth/exchange'), true)
  assert.equal(isAppAuthRoute('/api/app/auth'), true)
  assert.equal(isAppAuthRoute('/api/app/authx'), false)
  assert.equal(isAppAuthRoute('/api/account/delete'), false)
})

test('x-doya-app が無い・値が違う Bearer は、CRON_SECRET 形でも JWT 形でも、何も変えず 401 にもならない', () => {
  const cron = 'c'.repeat(40) // 英数字の CRON_SECRET
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghijklmnop' // ドットを含む（Bearer の形の範囲外）
  for (const appHeader of [undefined, null, '', '0', 'true']) {
    for (const t of [cron, jwt, 'short', 'a;b']) {
      assert.deepEqual(rawBearerToCookie({ appHeader, authorization: `Bearer ${t}`, cookie: 'a=b', nextauthUrl: 'https://x.example' }), { kind: 'none' }, `${appHeader}/${t}`)
    }
  }
  assert.equal(APP_REQUEST_HEADER, 'x-doya-app')
})

test('対象外の経路: Cron・Stripe の webhook・管理用・アプリ用の認証は、そのもの・配下とも true。似た名前は false', () => {
  for (const p of ['/api/cron/daily-summary', '/api/cron', '/api/stripe/webhook', '/api/admin/users', '/api/app/auth/me']) assert.equal(isAppAuthRoute(p), true, p)
  for (const p of ['/api/cronx', '/api/stripe/webhooks', '/api/stripe/checkout', '/api/administrator', '/api/account/delete', '/api/seo/x']) assert.equal(isAppAuthRoute(p), false, p)
})
