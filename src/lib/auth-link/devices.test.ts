import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { NextRequest } from 'next/server'
import { devLogin, refreshSession, type AuthDeps } from './app-auth-service'
import { MemoryRepo } from './testing/memory-repo'
import { listDevices, revokeDevice, setPushToken } from './devices'
import { isValidExpoPushToken } from './push-token'
import { handleDeviceRevoke, handleDevicesList, handlePushToken } from './devices-handlers.server'

// 試験用の部品だけを使う。本物の DB・メール・通信には触れない。
let clock = new Date('2026-11-18T03:00:00Z')
function makeDeps(repo = new MemoryRepo()) {
  const deps: AuthDeps = {
    repo,
    now: () => clock,
    // 試験用の乱数（本物の通信ではない。別の呼び出しで同じトークンが出ないように、crypto の乱数を使う）
    randomBytes: (size) => new Uint8Array(randomBytes(size)),
    getJwks: async () => ({ keys: [] }),
    audiences: { google: ['g'], apple: ['a'] },
    sendMail: async () => ({ success: true }),
  }
  return { deps, repo }
}
async function login(deps: AuthDeps, name: string) {
  const r = await devLogin(deps, { name })
  assert.equal(r.status, 200)
  return r.body as { accessToken: string; refreshToken: string; user: { id: string } }
}
const bearer = (t: string) => `Bearer ${t}`
const TOKEN = 'ExponentPushToken[abcdEFGH1234-_xyz]'

test('一覧: 自分の端末だけ。他人の端末は出ない。いまの端末に isCurrent が付く', async () => {
  const { deps } = makeDeps()
  const a1 = await login(deps, 'A')
  const a2 = await login(deps, 'A')
  const b = await login(deps, 'B')
  const r = await listDevices(deps, { authorization: bearer(a1.accessToken) })
  assert.equal(r.status, 200)
  const list = r.body.devices as Array<Record<string, unknown>>
  assert.equal(list.length, 2)
  assert.equal(list.filter((d) => d.isCurrent).length, 1)
  const rb = await listDevices(deps, { authorization: bearer(b.accessToken) })
  assert.equal((rb.body.devices as unknown[]).length, 1)
  assert.notEqual(a2.user.id, b.user.id)
})

test('一覧: 秘密の値を含まない（ハッシュ・トークン・メール・sessionId・userId）', async () => {
  const { deps, repo } = makeDeps()
  const a = await login(deps, 'A')
  repo.devices[0].pushToken = TOKEN
  const r = await listDevices(deps, { authorization: bearer(a.accessToken) })
  const text = JSON.stringify(r.body)
  assert.deepEqual(Object.keys((r.body.devices as Array<Record<string, unknown>>)[0]).sort(), ['createdAt', 'deviceLabel', 'id', 'isCurrent', 'lastUsedAt', 'platform'])
  for (const secret of [repo.devices[0].refreshTokenHash, a.refreshToken, a.accessToken, TOKEN, repo.devices[0].sessionId as string, a.user.id, 'refreshTokenHash', 'pushToken', 'email']) {
    assert.equal(text.includes(secret), false, secret)
  }
})

test('一覧: 失効した端末・期限切れの端末・替え済みの行は出ない。トークンを替えても1件のまま', async () => {
  const { deps, repo } = makeDeps()
  const a = await login(deps, 'A')
  const second = await login(deps, 'A')
  // 替え（ローテーション）のあとも、1つの端末は1行
  const rot = await refreshSession(deps, { refreshToken: a.refreshToken })
  assert.equal(rot.status, 200)
  const newAccess = rot.body.accessToken as string
  let list = (await listDevices(deps, { authorization: bearer(newAccess) })).body.devices as Array<{ id: string }>
  assert.equal(list.length, 2)
  // 失効
  const dev2 = repo.devices.find((d) => d.sessionId === repo.sessions.find((s) => s.sessionToken === second.accessToken)?.id)!
  await repo.revokeFamily(dev2.familyId, clock)
  list = (await listDevices(deps, { authorization: bearer(newAccess) })).body.devices as Array<{ id: string }>
  assert.equal(list.length, 1)
  // 期限切れ
  repo.devices.find((d) => d.userId === a.user.id && !d.rotatedAt && !d.revokedAt)!.expiresAt = new Date(clock.getTime() - 1)
  list = (await listDevices(deps, { authorization: bearer(newAccess) })).body.devices as Array<{ id: string }>
  assert.equal(list.length, 0)
})

