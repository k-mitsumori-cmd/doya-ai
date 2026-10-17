// 実行: npm run test:syscheck
// ナグサメのゲスト ID が、書き換えた Cookie では使えないことを確かめる（SEC-025）。
// あわせて chat API が、ログインか署名付きゲストと 1 日の上限を必須にしていることをソースから確かめる（SEC-024）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { issueGuestId, readGuestId } from './guest'

test('発行した Cookie 値はゲスト ID として読める', () => {
  const { guestId, cookieValue } = issueGuestId()
  assert.equal(readGuestId(cookieValue), guestId)
})

test('署名の無い値・書き換えた値・壊れた値は読まない', () => {
  const { guestId, cookieValue } = issueGuestId()
  assert.equal(readGuestId(guestId), null)
  assert.equal(readGuestId(`${crypto.randomUUID()}.${cookieValue.split('.')[1]}`), null)
  assert.equal(readGuestId(`${guestId}.x`), null)
  assert.equal(readGuestId('not-a-uuid.sig'), null)
  assert.equal(readGuestId(''), null)
  assert.equal(readGuestId(undefined), null)
})

const routeSource = (name: string) => readFileSync(join(process.cwd(), `src/app/api/mitsuboshi/nagusame/${name}/route.ts`), 'utf8')

test('chat はログインか署名付きゲストでないと 401 を返し、上限の消費が Claude の呼び出しより先にある', () => {
  const src = routeSource('chat')
  assert.match(src, /readGuestId\(/)
  assert.match(src, /status: 401/)
  const quotaAt = src.indexOf('claimNagusameChat(')
  const callAt = src.indexOf('await callClaudeChat(')
  assert.ok(quotaAt > 0 && callAt > quotaAt, '上限の消費は Claude の呼び出しより前に置く')
})

test('generate は Cookie の値をそのまま使わず、ゲストは IP ごとの上限も数える', () => {
  const src = routeSource('generate')
  assert.doesNotMatch(src, /req\.cookies\.get\(GUEST_COOKIE\)\?\.value \|\| null/)
  assert.match(src, /readGuestId\(/)
  const ipAt = src.indexOf("claimNagusameGuestIp(req.headers, 'generate')")
  const genAt = src.indexOf('generateNagusameReplies(')
  assert.ok(ipAt > 0 && genAt > ipAt, 'IP の上限は生成より前に数える')
})
