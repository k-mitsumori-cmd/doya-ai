import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'
import {
  consumeWebHandoff, createWebHandoff, devLogin, exchangeIdToken, logout, me, refreshSession, type AuthDeps,
} from './app-auth-service'
import { MemoryRepo } from './testing/memory-repo'
import { isSafeNextPath, resolveOrigin, HANDOFF_TTL_MS, WEB_SESSION_TTL_MS } from './web-handoff'
import { isDevLoginAllowed } from './dev-login'
import { sha256Hex } from './device-token'
import { deleteAccount, type DeleteRepo } from './account-delete'
import { handleDevLogin, handleWebHandoffConsume, handleWebHandoffCreate } from './web-handoff-handlers.server'

// 試験用の部品だけを使う。本物の DB・Apple・Google・メールには触れない。
let clock = new Date('2026-11-18T03:00:00Z')
let seq = 1
function makeDeps(repo = new MemoryRepo()) {
  const deps: AuthDeps = {
    repo,
    now: () => clock,
    randomBytes: (size) => { const k = seq++; return Uint8Array.from({ length: size }, (_, i) => (k * 37 + i * 11 + (k >> 3) + (k * 131) % 251) & 0xff) },
    getJwks: async () => ({ keys: [] }),
    audiences: { google: ['g'], apple: ['a'] },
    sendMail: async () => ({ success: true }),
  }
  return { deps, repo }
}

async function login(deps: AuthDeps, name?: string) {
  const r = await devLogin(deps, name ? { name } : {})
  assert.equal(r.status, 200)
  return r.body as { accessToken: string; refreshToken: string; user: { id: string } }
}
const bearer = (t: string) => `Bearer ${t}`
const createArgs = (t: string, next: unknown = '/seo', over: Record<string, unknown> = {}) => ({
  authorization: bearer(t), appHeader: '1', body: { next }, origin: 'http://localhost:3000', ...over,
})
const codeOf = (url: string) => new URL(url).searchParams.get('code') as string

// --- next の検証 ---
test('isSafeNextPath: 同じサイトのパスだけを許す', () => {
  for (const ok of ['/', '/seo', '/seo?x=1&y=2', '/banner/new#top', '/a/b/c']) assert.equal(isSafeNextPath(ok), true, ok)
  const bad: unknown[] = [
    '//evil.com', '//evil.com/x', 'http://evil.com', 'https://evil.com/x', 'javascript:alert(1)', '', 'seo', '/api/x', '/api', '/api/', '/api?x=1',
    '/seo\r\nSet-Cookie: a=b', '/seo\nx', '/\t/evil.com', '/ /evil.com', '/\\evil.com', '/seo\\x', '/\u0000', '/seo\u007f', null, undefined, 1, {}, '/' + 'a'.repeat(1100),
  ]
  for (const b of bad) assert.equal(isSafeNextPath(b), false, String(b).slice(0, 30))
})

test('resolveOrigin: 固定の環境変数が先。無ければ Host。形の悪い Host は拒否', () => {
  assert.equal(resolveOrigin({ nextauthUrl: 'https://doya-ai.example', host: 'evil.com' }), 'https://doya-ai.example')
  assert.equal(resolveOrigin({ host: 'localhost:3000' }), 'http://localhost:3000')
  assert.equal(resolveOrigin({ host: '[::1]:3000' }), 'http://[::1]:3000')
  assert.equal(resolveOrigin({ host: 'app.example.com' }), 'https://app.example.com')
  assert.equal(resolveOrigin({ host: 'localhost:3000', forwardedProto: 'https' }), 'https://localhost:3000')
  for (const h of ['a.com/evil', 'a.com@evil.com', 'a b', '', null, 'a.com\r\nX: y']) assert.equal(resolveOrigin({ host: h as string | null }), null)
})