test('一覧: Authorization も Cookie も無い・不正な Bearer は 401。Cookie のユーザーでも見える（isCurrent は全部 false）', async () => {
  const { deps } = makeDeps()
  const a = await login(deps, 'A')
  assert.equal((await listDevices(deps, { authorization: null })).status, 401)
  assert.equal((await listDevices(deps, { authorization: 'Bearer short' })).status, 401)
  // Bearer が不正なら、Cookie に切り替えない
  assert.equal((await listDevices(deps, { authorization: 'Bearer short', cookieUserId: a.user.id })).status, 401)
  const r = await listDevices(deps, { authorization: null, cookieUserId: a.user.id })
  assert.equal(r.status, 200)
  assert.deepEqual((r.body.devices as Array<{ isCurrent: boolean }>).map((d) => d.isCurrent), [false])
})

test('失効: 他人の id は 404（存在しない id と同じ形）。自分の端末は消え、対の Session と引き渡した Web のセッションも消える', async () => {
  const { deps, repo } = makeDeps()
  const a = await login(deps, 'A')
  const a2 = await login(deps, 'A')
  const b = await login(deps, 'B')
  const bDevice = repo.devices.find((d) => d.userId === b.user.id)!
  const aDevices = repo.devices.filter((d) => d.userId === a.user.id)
  const target = aDevices[1]
  // 他人（B）から A の端末は消せない。存在しない id と同じ応答
  const other = await revokeDevice(deps, { authorization: bearer(b.accessToken) }, target.id)
  const none = await revokeDevice(deps, { authorization: bearer(b.accessToken) }, 'no-such-id')
  assert.deepEqual(other, none)
  assert.equal(other.status, 404)
  assert.equal(repo.devices.find((d) => d.id === target.id)!.revokedAt, null)
  assert.ok(repo.sessions.some((s) => s.id === target.sessionId))
  // 形の悪い id も 404
  assert.equal((await revokeDevice(deps, { authorization: bearer(a.accessToken) }, '../x')).status, 404)

  // 引き渡した Web のセッションを作っておく
  const webSid = repo.nextId('sess-')
  repo.sessions.push({ id: webSid, sessionToken: 'w'.repeat(40), userId: a.user.id, expires: new Date(clock.getTime() + 3600_000) })
  repo.handoffs.push({ id: 'h1', codeHash: 'c', challengeHash: 'x', userId: a.user.id, deviceId: target.id, nextPath: '/', expiresAt: clock, consumedAt: clock, webSessionId: webSid })

  const r = await revokeDevice(deps, { authorization: bearer(a.accessToken) }, target.id)
  assert.equal(r.status, 200)
  assert.equal(r.body.loggedOutCurrent, false)
  assert.ok(repo.devices.find((d) => d.id === target.id)!.revokedAt)
  assert.equal(repo.sessions.some((s) => s.id === target.sessionId), false, '対の Session が消える')
  assert.equal(repo.sessions.some((s) => s.id === webSid), false, '引き渡した Web のセッションが消える')
  // 失効した端末のアクセストークンは使えない
  assert.equal((await listDevices(deps, { authorization: bearer(a2.accessToken) })).status, 401)
  // 他の端末（自分の最初の端末・B の端末）は残る
  assert.equal((await listDevices(deps, { authorization: bearer(a.accessToken) })).status, 200)
  assert.equal(repo.devices.find((d) => d.id === bDevice.id)!.revokedAt, null)
  // もう一度は 404（失効済み）
  assert.equal((await revokeDevice(deps, { authorization: bearer(a.accessToken) }, target.id)).status, 404)
})

test('失効: いまの端末を消すとログアウトと同じ（loggedOutCurrent: true。トークンは以後 401）', async () => {
  const { deps, repo } = makeDeps()
  const a = await login(deps, 'A')
  const mine = repo.devices.find((d) => d.userId === a.user.id)!
  const r = await revokeDevice(deps, { authorization: bearer(a.accessToken) }, mine.id)
  assert.equal(r.status, 200)
  assert.equal(r.body.loggedOutCurrent, true)
  assert.equal((await listDevices(deps, { authorization: bearer(a.accessToken) })).status, 401)
  assert.equal((await refreshSession(deps, { refreshToken: a.refreshToken })).status === 200, false)
})

