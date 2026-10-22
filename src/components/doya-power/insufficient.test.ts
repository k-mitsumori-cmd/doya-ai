// 実行: npm run test:doyapower
// 「ドヤパワーが足りない」（402）の共通の取り扱い。DOM や fetch には触れない（読み取りと判定だけ）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isOwnApiRequest, notifyIfDoyaPowerInsufficient, parseDoyaPowerInsufficient } from './insufficient'

test('402 の本文から、知らせに使う値を取り出す', () => {
  assert.deepEqual(
    parseDoyaPowerInsufficient({ code: 'DOYA_POWER_INSUFFICIENT', balance: 8, required: 50, limit: 100, recoveryAmount: 10, nextRecoveryAt: '2026-10-23T15:00:00.000Z' }),
    { balance: 8, required: 50, limit: 100, recoveryAmount: 10, nextRecoveryAt: '2026-10-23T15:00:00.000Z' },
  )
  // limit が無ければ、残りと必要な量の大きいほう
  assert.equal(parseDoyaPowerInsufficient({ code: 'DOYA_POWER_INSUFFICIENT', balance: 8, required: 50 })?.limit, 50)
  // 別の 402（各ツールの月の上限など）や、壊れた値は知らせない
  for (const b of [{ code: 'LIMIT', balance: 1, required: 2 }, { code: 'DOYA_POWER_INSUFFICIENT', balance: -1, required: 2 }, { code: 'DOYA_POWER_INSUFFICIENT', balance: '1', required: 2 }, null, 'x']) {
    assert.equal(parseDoyaPowerInsufficient(b), null, JSON.stringify(b))
  }
  assert.equal(parseDoyaPowerInsufficient({ code: 'DOYA_POWER_INSUFFICIENT', balance: 1, required: 2, nextRecoveryAt: 'not a date' })?.nextRecoveryAt, undefined)
})

test('同じサイトの /api/ だけを見る', () => {
  const o = 'https://doya.example'
  assert.equal(isOwnApiRequest('/api/persona/generate', o), true)
  assert.equal(isOwnApiRequest(new URL('https://doya.example/api/x'), o), true)
  assert.equal(isOwnApiRequest('https://evil.example/api/x', o), false)
  assert.equal(isOwnApiRequest('/home', o), false)
})

test('402 以外の応答・別の 402 では知らせない（本文は読み取りを邪魔しない）', async () => {
  assert.equal(await notifyIfDoyaPowerInsufficient(new Response('{}', { status: 200 })), false)
  const other = new Response(JSON.stringify({ code: 'LIMIT' }), { status: 402 })
  assert.equal(await notifyIfDoyaPowerInsufficient(other), false)
  // 呼ぶ側は、あとから本文を読める
  assert.deepEqual(await other.json(), { code: 'LIMIT' })
})
