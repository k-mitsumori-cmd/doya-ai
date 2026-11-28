import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ACCESS_TOKEN_TTL_MS, REFRESH_TOKEN_TTL_MS, decideRefresh, generateOpaqueToken, isDeviceActive, isSafeTokenValue,
  isSessionLive, issueSession, revocationPatch, rotateSession, sha256Hex, type DeviceRow, type RandomBytes,
} from './device-token'

// 乱数は種から作る（同じ種なら同じ並びになる）。本物の乱数は使わない
const seeded = (seed: number): RandomBytes => {
  let s = seed
  return (size) => Uint8Array.from({ length: size }, () => ((s = (s * 1103515245 + 12345) & 0x7fffffff), s & 0xff))
}
const t0 = new Date('2026-11-18T00:00:00Z')
const at = (ms: number) => new Date(t0.getTime() + ms)

function rowFrom(issued: ReturnType<typeof issueSession>, over: Partial<DeviceRow> = {}): DeviceRow {
  return { id: 'd1', userId: 'u1', ...issued.device, ...over }
}

test('発行: アクセス1時間・リフレッシュ90日。DB に入れるのはハッシュだけ', () => {
  const s = issueSession({ now: t0, randomBytes: seeded(1) })
  assert.equal(s.accessExpiresAt.getTime() - t0.getTime(), ACCESS_TOKEN_TTL_MS)
  assert.equal(s.device.expiresAt.getTime() - t0.getTime(), REFRESH_TOKEN_TTL_MS)
  assert.equal(s.device.refreshTokenHash, sha256Hex(s.refreshToken))
  assert.notEqual(s.device.refreshTokenHash, s.refreshToken)
  assert.match(s.device.refreshTokenHash, /^[0-9a-f]{64}$/)
  assert.ok(isSafeTokenValue(s.accessToken) && isSafeTokenValue(s.refreshToken) && isSafeTokenValue(s.device.familyId))
  assert.notEqual(s.accessToken, s.refreshToken)
  assert.equal(JSON.stringify(s.device).includes(s.refreshToken), false)
})

test('乱数は引数で注入される（同じ乱数なら同じ値、違えば別の値）', () => {
  assert.equal(generateOpaqueToken(seeded(5)), generateOpaqueToken(seeded(5)))
  assert.notEqual(generateOpaqueToken(seeded(5)), generateOpaqueToken(seeded(6)))
  assert.throws(() => generateOpaqueToken(() => new Uint8Array(8)))
})

test('更新: 正しいトークンなら rotate。同じ系統の新しいトークンが出て、期限は now + 90日', () => {
  const s = issueSession({ now: t0, randomBytes: seeded(2) })
  const later = at(10 * 24 * 3600 * 1000)
  const d = decideRefresh({ token: s.refreshToken, row: rowFrom(s), now: later })
  assert.deepEqual(d, { action: 'rotate', familyId: s.device.familyId, rotatedAt: later })
  const r = rotateSession({ familyId: s.device.familyId, now: later, randomBytes: seeded(3) })
  assert.equal(r.device.familyId, s.device.familyId)
  assert.equal(r.device.expiresAt.getTime() - later.getTime(), REFRESH_TOKEN_TTL_MS)
  assert.notEqual(r.refreshToken, s.refreshToken)
  assert.equal(r.device.refreshTokenHash, sha256Hex(r.refreshToken))
})

test('期限切れ: 90日を過ぎたら reject expired（ちょうど期限の時刻も切れ）', () => {
  const s = issueSession({ now: t0, randomBytes: seeded(4) })
  assert.deepEqual(decideRefresh({ token: s.refreshToken, row: rowFrom(s), now: at(REFRESH_TOKEN_TTL_MS - 1) }).action, 'rotate')
  assert.deepEqual(decideRefresh({ token: s.refreshToken, row: rowFrom(s), now: at(REFRESH_TOKEN_TTL_MS) }), { action: 'reject', reason: 'expired' })
  assert.deepEqual(decideRefresh({ token: s.refreshToken, row: rowFrom(s), now: at(REFRESH_TOKEN_TTL_MS + 1000) }), { action: 'reject', reason: 'expired' })
})

test('再利用の検出: ローテーション済みの古いトークンを使うと、その系統を全部失効させる', () => {
  const s = issueSession({ now: t0, randomBytes: seeded(5) })
  const rotated = rowFrom(s, { rotatedAt: at(1000) })
  const d = decideRefresh({ token: s.refreshToken, row: rotated, now: at(60_000) })
  assert.deepEqual(d, { action: 'revoke-family', familyId: s.device.familyId, userId: 'u1', revokedAt: at(60_000) })
  // 期限切れのあとの再利用でも、検出を優先する
  assert.equal(decideRefresh({ token: s.refreshToken, row: rotated, now: at(REFRESH_TOKEN_TTL_MS + 5000) }).action, 'revoke-family')
})