test('失効: Web の Cookie のセッションからも、自分の端末を消せる', async () => {
  const { deps, repo } = makeDeps()
  const a = await login(deps, 'A')
  const mine = repo.devices.find((d) => d.userId === a.user.id)!
  const r = await revokeDevice(deps, { authorization: null, cookieUserId: a.user.id }, mine.id)
  assert.equal(r.status, 200)
  assert.equal(r.body.loggedOutCurrent, false)
  assert.equal(repo.sessions.length, 0)
})

test('退会済みのユーザーは、Bearer でも Cookie でも一覧・失効できない', async () => {
  const { deps, repo } = makeDeps()
  const a = await login(deps, 'A')
  repo.users.get(a.user.id)!.deletedAt = clock
  assert.equal((await listDevices(deps, { authorization: bearer(a.accessToken) })).status, 401)
  assert.equal((await listDevices(deps, { authorization: null, cookieUserId: a.user.id })).status, 401)
})

// --- プッシュトークン ---
test('isValidExpoPushToken: Expo の形だけを許す', () => {
  for (const ok of [TOKEN, 'ExpoPushToken[abcdefgh12345678]']) assert.equal(isValidExpoPushToken(ok), true, ok)
  for (const bad of ['', 'abc', 'ExponentPushToken[]', 'ExponentPushToken[ab]', 'ExponentPushToken[abc def12345]', 'ExponentPushToken[abcdefgh12345]x', 'fcm:abcdefgh', null, undefined, 1, {}, 'ExponentPushToken[' + 'a'.repeat(300) + ']']) {
    assert.equal(isValidExpoPushToken(bad), false, String(bad).slice(0, 30))
  }
})

test('push-token: 自分の端末に登録・取り消しできる。他人の端末は 404。形が悪ければ 400。Cookie だけでは 401', async () => {
  const { deps, repo } = makeDeps()
  const a = await login(deps, 'A')
  const b = await login(deps, 'B')
  const aDev = repo.devices.find((d) => d.userId === a.user.id)!
  const bDev = repo.devices.find((d) => d.userId === b.user.id)!
  const auth = bearer(a.accessToken)

  assert.equal((await setPushToken(deps, auth, aDev.id, { token: 'nope' })).status, 400)
  assert.equal((await setPushToken(deps, auth, aDev.id, {})).status, 400)
  assert.equal((await setPushToken(deps, auth, aDev.id, null)).status, 400)
  const ok = await setPushToken(deps, auth, aDev.id, { token: TOKEN })
  assert.equal(ok.status, 200)
  assert.deepEqual(ok.body, { ok: true, enabled: true })
  assert.equal(repo.devices.find((d) => d.id === aDev.id)!.pushToken, TOKEN)
  assert.equal(JSON.stringify(ok.body).includes(TOKEN), false)

  // 他人の端末・存在しない端末は同じ 404
  assert.equal((await setPushToken(deps, auth, bDev.id, { token: TOKEN })).status, 404)
  assert.equal(repo.devices.find((d) => d.id === bDev.id)!.pushToken, null)
  assert.equal((await setPushToken(deps, auth, 'nope-nope', { token: TOKEN })).status, 404)
  // Cookie のセッションだけでは登録できない
  assert.equal((await setPushToken(deps, null, aDev.id, { token: TOKEN })).status, 401)

  // 取り消し
  const off = await setPushToken(deps, auth, aDev.id, { token: null })
  assert.deepEqual(off.body, { ok: true, enabled: false })
  assert.equal(repo.devices.find((d) => d.id === aDev.id)!.pushToken, null)
})

