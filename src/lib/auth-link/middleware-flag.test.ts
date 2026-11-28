import test from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { middleware } from '../../middleware'

const T = 'b'.repeat(43)
const APP = { 'x-doya-app': '1' }
const req = (headers: Record<string, string>, path = '/api/some/route') => new NextRequest(`http://localhost:3000${path}`, { headers })
const withEnv = async (flag: string | undefined, fn: () => void | Promise<void>) => {
  const before = { f: process.env.APP_AUTH_ENABLED, u: process.env.NEXTAUTH_URL }
  if (flag === undefined) delete process.env.APP_AUTH_ENABLED; else process.env.APP_AUTH_ENABLED = flag
  process.env.NEXTAUTH_URL = 'http://localhost:3000'
  try { await fn() } finally {
    if (before.f === undefined) delete process.env.APP_AUTH_ENABLED; else process.env.APP_AUTH_ENABLED = before.f
    if (before.u === undefined) delete process.env.NEXTAUTH_URL; else process.env.NEXTAUTH_URL = before.u
  }
}

test('旗オフ（未設定・0・空）: Bearer があっても何も変えない（ヘッダーの置き換えも 401 も無い）', async () => {
  for (const flag of [undefined, '0', '', 'true']) {
    await withEnv(flag, () => {
      const res = middleware(req({ ...APP, authorization: `Bearer ${T}`, cookie: 'a=b' }))
      assert.equal(res.status, 200)
      assert.equal(res.headers.get('x-middleware-override-headers'), null)
      assert.equal(res.headers.get('x-middleware-request-cookie'), null)
      // 不正な Bearer でも 401 にしない
      const bad = middleware(req({ ...APP, authorization: 'Bearer bad;x=1' }))
      assert.equal(bad.status, 200)
    })
  }
})

test('旗オン: /api/ の Bearer を Cookie に置き換え、authorization を外す', async () => {
  await withEnv('1', () => {
    const res = middleware(req({ ...APP, authorization: `Bearer ${T}`, cookie: 'a=b; next-auth.session-token=OLD' }))
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('x-middleware-request-cookie'), `a=b; next-auth.session-token=${T}`)
    assert.match(res.headers.get('x-middleware-override-headers') ?? '', /cookie/)
    // x-doya-app は下流に漏らさない（上書きの対象のヘッダー一覧に authorization と一緒に、残るヘッダーだけが入る）
    assert.equal((res.headers.get('x-middleware-override-headers') ?? '').split(',').includes('x-doya-app'), false)
    assert.equal(res.headers.get('x-middleware-request-x-doya-app'), null)
  })
})

test('旗オン: 不正な Bearer は 401。/api/ 以外・アプリ用の認証 API・Bearer なしは触らない', async () => {
  await withEnv('1', async () => {
    const bad = middleware(req({ ...APP, authorization: 'Bearer short' }))
    assert.equal(bad.status, 401)
    assert.deepEqual(await bad.json(), { code: 'INVALID_TOKEN' })
    for (const [path, h] of [
      ['/pricing', { ...APP, authorization: `Bearer ${T}` }],
      ['/api/app/auth/refresh', { ...APP, authorization: `Bearer ${T}` }],
      ['/api/cron/daily-summary', { ...APP, authorization: `Bearer ${T}` }],
      ['/api/stripe/webhook', { ...APP, authorization: `Bearer ${T}` }],
      ['/api/admin/users', { ...APP, authorization: `Bearer ${T}` }],
      ['/api/x', { cookie: 'a=b' }],
    ] as const) {
      const res = middleware(req({ ...h }, path))
      assert.equal(res.status, 200, path)
      assert.equal(res.headers.get('x-middleware-request-cookie'), null, path)
    }
  })
})

test('旗オン: x-doya-app が無い Bearer（CRON_SECRET 形・JWT 形・不正な形）は、何も変えず、401 にもならない', async () => {
  await withEnv('1', () => {
    for (const token of ['c'.repeat(40), 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghijklmnop', 'short;x=1']) {
      for (const path of ['/api/cron/daily-summary', '/api/seo/x']) {
        const res = middleware(req({ authorization: `Bearer ${token}`, cookie: 'a=b' }, path))
        assert.equal(res.status, 200, `${path} ${token}`)
        assert.equal(res.headers.get('x-middleware-override-headers'), null)
        assert.equal(res.headers.get('x-middleware-request-cookie'), null)
      }
    }
  })
})
