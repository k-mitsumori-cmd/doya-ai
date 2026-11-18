import test from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'

// 旗オフのとき、アプリ用の認証 API はすべて 404 で、DB・メール・通信に触らない（この試験は DB に接続しない）。
const req = (method: string, path: string, body?: unknown) =>
  new NextRequest(`http://localhost:3000${path}`, { method, ...(body ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json', authorization: 'Bearer ' + 'a'.repeat(40) } } : {}) })

test('旗オフ（未設定・0・true）: 6本とも 404 { code: NOT_FOUND }', async () => {
  const before = process.env.APP_AUTH_ENABLED
  try {
    for (const flag of [undefined, '0', 'true']) {
      if (flag === undefined) delete process.env.APP_AUTH_ENABLED; else process.env.APP_AUTH_ENABLED = flag
      const mods = await Promise.all([
        import('../../app/api/app/auth/exchange/route'), import('../../app/api/app/auth/refresh/route'),
        import('../../app/api/app/auth/logout/route'), import('../../app/api/app/auth/link/send-code/route'),
        import('../../app/api/app/auth/link/confirm/route'),
      ])
      const posts = mods.map((m, i) => m.POST(req('POST', '/api/app/auth/x' + i, { a: 1 })))
      const me = await (await import('../../app/api/app/auth/me/route')).GET(req('GET', '/api/app/auth/me'))
      for (const res of [...(await Promise.all(posts)), me]) {
        assert.equal(res.status, 404)
        assert.deepEqual(await res.json(), { code: 'NOT_FOUND' })
      }
    }
  } finally {
    if (before === undefined) delete process.env.APP_AUTH_ENABLED; else process.env.APP_AUTH_ENABLED = before
  }
})

test('旗オフ: 退会 API も 404（セッションも DB も読まない）', async () => {
  const before = process.env.APP_AUTH_ENABLED
  delete process.env.APP_AUTH_ENABLED
  try {
    const { POST } = await import('../../app/api/account/delete/route')
    const res = await POST(req('POST', '/api/account/delete', { confirm: 'DELETE' }))
    assert.equal(res.status, 404)
    assert.deepEqual(await res.json(), { code: 'NOT_FOUND' })
  } finally {
    if (before !== undefined) process.env.APP_AUTH_ENABLED = before
  }
})