test('push-token: 同じトークンを別の端末に付けると、古い端末から外れる。失効・替えでの扱い', async () => {
  const { deps, repo } = makeDeps()
  const a1 = await login(deps, 'A')
  const a2 = await login(deps, 'A')
  const d1 = repo.devices[0]
  const d2 = repo.devices[1]
  await setPushToken(deps, bearer(a1.accessToken), d1.id, { token: TOKEN })
  await setPushToken(deps, bearer(a2.accessToken), d2.id, { token: TOKEN })
  assert.equal(d1.pushToken, null)
  assert.equal(d2.pushToken, TOKEN)
  // 替え（ローテーション）で新しい行へ引き継がれる
  const rot = await refreshSession(deps, { refreshToken: a2.refreshToken })
  assert.equal(rot.status, 200)
  const live = repo.devices.find((d) => d.familyId === d2.familyId && !d.rotatedAt)!
  assert.equal(live.pushToken, TOKEN)
  assert.equal(repo.devices.filter((d) => d.pushToken === TOKEN).length, 1)
  // 失効で消える
  await revokeDevice(deps, { authorization: bearer(rot.body.accessToken as string) }, live.id)
  assert.equal(repo.devices.filter((d) => d.pushToken).length, 0)
  // 失効した端末には登録できない
  assert.equal((await setPushToken(deps, bearer(a1.accessToken), live.id, { token: TOKEN })).status, 404)
})

// --- 旗オフ（route の中身。DB・メール・通信に触らない） ---
test('旗オフ: 一覧・失効・push-token は 404 { code: NOT_FOUND }。セッションも DB も読まない', async () => {
  const before = process.env.APP_AUTH_ENABLED
  delete process.env.APP_AUTH_ENABLED
  try {
    const req = (method: string, body?: unknown) => new NextRequest('http://localhost:3000/api/app/auth/devices', { method, ...(body ? { body: JSON.stringify(body) } : {}) })
    const touched: string[] = []
    const opts = {
      makeDeps: () => { touched.push('deps'); throw new Error('旗オフで deps を作った') },
      getCookieUserId: async () => { touched.push('cookie'); return null },
    }
    const res = [
      await handleDevicesList(req('GET'), opts),
      await handleDeviceRevoke(req('DELETE'), 'x', opts),
      await handlePushToken(req('POST', { token: TOKEN }), 'x', opts),
    ]
    for (const r of res) { assert.equal(r.status, 404); assert.deepEqual(await r.json(), { code: 'NOT_FOUND' }) }
    assert.deepEqual(touched, [])
    // route の本体も同じ（本番の部品も作らない）
    for (const mod of [await import('../../app/api/app/auth/devices/route')]) {
      const r = await mod.GET(req('GET'))
      assert.equal(r.status, 404)
    }
    const rr = await (await import('../../app/api/app/auth/devices/[id]/route')).DELETE(req('DELETE'), { params: Promise.resolve({ id: 'x' }) })
    assert.equal(rr.status, 404)
    const rp = await (await import('../../app/api/app/auth/devices/[id]/push-token/route')).POST(req('POST', { token: TOKEN }), { params: Promise.resolve({ id: 'x' }) })
    assert.equal(rp.status, 404)
  } finally {
    if (before !== undefined) process.env.APP_AUTH_ENABLED = before
  }
})

test('旗オン: ハンドラー経由でも、Cookie のユーザーで一覧が返り、レスポンスは no-store', async () => {
  const before = process.env.APP_AUTH_ENABLED
  process.env.APP_AUTH_ENABLED = '1'
  try {
    const { deps } = makeDeps()
    const a = await login(deps, 'A')
    const res = await handleDevicesList(new NextRequest('http://localhost:3000/api/app/auth/devices'), { makeDeps: () => deps, getCookieUserId: async () => a.user.id })
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('cache-control'), 'no-store')
    assert.equal(((await res.json()).devices as unknown[]).length, 1)
    // Cookie も Bearer も無ければ 401
    const none = await handleDevicesList(new NextRequest('http://localhost:3000/api/app/auth/devices'), { makeDeps: () => deps, getCookieUserId: async () => null })
    assert.equal(none.status, 401)
  } finally {
    if (before === undefined) delete process.env.APP_AUTH_ENABLED; else process.env.APP_AUTH_ENABLED = before
  }
})