// --- 作る ---
test('web-handoff 作成: コードは60秒・DB にはハッシュだけ。平文のコードは DB に無い', async () => {
  const { deps, repo } = makeDeps()
  const t = await login(deps)
  const r = await createWebHandoff(deps, createArgs(t.accessToken, '/seo?tab=1'))
  assert.equal(r.status, 200)
  const url = new URL(r.body.url as string)
  assert.equal(url.origin + url.pathname, 'http://localhost:3000/api/app/auth/web-handoff/consume')
  assert.equal(url.searchParams.get('next'), '/seo?tab=1')
  const code = codeOf(r.body.url as string)
  assert.match(code, /^[A-Za-z0-9_-]{43}$/)
  assert.equal(r.body.expiresAt, new Date(clock.getTime() + HANDOFF_TTL_MS).toISOString())
  assert.equal(HANDOFF_TTL_MS, 60_000)
  assert.equal(repo.handoffs.length, 1)
  assert.equal(repo.handoffs[0].codeHash, sha256Hex(code))
  assert.equal(JSON.stringify(repo.handoffs).includes(code), false)
})

test('web-handoff 作成: x-doya-app が無い・Bearer が無効・next が不正・アプリ用でないセッション、は拒否', async () => {
  const { deps, repo } = makeDeps()
  const t = await login(deps)
  assert.equal((await createWebHandoff(deps, createArgs(t.accessToken, '/seo', { appHeader: null }))).status, 401)
  assert.equal((await createWebHandoff(deps, createArgs(t.accessToken, '/seo', { appHeader: '0' }))).status, 401)
  assert.equal((await createWebHandoff(deps, createArgs('x'.repeat(43)))).status, 401)
  assert.equal((await createWebHandoff(deps, { ...createArgs(t.accessToken), authorization: null })).status, 401)
  for (const n of ['//evil.com', '/api/x', '/a\r\nb', 'http://x.com', '', null]) {
    assert.equal((await createWebHandoff(deps, createArgs(t.accessToken, n))).status, 400, String(n))
  }
  assert.equal((await createWebHandoff(deps, { ...createArgs(t.accessToken), body: null })).status, 400)
  assert.equal(repo.handoffs.length, 0)
  // 端末に結び付かない通常のセッション（Web のログイン）では引き渡せない
  repo.sessions.push({ id: 'web-1', sessionToken: 'w'.repeat(43), userId: t.user.id, expires: new Date(clock.getTime() + 3600_000) })
  assert.equal((await createWebHandoff(deps, createArgs('w'.repeat(43)))).status, 401)
})

// --- 消費 ---
test('web-handoff 消費: 1回だけ使える。Web のセッションは24時間で、AppDevice には結び付かない', async () => {
  const { deps, repo } = makeDeps()
  const t = await login(deps)
  const r = await createWebHandoff(deps, createArgs(t.accessToken, '/lp'))
  const code = codeOf(r.body.url as string)
  const devicesBefore = repo.devices.length
  const sessionsBefore = repo.sessions.length
  const c1 = await consumeWebHandoff(deps, code)
  assert.equal(c1.ok, true)
  if (!c1.ok) return
  assert.equal(c1.nextPath, '/lp')
  assert.equal(c1.expires.getTime(), clock.getTime() + WEB_SESSION_TTL_MS)
  assert.equal(repo.sessions.length, sessionsBefore + 1)
  assert.equal(repo.devices.length, devicesBefore)
  const s = repo.sessions.find((x) => x.sessionToken === c1.sessionToken)!
  assert.equal(s.userId, t.user.id)
  assert.equal(repo.devices.some((d) => d.sessionId === s.id), false)
  // 2回目は使えない
  assert.deepEqual(await consumeWebHandoff(deps, code), { ok: false })
  assert.equal(repo.sessions.length, sessionsBefore + 1)
})

test('web-handoff 消費: 60秒を過ぎると使えない。ちょうど60秒も使えない', async () => {
  const { deps } = makeDeps()
  const t = await login(deps)
  const code = codeOf((await createWebHandoff(deps, createArgs(t.accessToken))).body.url as string)
  const start = clock
  clock = new Date(start.getTime() + HANDOFF_TTL_MS)
  try { assert.deepEqual(await consumeWebHandoff(deps, code), { ok: false }) } finally { clock = start }
  const code2 = codeOf((await createWebHandoff(deps, createArgs(t.accessToken))).body.url as string)
  clock = new Date(start.getTime() + HANDOFF_TTL_MS - 1)
  try { assert.equal((await consumeWebHandoff(deps, code2)).ok, true) } finally { clock = start }
})

