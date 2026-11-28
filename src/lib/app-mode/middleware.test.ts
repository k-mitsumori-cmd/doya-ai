import test from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { middleware } from '../../middleware'

const UA_APP = 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Mobile/15E148 DoyaBuddyApp'
const UA_WEB = 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'
const T = 'b'.repeat(43)
const req = (path: string, headers: Record<string, string | undefined> = {}) =>
  new NextRequest(`http://localhost:3000${path}`, { headers: Object.entries(headers).filter((e): e is [string, string] => e[1] !== undefined) })
const withEnv = async (vars: Record<string, string | undefined>, fn: () => void | Promise<void>) => {
  const keys = Object.keys(vars)
  const before = Object.fromEntries(keys.map((k) => [k, process.env[k]]))
  for (const k of keys) { if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k] }
  try { await fn() } finally { for (const k of keys) { if (before[k] === undefined) delete process.env[k]; else process.env[k] = before[k] } }
}
const isRewriteTo = (res: Response, path: string) => res.headers.get('x-middleware-rewrite')?.endsWith(path) === true

test('旗オフ: UA が DoyaBuddyApp でも Cookie があっても、何も変わらない（rewrite も 404 も無い）', async () => {
  for (const flag of [undefined, '0', '', 'true']) {
    await withEnv({ APP_MODE_ENABLED: flag, APP_AUTH_ENABLED: undefined }, () => {
      for (const p of ['/pricing', '/seo/pricing', '/tokushoho', '/api/stripe/checkout', '/api/stripe/portal', '/api/pricing/power-pack']) {
        for (const h of [{ 'user-agent': UA_APP }, { cookie: 'doya_app=1' }]) {
          const res = middleware(req(p, h))
          assert.equal(res.status, 200, p)
          assert.equal(res.headers.get('x-middleware-rewrite'), null, p)
        }
      }
    })
  }
})

test('旗オン・アプリでない要求（UA も Cookie も無い）: 何も変わらない', async () => {
  await withEnv({ APP_MODE_ENABLED: '1', APP_AUTH_ENABLED: undefined }, () => {
    for (const p of ['/pricing', '/seo/pricing', '/tokushoho', '/api/stripe/checkout', '/api/stripe/portal', '/seo']) {
      for (const h of [{ 'user-agent': UA_WEB }, {}, { cookie: 'doya_app=0' }]) {
        const res = middleware(req(p, h))
        assert.equal(res.status, 200, p)
        assert.equal(res.headers.get('x-middleware-rewrite'), null, p)
      }
    }
  })
})

test('旗オン・アプリの要求: 画面は /app-unavailable へ rewrite（クエリは落とす）、API は 404', async () => {
  await withEnv({ APP_MODE_ENABLED: '1', APP_AUTH_ENABLED: undefined }, async () => {
    for (const h of [{ 'user-agent': UA_APP }, { cookie: 'a=b; doya_app=1', 'user-agent': UA_WEB }]) {
      for (const p of ['/pricing', '/pricing?plan=pro', '/%70ricing', '//pricing', '/./pricing', '/pricing/', '/seo/pricing', '/tokushoho', '/hr/settings/billing', '/billing/portal-unavailable']) {
        const res = middleware(req(p, h))
        assert.ok(isRewriteTo(res, '/app-unavailable'), p + ' → ' + res.headers.get('x-middleware-rewrite'))
        assert.equal(res.headers.get('x-middleware-rewrite')?.includes('?'), false, p)
      }
      for (const p of ['/api/stripe/checkout', '/api/stripe/portal', '/api/stripe/checkout/', '/api/%73tripe/checkout', '/api/pricing/power-pack/confirm', '/api/hr/billing/portal']) {
        const res = middleware(req(p, h))
        assert.equal(res.status, 404, p)
        assert.deepEqual(await res.json(), { code: 'NOT_FOUND' })
      }
    }
  })
})

test('旗オン・アプリの要求でも、通常の経路は止まらない', async () => {
  await withEnv({ APP_MODE_ENABLED: '1', APP_AUTH_ENABLED: undefined }, () => {
    for (const p of ['/', '/seo', '/banner/dashboard', '/api/auth/session', '/api/seo/articles', '/api/stripe/webhook', '/app-unavailable', '/settings/devices']) {
      const res = middleware(req(p, { 'user-agent': UA_APP }))
      assert.equal(res.status, 200, p)
      assert.equal(res.headers.get('x-middleware-rewrite'), null, p)
    }
  })
})

test('Bearer の置き換え: アプリ認証の旗もオンのとき、契約の API は Bearer を付けても 404（置き換えで通り抜けない）。通常の API は従来どおり置き換える', async () => {
  await withEnv({ APP_MODE_ENABLED: '1', APP_AUTH_ENABLED: '1', NEXTAUTH_URL: 'http://localhost:3000' }, async () => {
    const h = { 'x-doya-app': '1', authorization: `Bearer ${T}`, cookie: 'a=b', 'user-agent': UA_APP }
    const blocked = middleware(req('/api/stripe/checkout', h))
    assert.equal(blocked.status, 404)
    assert.equal(blocked.headers.get('x-middleware-request-cookie'), null)
    const normal = middleware(req('/api/some/route', h))
    assert.equal(normal.status, 200)
    assert.equal(normal.headers.get('x-middleware-request-cookie'), `a=b; next-auth.session-token=${T}`)
  })
  // アプリ表示モードの旗がオフなら、アプリ認証の旗がオンでも、従来の動きのまま
  await withEnv({ APP_MODE_ENABLED: undefined, APP_AUTH_ENABLED: '1', NEXTAUTH_URL: 'http://localhost:3000' }, () => {
    const res = middleware(req('/api/stripe/checkout', { 'x-doya-app': '1', authorization: `Bearer ${T}`, cookie: 'a=b', 'user-agent': UA_APP }))
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('x-middleware-request-cookie'), `a=b; next-auth.session-token=${T}`)
  })
})