// --- 指摘への対応（新しい登録が優先・失効との競合） ---
test('push-token: 新しい登録が優先。ほかのユーザーの生きている端末のトークンも外れる。自分の古い行からも外れる', async () => {
  const { deps, repo } = makeDeps()
  const a = await login(deps, 'A')
  const b = await login(deps, 'B')
  const aDev = repo.devices.find((d) => d.userId === a.user.id)!
  const bDev = repo.devices.find((d) => d.userId === b.user.id)!
  assert.equal((await setPushToken(deps, bearer(a.accessToken), aDev.id, { token: TOKEN })).status, 200)
  // 同じ端末（インストール）で B が新しくログインして、同じトークンを登録した
  const r = await setPushToken(deps, bearer(b.accessToken), bDev.id, { token: TOKEN })
  assert.equal(r.status, 200)
  assert.equal(bDev.pushToken, TOKEN)
  assert.equal(aDev.pushToken, null, '新しい登録が優先')
  // 自分の別の行からも外れる
  const a2 = await login(deps, 'A')
  const aDev2 = repo.devices.filter((d) => d.userId === a.user.id)[1]
  assert.equal((await setPushToken(deps, bearer(a2.accessToken), aDev2.id, { token: TOKEN })).status, 200)
  assert.equal(bDev.pushToken, null)
  assert.equal(repo.devices.filter((d) => d.pushToken === TOKEN).length, 1)
})

test('push-token: その端末の行を持つセッション以外は登録できない（同じユーザーの別の端末のトークンでも 404）', async () => {
  const { deps, repo } = makeDeps()
  const a1 = await login(deps, 'A')
  const a2 = await login(deps, 'A')
  const d2 = repo.devices.filter((d) => d.userId === a1.user.id)[1]
  assert.equal((await setPushToken(deps, bearer(a1.accessToken), d2.id, { token: TOKEN })).status, 404)
  assert.equal(d2.pushToken, null)
  assert.equal((await setPushToken(deps, bearer(a2.accessToken), d2.id, { token: TOKEN })).status, 200)
})

test('push-token: 失効した端末には登録できず、登録しても他の行のトークンを消さない。失効と登録を同時に走らせても、失効のあとにトークンが残らない', async () => {
  const { deps, repo } = makeDeps()
  for (let i = 0; i < 20; i++) {
    const a = await login(deps, 'A' + i)
    const dev = repo.devices.find((d) => d.userId === a.user.id)!
    await Promise.all([
      setPushToken(deps, bearer(a.accessToken), dev.id, { token: `ExponentPushToken[race${String(i).padStart(8, '0')}]` }),
      revokeDevice(deps, { authorization: bearer(a.accessToken) }, dev.id),
    ])
    assert.ok(dev.revokedAt)
    assert.equal(dev.pushToken, null, '失効のあとにトークンが残る')
  }
  const keep = await login(deps, 'K')
  const kd = repo.devices.find((d) => d.userId === keep.user.id)!
  await setPushToken(deps, bearer(keep.accessToken), kd.id, { token: TOKEN })
  const b = await login(deps, 'B')
  const bd = repo.devices.find((d) => d.userId === b.user.id)!
  await repo.revokeFamily(bd.familyId, clock)
  assert.equal(await repo.setDevicePushToken({ id: bd.id, userId: b.user.id, sessionId: bd.sessionId as string, token: TOKEN, now: clock }), 'not-found')
  assert.equal(kd.pushToken, TOKEN, '失効した端末の登録の失敗で、他の行のトークンは消えない')
})

test('push-token: 同じトークンを2つの端末が同時に登録しても、生きている行でトークンを持つのは1つだけ', async () => {
  const { deps, repo } = makeDeps()
  for (let i = 0; i < 10; i++) {
    const a = await login(deps, 'P' + i)
    const b = await login(deps, 'Q' + i)
    const tok = `ExponentPushToken[same${String(i).padStart(8, '0')}]`
    const da = repo.devices.find((d) => d.userId === a.user.id)!
    const db = repo.devices.find((d) => d.userId === b.user.id)!
    await Promise.all([
      setPushToken(deps, bearer(a.accessToken), da.id, { token: tok }),
      setPushToken(deps, bearer(b.accessToken), db.id, { token: tok }),
    ])
    assert.equal(repo.devices.filter((d) => d.pushToken === tok && !d.revokedAt && !d.rotatedAt).length, 1)
  }
})