test('web-handoff 消費: 同時に多数が来ても、成功は1回だけ（Session も1つだけ）', async () => {
  const { deps, repo } = makeDeps()
  const t = await login(deps)
  const code = codeOf((await createWebHandoff(deps, createArgs(t.accessToken))).body.url as string)
  const before = repo.sessions.length
  const rs = await Promise.all(Array.from({ length: 60 }, () => consumeWebHandoff(deps, code)))
  assert.equal(rs.filter((r) => r.ok).length, 1)
  assert.equal(repo.sessions.length, before + 1)
})

test('web-handoff 消費: 不正なコード・他人のコードの取り違えは使えず、作られる Session はコードの持ち主のもの', async () => {
  const { deps, repo } = makeDeps()
  const a = await login(deps, 'Aさん')
  const b = await login(deps, 'Bさん')
  const codeA = codeOf((await createWebHandoff(deps, createArgs(a.accessToken))).body.url as string)
  const before = repo.sessions.length
  for (const bad of [undefined, null, '', 'short', 'a'.repeat(43), codeA.slice(0, -1) + (codeA.endsWith('A') ? 'B' : 'A'), codeA + 'x', b.accessToken, b.refreshToken, `${codeA};x=1`]) {
    assert.deepEqual(await consumeWebHandoff(deps, bad), { ok: false }, String(bad))
  }
  assert.equal(repo.sessions.length, before)
  const ok = await consumeWebHandoff(deps, codeA)
  assert.equal(ok.ok, true)
  if (!ok.ok) return
  assert.equal(repo.sessions.find((s) => s.sessionToken === ok.sessionToken)!.userId, a.user.id)
  assert.notEqual(a.user.id, b.user.id)
})

test('web-handoff 消費: ログアウトのあと・退会のあとは、未使用のコードも使えない', async () => {
  const { deps, repo } = makeDeps()
  const t = await login(deps)
  const code = codeOf((await createWebHandoff(deps, createArgs(t.accessToken))).body.url as string)
  assert.equal((await logout(deps, bearer(t.accessToken))).status, 200)
  assert.deepEqual(await consumeWebHandoff(deps, code), { ok: false })
  // 退会
  const t2 = await login(deps)
  const code2 = codeOf((await createWebHandoff(deps, createArgs(t2.accessToken))).body.url as string)
  repo.users.get(t2.user.id)!.deletedAt = clock
  assert.deepEqual(await consumeWebHandoff(deps, code2), { ok: false })
})

// --- 失効 ---
test('logout: その端末から引き渡した Web のセッションも消える。ほかの端末・通常の Web のセッションは残る', async () => {
  const { deps, repo } = makeDeps()
  const t = await login(deps, 'C')
  const other = await login(deps, 'C') // 同じ人の別の端末
  const webLogin = 'w'.repeat(43)
  repo.sessions.push({ id: 'web-login', sessionToken: webLogin, userId: t.user.id, expires: new Date(clock.getTime() + 3600_000) })
  const mk = async (tok: string) => {
    const c = await consumeWebHandoff(deps, codeOf((await createWebHandoff(deps, createArgs(tok))).body.url as string))
    assert.equal(c.ok, true)
    return (c as { sessionToken: string }).sessionToken
  }
  const w1 = await mk(t.accessToken)
  const w2 = await mk(other.accessToken)
  assert.equal(await repo.findSession(w1) !== null, true)
  assert.equal((await logout(deps, bearer(t.accessToken))).status, 200)
  assert.equal(await repo.findSession(w1), null)
  assert.notEqual(await repo.findSession(w2), null)
  assert.notEqual(await repo.findSession(webLogin), null)
  assert.equal(await me(deps, bearer(t.accessToken)).then((r) => r.status), 401)
})

