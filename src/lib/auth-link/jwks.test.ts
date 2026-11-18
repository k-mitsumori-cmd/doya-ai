import test from 'node:test'
import assert from 'node:assert/strict'
import { getJwks, JWKS_URLS, JWKS_CACHE_TTL_MS, JwksUnavailableError, type JwksCache } from './jwks'

const keys = { keys: [{ kty: 'RSA', kid: 'k1', n: 'n', e: 'AQAB' }] }
const okFetch = (calls: string[], body: unknown = keys) => (async (url: string) => { calls.push(String(url)); return { ok: true, json: async () => body } }) as unknown as typeof fetch
const t0 = new Date('2026-11-18T00:00:00Z')
const at = (ms: number) => new Date(t0.getTime() + ms)

test('取得先は Apple・Google の公開の鍵の URL。10分はキャッシュを使い、過ぎたら取り直す', async () => {
  const cache: JwksCache = new Map(); const calls: string[] = []
  await getJwks('apple', { fetchImpl: okFetch(calls), now: t0, cache })
  await getJwks('apple', { fetchImpl: okFetch(calls), now: at(JWKS_CACHE_TTL_MS - 1), cache })
  assert.deepEqual(calls, [JWKS_URLS.apple])
  await getJwks('apple', { fetchImpl: okFetch(calls), now: at(JWKS_CACHE_TTL_MS), cache })
  await getJwks('google', { fetchImpl: okFetch(calls), now: t0, cache })
  assert.deepEqual(calls, [JWKS_URLS.apple, JWKS_URLS.apple, JWKS_URLS.google])
})

test('forceRefresh はキャッシュを無視する', async () => {
  const cache: JwksCache = new Map(); const calls: string[] = []
  await getJwks('google', { fetchImpl: okFetch(calls), now: t0, cache })
  await getJwks('google', { fetchImpl: okFetch(calls), now: at(1000), cache, forceRefresh: true })
  assert.equal(calls.length, 2)
})

test('取得に失敗したとき: キャッシュが無ければ JwksUnavailableError。古いキャッシュがあれば（強制でなければ）それを使う', async () => {
  const bad = (async () => { throw new Error('network') }) as unknown as typeof fetch
  await assert.rejects(getJwks('apple', { fetchImpl: bad, now: t0, cache: new Map() }), JwksUnavailableError)
  const cache: JwksCache = new Map()
  await getJwks('apple', { fetchImpl: okFetch([]), now: t0, cache })
  assert.deepEqual(await getJwks('apple', { fetchImpl: bad, now: at(JWKS_CACHE_TTL_MS + 5), cache }), keys)
  await assert.rejects(getJwks('apple', { fetchImpl: bad, now: at(JWKS_CACHE_TTL_MS + 5), cache, forceRefresh: true }), JwksUnavailableError)
})

test('応答の形が違う・ステータスが失敗のときも JwksUnavailableError', async () => {
  await assert.rejects(getJwks('apple', { fetchImpl: okFetch([], { nokeys: 1 }), now: t0, cache: new Map() }), JwksUnavailableError)
  await assert.rejects(getJwks('apple', { fetchImpl: okFetch([], { keys: [] }), now: t0, cache: new Map() }), JwksUnavailableError)
  const notOk = (async () => ({ ok: false, json: async () => keys })) as unknown as typeof fetch
  await assert.rejects(getJwks('apple', { fetchImpl: notOk, now: t0, cache: new Map() }), JwksUnavailableError)
})