test('再利用の猶予: 猶予の中の再送は系統を失効させず retry-conflict。猶予を過ぎたら失効', () => {
  const s = issueSession({ now: t0, randomBytes: seeded(6) })
  const rotated = rowFrom(s, { rotatedAt: at(1000) })
  const o = { reuseLeewayMs: 5000 }
  assert.deepEqual(decideRefresh({ token: s.refreshToken, row: rotated, now: at(4000), options: o }), { action: 'reject', reason: 'retry-conflict' })
  assert.equal(decideRefresh({ token: s.refreshToken, row: rotated, now: at(6001), options: o }).action, 'revoke-family')
  // 既定は猶予なし
  assert.equal(decideRefresh({ token: s.refreshToken, row: rotated, now: at(1001) }).action, 'revoke-family')
})

test('失効: revokedAt のある行は使えない。失効のあとの再試行は二重に失効させない', () => {
  const s = issueSession({ now: t0, randomBytes: seeded(7) })
  assert.deepEqual(decideRefresh({ token: s.refreshToken, row: rowFrom(s, { revokedAt: at(5) }), now: at(10) }), { action: 'reject', reason: 'revoked' })
  assert.deepEqual(decideRefresh({ token: s.refreshToken, row: rowFrom(s, { revokedAt: at(5), rotatedAt: at(3) }), now: at(10) }), { action: 'reject', reason: 'revoked' })
  assert.deepEqual(revocationPatch(at(9)), { revokedAt: at(9) })
})

test('不正な入力: 形が悪い・行が無い・ハッシュが合わない行は reject', () => {
  const s = issueSession({ now: t0, randomBytes: seeded(8) })
  for (const bad of [undefined, null, 5, '', 'short', 'has space aaaaaaaaaaaaaaaa', 'a;b=cccccccccccccccccc', 'x'.repeat(300)]) {
    assert.deepEqual(decideRefresh({ token: bad, row: rowFrom(s), now: t0 }), { action: 'reject', reason: 'malformed' }, String(bad))
  }
  assert.deepEqual(decideRefresh({ token: s.refreshToken, row: null, now: t0 }), { action: 'reject', reason: 'unknown' })
  const other = issueSession({ now: t0, randomBytes: seeded(9) })
  assert.deepEqual(decideRefresh({ token: other.refreshToken, row: rowFrom(s), now: t0 }), { action: 'reject', reason: 'unknown' })
})

test('isSafeTokenValue: Cookie に別の Cookie を紛れ込ませる値を通さない。UUID は通す', () => {
  assert.equal(isSafeTokenValue('a'.repeat(43)), true)
  assert.equal(isSafeTokenValue('123e4567-e89b-12d3-a456-426614174000'), true)
  for (const bad of ['a'.repeat(15), 'abc; next-auth.session-token=evil', 'a'.repeat(20) + ',b', 'a'.repeat(20) + '=', 'a'.repeat(20) + '\n', 'a'.repeat(257)]) {
    assert.equal(isSafeTokenValue(bad), false, bad)
  }
})

test('isDeviceActive・isSessionLive', () => {
  const s = issueSession({ now: t0, randomBytes: seeded(10) })
  assert.equal(isDeviceActive(rowFrom(s), at(1000)), true)
  assert.equal(isDeviceActive(rowFrom(s, { rotatedAt: at(1) }), at(1000)), false)
  assert.equal(isDeviceActive(rowFrom(s, { revokedAt: at(1) }), at(1000)), false)
  assert.equal(isDeviceActive(rowFrom(s), at(REFRESH_TOKEN_TTL_MS)), false)
  assert.equal(isSessionLive({ expires: at(1000) }, at(999)), true)
  assert.equal(isSessionLive({ expires: at(1000) }, at(1000)), false)
  assert.equal(isSessionLive(null, t0), false)
})

test('通しの流れ: 発行 -> 更新 -> 古いトークンの再利用 で系統が止まる', () => {
  const s = issueSession({ now: t0, randomBytes: seeded(11) })
  const d1 = decideRefresh({ token: s.refreshToken, row: rowFrom(s), now: at(3600_000) })
  assert.equal(d1.action, 'rotate')
  const r = rotateSession({ familyId: s.device.familyId, now: at(3600_000), randomBytes: seeded(12) })
  // 古い行は rotatedAt が入る。新しい行は最新
  const oldRow = rowFrom(s, { rotatedAt: at(3600_000) })
  const newRow: DeviceRow = { id: 'd2', userId: 'u1', ...r.device }
  assert.equal(decideRefresh({ token: r.refreshToken, row: newRow, now: at(7200_000) }).action, 'rotate')
  const reuse = decideRefresh({ token: s.refreshToken, row: oldRow, now: at(7300_000) })
  assert.equal(reuse.action, 'revoke-family')
  if (reuse.action === 'revoke-family') assert.equal(reuse.familyId, newRow.familyId)
})
