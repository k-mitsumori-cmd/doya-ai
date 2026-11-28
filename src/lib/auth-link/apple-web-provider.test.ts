import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { buildAppleClientSecret, buildAppleProviders } from './apple-web-provider'

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string
const env = { APP_AUTH_ENABLED: '1', APPLE_CLIENT_ID: 'jp.example.web', APPLE_TEAM_ID: 'TEAM123456', APPLE_KEY_ID: 'KEY1234567', APPLE_PRIVATE_KEY: pem }
const now = new Date('2026-11-18T00:00:00Z')

test('4つの環境変数のどれかが欠ければ、何も足さない（Google だけのまま）', () => {
  assert.deepEqual(buildAppleProviders({}, now), [])
  for (const k of Object.keys(env)) assert.deepEqual(buildAppleProviders({ ...env, [k]: '' }, now), [], k)
})

test('全部あるときだけ Apple を足す。client_secret は ES256 の JWT で、iss・sub・aud・kid が正しい', () => {
  const [p] = buildAppleProviders(env, now) as any[]
  assert.equal(p.id, 'apple')
  const secret = p.options.clientSecret as string
  const claims = jwt.verify(secret, publicKey, { algorithms: ['ES256'], clockTimestamp: Math.floor(now.getTime() / 1000) + 10 }) as jwt.JwtPayload
  assert.equal(claims.iss, 'TEAM123456')
  assert.equal(claims.sub, 'jp.example.web')
  assert.equal(claims.aud, 'https://appleid.apple.com')
  assert.equal((jwt.decode(secret, { complete: true }) as any).header.kid, 'KEY1234567')
  assert.ok((claims.exp as number) - (claims.iat as number) <= 180 * 24 * 3600)
})

test('改行が \\n の文字で入っていても読める。鍵が壊れていれば、例外を投げずに何も足さない', () => {
  assert.equal(buildAppleProviders({ ...env, APPLE_PRIVATE_KEY: pem.replace(/\n/g, '\\n') }, now).length, 1)
  assert.deepEqual(buildAppleProviders({ ...env, APPLE_PRIVATE_KEY: 'not a key' }, now), [])
  assert.throws(() => buildAppleClientSecret({ teamId: 't', clientId: 'c', keyId: 'k', privateKey: 'bad', now }))
})

test('旗 APP_AUTH_ENABLED がオフ（未設定・0）なら、4つの環境変数が全部あっても、何も足さない', () => {
  const noFlag: Record<string, string> = { ...env }
  delete noFlag.APP_AUTH_ENABLED
  assert.deepEqual(buildAppleProviders(noFlag, now), [])
  assert.deepEqual(buildAppleProviders({ ...env, APP_AUTH_ENABLED: '0' }, now), [])
})