test('refresh: 更新しても Web のセッションは残り、古いトークンの再利用で系統を失効すると消える', async () => {
  const { deps, repo } = makeDeps()
  const t = await login(deps)
  const c = await consumeWebHandoff(deps, codeOf((await createWebHandoff(deps, createArgs(t.accessToken))).body.url as string))
  assert.equal(c.ok, true)
  if (!c.ok) return
  const r1 = await refreshSession(deps, { refreshToken: t.refreshToken })
  assert.equal(r1.status, 200)
  assert.notEqual(await repo.findSession(c.sessionToken), null)
  // 更新のあとでも、新しい Bearer から引き渡して、あとで失効すれば消える
  const newAccess = r1.body.accessToken as string
  const c2 = await consumeWebHandoff(deps, codeOf((await createWebHandoff(deps, createArgs(newAccess))).body.url as string))
  assert.equal(c2.ok, true)
  // 古いリフレッシュトークンを、猶予（10秒）を過ぎてから再利用する
  const start = clock
  clock = new Date(start.getTime() + 30_000)
  try {
    const reuse = await refreshSession(deps, { refreshToken: t.refreshToken })
    assert.equal(reuse.status, 401)
    assert.equal(reuse.body.reason, 'reused')
  } finally { clock = start }
  assert.equal(await repo.findSession(c.sessionToken), null)
  assert.equal(c2.ok && (await repo.findSession(c2.sessionToken)), null)
})

test('退会: ユーザーの全 Session と端末が消えるので、引き渡した Web のセッションも消える（既存の動き）', async () => {
  const { deps, repo } = makeDeps()
  const t = await login(deps)
  const c = await consumeWebHandoff(deps, codeOf((await createWebHandoff(deps, createArgs(t.accessToken))).body.url as string))
  assert.equal(c.ok, true)
  if (!c.ok) return
  // 退会の repo のメモリ版（account-delete.server.ts の anonymize と同じ範囲: そのユーザーの Session・AppDevice を消す）
  const delRepo: DeleteRepo = {
    getDeletionFacts: async (id) => ({ user: { id, plan: 'FREE', deletedAt: null, stripeSubscriptionId: null }, liveSubscriptions: 0, nagusameLive: false, ownsCompanyWithOtherMembers: false }),
    anonymize: async (id) => {
      repo.sessions = repo.sessions.filter((s) => s.userId !== id)
      repo.devices = repo.devices.filter((d) => d.userId !== id)
      repo.handoffs = repo.handoffs.filter((h) => h.userId !== id)
    },
  }
  assert.equal((await deleteAccount(delRepo, { userId: t.user.id, confirm: 'DELETE', now: clock })).status, 200)
  assert.equal(await repo.findSession(c.sessionToken), null)
  // 本物の account-delete.server.ts が、全 Session を消す1行を持つこと
  const src = fs.readFileSync(path.join(__dirname, 'account-delete.server.ts'), 'utf8')
  assert.match(src, /tx\.session\.deleteMany\(\{ where: \{ userId \} \}\)/)
  assert.match(src, /tx\.appDevice\.deleteMany\(\{ where: \{ userId \} \}\)/)
})

// --- route（ハンドラ）。旗・Cookie・リダイレクト ---
const ENV_KEYS = ['APP_AUTH_ENABLED', 'APP_DEV_LOGIN', 'NODE_ENV', 'VERCEL', 'NEXTAUTH_URL'] as const
async function withEnv(env: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>, fn: () => Promise<void>) {
  const saved: Record<string, string | undefined> = {}
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k] }
  for (const [k, v] of Object.entries(env)) if (v !== undefined) (process.env as Record<string, string | undefined>)[k] = v
  try { await fn() } finally { for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else (process.env as Record<string, string | undefined>)[k] = saved[k] } }
}
const rq = (method: string, url: string, headers: Record<string, string> = {}, body?: unknown) =>
  new NextRequest(url, { method, headers: { host: new URL(url).host, ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) })

test('旗オフ: web-handoff（2本）と dev-login は 404', async () => {
  const { deps } = makeDeps()
  const mk = () => deps
  await withEnv({ APP_DEV_LOGIN: '1' }, async () => {
    const r1 = await handleWebHandoffCreate(rq('POST', 'http://localhost:3000/api/app/auth/web-handoff', { 'x-doya-app': '1', authorization: bearer('a'.repeat(43)) }, { next: '/seo' }), mk)
    const r2 = await handleWebHandoffConsume(rq('GET', 'http://localhost:3000/api/app/auth/web-handoff/consume?code=' + 'a'.repeat(43) + '&next=/seo'), mk)
    const r3 = await handleDevLogin(rq('POST', 'http://localhost:3000/api/app/auth/dev-login', {}, { name: 'x' }), mk)
    for (const r of [r1, r2, r3]) { assert.equal(r.status, 404); assert.deepEqual(await r.json(), { code: 'NOT_FOUND' }) }
  })
})

