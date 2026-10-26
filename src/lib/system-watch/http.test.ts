import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { httpCheck, jsonBody } from './http'

const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch })
function mockFetch(make: () => Response | Promise<Response>) {
  globalThis.fetch = (async () => make()) as typeof fetch
}
const html = (body: string) => `<!DOCTYPE html><html><head><title>t</title></head><body>${body}</body></html>`

test('200 で HTML が最後まで届けば成功', async () => {
  mockFetch(() => new Response(html('ok'), { status: 200 }))
  const r = await httpCheck('https://doya-ai.surisuta.jp/banner', { page: true })
  assert.equal(r.ok, true)
  assert.equal(r.status, 200)
})

test('500 は状態コードと本文の先頭を書いて失敗', async () => {
  mockFetch(() => new Response('<h1>Internal Server Error</h1>', { status: 500 }))
  const r = await httpCheck('https://doya-ai.surisuta.jp/banner', { page: true })
  assert.equal(r.ok, false)
  assert.equal(r.status, 500)
  assert.match(r.error ?? '', /HTTP 500（期待 200）: Internal Server Error/)
})

test('200 でも画面にエラー表示が出ていれば失敗', async () => {
  mockFetch(() => new Response(html('Application error: a server-side exception has occurred'), { status: 200 }))
  const r = await httpCheck('https://doya-ai.surisuta.jp/seo', { page: true })
  assert.equal(r.ok, false)
  assert.match(r.error ?? '', /画面にエラー表示が出ています/)
})

test('HTML が途中で切れていれば失敗', async () => {
  mockFetch(() => new Response('<!DOCTYPE html><html><body>loading', { status: 200 }))
  const r = await httpCheck('https://doya-ai.surisuta.jp/seo', { page: true })
  assert.equal(r.ok, false)
  assert.match(r.error ?? '', /HTML が最後まで届いていません/)
})

test('同じサイトへの転送は成功、別のサイトへの転送は失敗', async () => {
  mockFetch(() => new Response(null, { status: 308, headers: { location: '/adimage' } }))
  assert.equal((await httpCheck('https://doya-ai.surisuta.jp/adbanner', { allowRedirect: true })).ok, true)
  mockFetch(() => new Response(null, { status: 302, headers: { location: 'https://evil.example/' } }))
  const r = await httpCheck('https://doya-ai.surisuta.jp/adbanner', { allowRedirect: true })
  assert.equal(r.ok, false)
  assert.match(r.error ?? '', /想定外のサイトへ転送/)
})

test('期待する状態コード（405 など）を指定できる', async () => {
  mockFetch(() => new Response('', { status: 405 }))
  assert.equal((await httpCheck('https://doya-ai.surisuta.jp/api/stripe/webhook', { status: 405 })).ok, true)
  mockFetch(() => new Response('{"ok":true}', { status: 200 }))
  const r = await httpCheck('https://doya-ai.surisuta.jp/api/cron/health-alert', { status: 401 })
  assert.equal(r.ok, false)
  assert.match(r.error ?? '', /HTTP 200（期待 401）/)
})

test('接続できないときはエラーの種類を書く', async () => {
  globalThis.fetch = (async () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } }) }) as typeof fetch
  const r = await httpCheck('https://doya-ai.surisuta.jp/')
  assert.equal(r.ok, false)
  assert.equal(r.status, undefined)
  assert.match(r.error ?? '', /DNS: ENOTFOUND/)
})

test('JSON の中身の確認と、読めない JSON', async () => {
  mockFetch(() => new Response('{"status":"degraded","database":"error"}', { status: 200 }))
  const bad = await httpCheck('https://doya-ai.surisuta.jp/api/health', { body: jsonBody(j => (j.status === 'ok' && j.database === 'connected') || `status=${j.status} database=${j.database}`) })
  assert.equal(bad.ok, false)
  assert.equal(bad.error, 'status=degraded database=error')
  mockFetch(() => new Response('<html>oops</html>', { status: 200 }))
  const broken = await httpCheck('https://doya-ai.surisuta.jp/api/health', { body: jsonBody(() => true) })
  assert.match(broken.error ?? '', /JSON として読めません/)
})
