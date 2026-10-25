// 実行: npx tsx --test src/components/home-agent/stream.test.ts
// 作戦づくりの API の流れ（NDJSON）を読む部品の回帰テスト。ネットワーク・DB・AI には触れない。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsePlanLine, readPlanStream } from './stream'
import type { AgentPlanEvent } from '@/lib/agent-orchestration/types'

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  return new ReadableStream({ start(c) { for (const s of chunks) c.enqueue(enc.encode(s)); c.close() } })
}

test('1行ずつの知らせを順に渡し、result で終わる（行が途中で切れて届いても読める）', async () => {
  const lines = [
    { type: 'source', source: { id: 'company', kind: 'company', label: '登録会社の情報', status: 'reading' } },
    { type: 'source', source: { id: 'company', kind: 'company', label: '登録会社の情報', status: 'read', note: 'サンプル株式会社' } },
    { type: 'reason', text: '相手の事業を先に知ります。' },
    { type: 'result', response: { kind: 'none' } },
  ].map((l) => JSON.stringify(l) + '\n').join('')
  const seen: AgentPlanEvent[] = []
  const last = await readPlanStream(streamOf([lines.slice(0, 30), lines.slice(30, 77), lines.slice(77)]), (e) => seen.push(e))
  assert.deepEqual(seen.map((e) => e.type), ['source', 'source', 'reason', 'result'])
  assert.equal(last.type, 'result')
})

test('形の違う行は捨てる', () => {
  assert.equal(parsePlanLine(''), null)
  assert.equal(parsePlanLine('not json'), null)
  assert.equal(parsePlanLine('{"type":"other"}'), null)
  assert.equal(parsePlanLine('{"type":"reason","text":"a"}')?.type, 'reason')
})

test('終わりの知らせが来ないまま切れたら、error を渡して画面を止めない', async () => {
  const seen: AgentPlanEvent[] = []
  const last = await readPlanStream(streamOf([JSON.stringify({ type: 'reason', text: 'a' }) + '\n']), (e) => seen.push(e))
  assert.equal(last.type, 'error')
  assert.equal(seen[seen.length - 1].type, 'error')
})

test('error の知らせで終わる', async () => {
  const last = await readPlanStream(streamOf([JSON.stringify({ type: 'error', text: '作れませんでした' }) + '\n']), () => {})
  assert.deepEqual(last, { type: 'error', text: '作れませんでした' })
})