test('通し: dev-login → web-handoff → consume で 302 と Cookie（HttpOnly・SameSite=Lax・Path=/）。使い回しは HandoffInvalid へ', async () => {
  const { deps, repo } = makeDeps()
  const mk = () => deps
  await withEnv({ APP_AUTH_ENABLED: '1', APP_DEV_LOGIN: '1', NEXTAUTH_URL: 'http://localhost:3000' }, async () => {
    const dl = await handleDevLogin(rq('POST', 'http://localhost:3000/api/app/auth/dev-login', {}, { name: 'テスト太郎' }), mk)
    assert.equal(dl.status, 200)
    const tok = await dl.json()
    const hr = await handleWebHandoffCreate(rq('POST', 'http://localhost:3000/api/app/auth/web-handoff', { 'x-doya-app': '1', authorization: bearer(tok.accessToken) }, { next: '/seo?a=1' }), mk)
    assert.equal(hr.status, 200)
    const { url } = await hr.json()
    assert.equal(new URL(url).origin, 'http://localhost:3000')
    const c1 = await handleWebHandoffConsume(rq('GET', url), mk)
    assert.equal(c1.status, 302)
    assert.equal(c1.headers.get('location'), 'http://localhost:3000/seo?a=1')
    assert.equal(c1.headers.get('cache-control'), 'no-store')
    assert.equal(c1.headers.get('referrer-policy'), 'no-referrer')
    const sc = c1.headers.get('set-cookie') ?? ''
    assert.match(sc, /^next-auth\.session-token=[A-Za-z0-9_-]{43};/)
    assert.match(sc, /HttpOnly/i)
    assert.match(sc, /SameSite=lax/i)
    assert.match(sc, /Path=\//)
    assert.doesNotMatch(sc, /Secure/i)
    assert.match(sc, /Expires=/i)
    // 作った Session は24時間。アプリ用の端末には結び付かない
    const value = /session-token=([^;]+)/.exec(sc)![1]
    const sess = await repo.findSession(value)
    assert.equal(sess!.expires.getTime(), clock.getTime() + WEB_SESSION_TTL_MS)
    // 2回目は、理由を出さずにサインインへ
    const c2 = await handleWebHandoffConsume(rq('GET', url), mk)
    assert.equal(c2.status, 302)
    assert.equal(c2.headers.get('location'), 'http://localhost:3000/auth/signin?error=HandoffInvalid')
    assert.equal(c2.headers.get('set-cookie'), null)
    assert.equal(c2.headers.get('referrer-policy'), 'no-referrer')
  })
})

test('consume: URL の next を書き換えても、DB に控えた next へ行く。https なら Secure と __Secure- の名前', async () => {
  const { deps } = makeDeps()
  const mk = () => deps
  await withEnv({ APP_AUTH_ENABLED: '1', APP_DEV_LOGIN: '1', NEXTAUTH_URL: 'https://doya.example' }, async () => {
    const t = await login(deps)
    const { url } = (await createWebHandoff(deps, { ...createArgs(t.accessToken, '/banner'), origin: 'https://doya.example' })).body as { url: string }
    const tampered = new URL(url)
    tampered.searchParams.set('next', '//evil.com')
    const res = await handleWebHandoffConsume(rq('GET', tampered.toString().replace('http://', 'https://')), mk)
    assert.equal(res.status, 302)
    assert.equal(res.headers.get('location'), 'https://doya.example/banner')
    const sc = res.headers.get('set-cookie') ?? ''
    assert.match(sc, /^__Secure-next-auth\.session-token=/)
    assert.match(sc, /Secure/)
    assert.match(sc, /HttpOnly/i)
  })
})

// --- dev-login ---
test('dev-login: 5条件がそろったときだけ 200。1つでも欠ければ 404', async () => {
  const good = { APP_AUTH_ENABLED: '1', APP_DEV_LOGIN: '1', NODE_ENV: 'development' }
  const call = async (env: Parameters<typeof withEnv>[0], host: string) => {
    const { deps, repo } = makeDeps()
    let res!: Response
    await withEnv(env, async () => { res = await handleDevLogin(rq('POST', `http://${host}/api/app/auth/dev-login`, {}, { name: 'x' }), () => deps) })
    return { res, repo }
  }
  const ok = await call(good, 'localhost:3000')
  assert.equal(ok.res.status, 200)
  const cases: Array<[string, Parameters<typeof withEnv>[0], string]> = [
    ['NODE_ENV=production', { ...good, NODE_ENV: 'production' }, 'localhost:3000'],
    ['VERCEL 設定あり', { ...good, VERCEL: '1' }, 'localhost:3000'],
    ['APP_DEV_LOGIN なし', { APP_AUTH_ENABLED: '1', NODE_ENV: 'development' }, 'localhost:3000'],
    ['APP_DEV_LOGIN=0', { ...good, APP_DEV_LOGIN: '0' }, 'localhost:3000'],
    ['APP_DEV_LOGIN=true', { ...good, APP_DEV_LOGIN: 'true' }, 'localhost:3000'],
    ['旗オフ', { APP_DEV_LOGIN: '1', NODE_ENV: 'development' }, 'localhost:3000'],
    ['Host=example.com', good, 'example.com'],
    ['Host=192.168.1.5', good, '192.168.1.5:3000'],
    ['Host=localhost.evil.com', good, 'localhost.evil.com'],
    ['Host=10.0.0.1', good, '10.0.0.1'],
  ]
  for (const [label, env, host] of cases) {
    const { res, repo } = await call(env, host)
    assert.equal(res.status, 404, label)
    assert.deepEqual(await res.json(), { code: 'NOT_FOUND' }, label)
    assert.equal(repo.users.size, 0, label + ': ユーザーを作らない')
  }
  // 条件を許すホスト
  for (const host of ['localhost', 'localhost:3000', '127.0.0.1:3000', '[::1]:3000', 'LOCALHOST:3000']) {
    assert.equal(isDevLoginAllowed({ ...good }, host), true, host)
  }
  assert.equal(isDevLoginAllowed({ ...good }, null), false)
  assert.equal(isDevLoginAllowed({ ...good, NODE_ENV: undefined }, 'localhost'), true)
})

test('dev-login: 返すのは exchange と同じ形。メールは返さず、そのトークンで me・refresh・logout が本物と同じ経路で動く', async () => {
  const { deps, repo } = makeDeps()
  const r = await devLogin(deps, { name: 'テスト花子', deviceLabel: 'Simulator', platform: 'android' })
  assert.equal(r.status, 200)
  assert.deepEqual(Object.keys(r.body).sort(), ['accessExpiresAt', 'accessToken', 'refreshExpiresAt', 'refreshToken', 'user'])
  assert.equal(JSON.stringify(r.body).includes('@'), false)
  const u = repo.users.get((r.body.user as { id: string }).id)!
  assert.match(u.email!, /^dev-[0-9a-f]{16}@dev\.invalid$/)
  assert.equal(u.emailNormalized, u.email)
  assert.equal(repo.accounts[0].provider, 'dev')
  assert.equal(repo.accounts[0].providerAccountId, `dev-${u.email!.slice(4, 20)}`)
  assert.equal(repo.devices[0].platform, 'android')
  assert.equal((await me(deps, bearer(r.body.accessToken as string))).status, 200)
  const rf = await refreshSession(deps, { refreshToken: r.body.refreshToken as string })
  assert.equal(rf.status, 200)
  assert.equal((await logout(deps, bearer(rf.body.accessToken as string))).status, 200)
  assert.equal((await me(deps, bearer(rf.body.accessToken as string))).status, 401)
  assert.equal((await me(deps, bearer(r.body.accessToken as string))).status, 401)
})

test('dev-login: name 指定は同じ人。指定なしは毎回新しい人。不正な本文は 400', async () => {
  const { deps, repo } = makeDeps()
  const a1 = await devLogin(deps, { name: 'Same' })
  const a2 = await devLogin(deps, { name: 'Same' })
  assert.equal((a1.body.user as { id: string }).id, (a2.body.user as { id: string }).id)
  const b1 = await devLogin(deps, {})
  const b2 = await devLogin(deps, null)
  assert.notEqual((b1.body.user as { id: string }).id, (b2.body.user as { id: string }).id)
  assert.equal(repo.users.size, 3)
  assert.equal((await devLogin(deps, { platform: 'web' })).status, 400)
  assert.equal((await devLogin(deps, [1])).status, 400)
  // 退会した人の name で、もう一度入れる（古い行は匿名化済みで、Account も無い）
  const uid = (a1.body.user as { id: string }).id
  repo.accounts = repo.accounts.filter((x) => x.userId !== uid)
  repo.users.get(uid)!.deletedAt = clock
  repo.users.get(uid)!.email = `deleted-${uid}@deleted.invalid`
  const a3 = await devLogin(deps, { name: 'Same' })
  assert.equal(a3.status, 200)
  assert.notEqual((a3.body.user as { id: string }).id, uid)
})

// --- 本番に入らないこと（'dev' の提供元を、本物の経路は受け付けない） ---
test("本物の exchange に provider: 'dev' を送っても拒否される（id_token の検証にも進まない）", async () => {
  const { deps, repo } = makeDeps()
  for (const provider of ['dev', 'DEV', 'Dev', 'dev ']) {
    const r = await exchangeIdToken(deps, { provider, idToken: 'x.y.z', nonce: 'nonce-abcdefgh', platform: 'ios' })
    assert.equal(r.status, 400)
    assert.deepEqual(r.body, { code: 'INVALID_REQUEST' })
  }
  assert.equal(repo.users.size, 0)
})

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}

