import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, generateKeyPairSync, type KeyObject } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { idTokenReplayKey, parseBooleanClaim, verifyIdToken, type Jwks } from './id-token'

// 試験用に作った鍵のペアだけを使う。本物の Apple・Google には通信しない。
const pair = (kid: string) => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  return { kid, privateKey, jwk: { ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' } }
}
const A = pair('key-a')
const B = pair('key-b')
const jwks: Jwks = { keys: [A.jwk as any, B.jwk as any] }
const now = new Date('2026-11-18T03:00:00Z')
const nowSec = Math.floor(now.getTime() / 1000)
const AUD = 'jp.example.doya'
const RAW = 'raw-nonce-123'
const sha = (s: string) => createHash('sha256').update(s).digest('hex')

function sign(claims: Record<string, unknown>, opts: { key?: KeyObject; kid?: string; alg?: any } = {}) {
  return jwt.sign(claims, (opts.key ?? A.privateKey) as any, { algorithm: opts.alg ?? 'RS256', keyid: opts.kid ?? 'key-a', noTimestamp: true })
}
const goodGoogle = (over: Record<string, unknown> = {}) => ({
  iss: 'https://accounts.google.com', aud: AUD, sub: 'g-sub-1', exp: nowSec + 600, iat: nowSec - 5,
  nonce: RAW, email: 'Taro@Example.com', email_verified: true, ...over,
})
const goodApple = (over: Record<string, unknown> = {}) => ({
  iss: 'https://appleid.apple.com', aud: AUD, sub: 'a-sub-1', exp: nowSec + 600, iat: nowSec - 5,
  nonce: sha(RAW), email: 'abc@privaterelay.appleid.com', email_verified: 'true', is_private_email: 'true', ...over,
})
const run = (token: string, provider: 'google' | 'apple' = 'google', over: Record<string, unknown> = {}) =>
  verifyIdToken({ token, provider, jwks, audience: AUD, nonce: RAW, now, ...over } as any)

test('Google: 正しいトークンは通る。メールは小文字、email_verified は真偽値', () => {
  const r = run(sign(goodGoogle()))
  assert.deepEqual(r, { ok: true, identity: { provider: 'google', sub: 'g-sub-1', email: 'taro@example.com', emailVerified: true, isPrivateEmail: false } })
})

test('Apple: email_verified が文字列 \'true\' でも真。隠したメールは isPrivateEmail', () => {
  const r = run(sign(goodApple()), 'apple')
  assert.deepEqual(r, { ok: true, identity: { provider: 'apple', sub: 'a-sub-1', email: 'abc@privaterelay.appleid.com', emailVerified: true, isPrivateEmail: true } })
  const r2 = run(sign(goodApple({ email: 'me@example.com', email_verified: 'false', is_private_email: 'false' })), 'apple')
  assert.deepEqual(r2, { ok: true, identity: { provider: 'apple', sub: 'a-sub-1', email: 'me@example.com', emailVerified: false, isPrivateEmail: false } })
})

test('Apple: メールが無い（初回以外）トークンは email null・未確認', () => {
  const c = goodApple(); delete (c as any).email; delete (c as any).email_verified; delete (c as any).is_private_email
  assert.deepEqual(run(sign(c), 'apple'), { ok: true, identity: { provider: 'apple', sub: 'a-sub-1', email: null, emailVerified: false, isPrivateEmail: false } })
})

test('email_verified が無い・不正な値のときは、未確認として扱う', () => {
  for (const v of [undefined, 'yes', 1, null]) {
    const r = run(sign(goodGoogle({ email_verified: v })))
    assert.equal(r.ok && r.identity.emailVerified, false)
  }
  assert.equal(parseBooleanClaim('true'), true)
  assert.equal(parseBooleanClaim('false'), false)
  assert.equal(parseBooleanClaim(undefined), null)
})

test('署名: 別の鍵で署名したトークンは bad-signature。鍵 id が一覧に無ければ no-matching-key', () => {
  const evil = pair('key-a') // 同じ kid を名乗る別の鍵
  assert.deepEqual(run(sign(goodGoogle(), { key: evil.privateKey })), { ok: false, reason: 'bad-signature' })
  assert.deepEqual(run(sign(goodGoogle(), { kid: 'unknown' })), { ok: false, reason: 'no-matching-key' })
  // 2つめの鍵（kid で選ばれる）
  assert.equal(run(sign(goodGoogle(), { key: B.privateKey, kid: 'key-b' })).ok, true)
})

test('alg: none と HS256 は署名の確認の前に弾く', () => {
  const none = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT', kid: 'key-a' })).toString('base64url')}.${Buffer.from(JSON.stringify(goodGoogle())).toString('base64url')}.`
  assert.deepEqual(run(none), { ok: false, reason: 'unsupported-alg' })
  const hs = jwt.sign(goodGoogle(), 'shared-secret', { algorithm: 'HS256', keyid: 'key-a', noTimestamp: true })
  assert.deepEqual(run(hs), { ok: false, reason: 'unsupported-alg' })
})

test('iss: 提供元と違う発行者は bad-issuer（Google のトークンを Apple として出しても通らない）', () => {
  assert.deepEqual(run(sign(goodGoogle({ iss: 'https://evil.example' }))), { ok: false, reason: 'bad-issuer' })
  assert.deepEqual(run(sign(goodGoogle()), 'apple'), { ok: false, reason: 'bad-issuer' })
  // Google は iss の2つの書き方を許す
  assert.equal(run(sign(goodGoogle({ iss: 'accounts.google.com' }))).ok, true)
})

test('aud: 違う aud は bad-audience。aud が複数でも、許す値のどれかがあれば通る', () => {
  assert.deepEqual(run(sign(goodGoogle({ aud: 'other-app' }))), { ok: false, reason: 'bad-audience' })
  assert.equal(run(sign(goodGoogle({ aud: ['x', AUD] }))).ok, true)
  assert.equal(verifyIdToken({ token: sign(goodGoogle()), provider: 'google', jwks, audience: ['a', AUD], nonce: RAW, now }).ok, true)
})

test('exp: 期限切れは expired。60秒の時計のずれは許す', () => {
  assert.deepEqual(run(sign(goodGoogle({ exp: nowSec - 120 }))), { ok: false, reason: 'expired' })
  assert.equal(run(sign(goodGoogle({ exp: nowSec - 30 }))).ok, true)
  assert.deepEqual(run(sign(goodGoogle({ exp: nowSec - 30 })), 'google', { clockToleranceSec: 0 }), { ok: false, reason: 'expired' })
})

test('exp が無いトークンは通さない', () => {
  const c: any = goodGoogle(); delete c.exp
  assert.equal(run(sign(c)).ok, false)
})

test('nonce: 一致しない・無い・空の指定は通さない。Apple は生の値か SHA-256 の16進のどちらでも一致', () => {
  assert.deepEqual(run(sign(goodGoogle({ nonce: 'other' }))), { ok: false, reason: 'nonce-mismatch' })
  const c: any = goodGoogle(); delete c.nonce
  assert.deepEqual(run(sign(c)), { ok: false, reason: 'missing-nonce' })
  assert.deepEqual(run(sign(goodGoogle()), 'google', { nonce: '' }), { ok: false, reason: 'missing-nonce' })
  assert.equal(run(sign(goodApple({ nonce: RAW })), 'apple').ok, true)
  assert.equal(run(sign(goodApple({ nonce: sha(RAW) })), 'apple').ok, true)
  // Google は SHA-256 の16進を「生の値の代わり」として受け入れない
  assert.deepEqual(run(sign(goodGoogle({ nonce: sha(RAW) }))), { ok: false, reason: 'nonce-mismatch' })
})

test('sub が無いトークンは missing-sub', () => {
  const c: any = goodGoogle(); delete c.sub
  assert.deepEqual(run(sign(c)), { ok: false, reason: 'missing-sub' })
})

test('形が崩れた入力・壊れた鍵は、例外を投げずに失敗を返す', () => {
  for (const bad of ['', 'a.b', 'a.b.c', 'not a jwt']) assert.equal(run(bad).ok, false, bad)
  // 壊れた鍵は、鍵の作成で失敗（bad-key）するか、署名が合わない（bad-signature）かのどちらか。どちらでも通らない
  const broken = verifyIdToken({ token: sign(goodGoogle()), provider: 'google', jwks: { keys: [{ kty: 'RSA', kid: 'key-a', n: 'x', e: 'y' } as any] }, audience: AUD, nonce: RAW, now })
  assert.equal(broken.ok, false)
  assert.deepEqual(verifyIdToken({ token: sign(goodGoogle()), provider: 'google', jwks: { keys: [{ kty: 'RSA', kid: 'key-a' } as any] }, audience: AUD, nonce: RAW, now }), { ok: false, reason: 'bad-key' })
  assert.deepEqual(verifyIdToken({ token: sign(goodGoogle()), provider: 'google', jwks: { keys: [] }, audience: AUD, nonce: RAW, now }), { ok: false, reason: 'no-matching-key' })
})

test('署名の base64url が正規形でないトークン（パディングの付加・末尾の余りビットの変更）は、署名が有効でも拒否する', () => {
  const t = sign(goodGoogle())
  assert.equal(run(t).ok, true)
  const [h, p, sg] = t.split('.')
  // パディングの付加
  assert.deepEqual(run(`${h}.${p}.${sg}=`), { ok: false, reason: 'malformed' })
  // 2048bit の署名は 256 バイト = 43*6 ビット余り… 末尾の文字の余りビットだけを変える（デコードすると同じバイト列になる別の文字列）
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  const last = sg[sg.length - 1]
  const alt = alphabet.split('').find((c) => c !== last && Buffer.from(sg.slice(0, -1) + c, 'base64url').equals(Buffer.from(sg, 'base64url')))
  assert.ok(alt, '同じバイト列になる別の末尾文字がある')
  assert.deepEqual(run(`${h}.${p}.${sg.slice(0, -1)}${alt}`), { ok: false, reason: 'malformed' })
})

test('使い回しの鍵: claims から作る。jti の有無・区切りの曖昧さ・claims の違いを正しく扱う', () => {
  const base = { iss: 'i', aud: 'a', sub: 's', jti: 'j1', iat: 1, exp: 2, nonce: 'n' }
  assert.equal(idTokenReplayKey(base), idTokenReplayKey({ ...base, extra: 'x' }))
  assert.notEqual(idTokenReplayKey(base), idTokenReplayKey({ ...base, jti: 'j2' }))
  assert.notEqual(idTokenReplayKey(base), idTokenReplayKey({ ...base, sub: 's2' }))
  // 区切りの曖昧さ: (a|bc) と (ab|c) は別の鍵
  assert.notEqual(idTokenReplayKey({ iss: 'i', aud: 'a', sub: 'bc', jti: 'j' }), idTokenReplayKey({ iss: 'i', aud: 'ab', sub: 'c', jti: 'j' }))
  // jti が無いときは iat・exp・nonce も使う
  const nojti = { iss: 'i', aud: 'a', sub: 's', iat: 1, exp: 2, nonce: 'n' }
  assert.notEqual(idTokenReplayKey(nojti), idTokenReplayKey({ ...nojti, nonce: 'm' }))
  assert.notEqual(idTokenReplayKey(nojti), idTokenReplayKey({ ...nojti, exp: 3 }))
  assert.match(idTokenReplayKey(nojti), /^[0-9a-f]{64}$/)
})
