import test from 'node:test'
import assert from 'node:assert/strict'
import { bearerToCookie, isAppAuthRoute, sessionCookieName, SAFE_BEARER_VALUE } from './bearer-cookie'
import { isSafeTokenValue } from './device-token'

const T = 'a'.repeat(43)

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