test("ソース: 'dev' の提供元を許すのは dev-login.ts・開発用ログインの service・route だけ。id-token・link-decision・Web の認証は受け付けない", () => {
  const authLink = __dirname
  for (const f of ['id-token.ts', 'link-decision.ts', 'apple-web-provider.ts', 'jwks.ts', 'email-normalize.ts', 'device-token.ts']) {
    const src = fs.readFileSync(path.join(authLink, f), 'utf8')
    assert.doesNotMatch(src, /DEV_PROVIDER|dev-login|['"`]dev['"`]/, f)
  }
  const authTs = fs.readFileSync(path.join(authLink, '..', 'auth.ts'), 'utf8')
  assert.doesNotMatch(authTs, /DEV_PROVIDER|dev-login|APP_DEV_LOGIN|['"`]dev['"`]/)
  // DEV_PROVIDER を import している所は、service（devLogin）と dev-login.ts だけ
  const srcRoot = path.join(authLink, '..', '..')
  const users = walk(srcRoot).filter((f) => !f.endsWith('.test.ts') && /DEV_PROVIDER|isDevLoginAllowed|APP_DEV_LOGIN/.test(fs.readFileSync(f, 'utf8')))
  const rel = users.map((f) => path.relative(srcRoot, f)).sort()
  assert.deepEqual(rel, [
    'app/api/app/auth/dev-login/route.ts',
    'lib/auth-link/app-auth-service.ts',
    'lib/auth-link/dev-login.ts',
    'lib/auth-link/web-handoff-handlers.server.ts',
  ].sort())
  // dev-login の route は、ハンドラ経由で5条件を確かめる
  const route = fs.readFileSync(path.join(srcRoot, 'app/api/app/auth/dev-login/route.ts'), 'utf8')
  assert.match(route, /handleDevLogin/)
  const handlers = fs.readFileSync(path.join(authLink, 'web-handoff-handlers.server.ts'), 'utf8')
  assert.match(handlers, /isDevLoginAllowed\(process\.env, req\.headers\.get\('host'\)\)/)
  // 5条件のうち NODE_ENV と VERCEL を見ていること
  const gate = fs.readFileSync(path.join(authLink, 'dev-login.ts'), 'utf8')
  assert.match(gate, /NODE_ENV === 'production'/)
  assert.match(gate, /env\.VERCEL/)
  assert.match(gate, /APP_DEV_LOGIN !== '1'/)
})

test('middleware: web-handoff と dev-login は /api/app/auth/ の下なので、Bearer の置き換えの対象外', async () => {
  const { isAppAuthRoute } = await import('./bearer-cookie')
  for (const p of ['/api/app/auth/web-handoff', '/api/app/auth/web-handoff/consume', '/api/app/auth/dev-login']) assert.equal(isAppAuthRoute(p), true, p)
})
