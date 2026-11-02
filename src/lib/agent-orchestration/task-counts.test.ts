// 実行: npx tsx --test src/lib/agent-orchestration/task-counts.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { countAgentTasks, DONE_WITHIN_MS } from './task-counts'
import { STALE_MS } from './runs'

const now = new Date('2026-11-01T12:00:00Z')
const ago = (ms: number) => new Date(now.getTime() - ms)
const task = (status: string, o: { delegated?: boolean; startedAt?: Date | null; endedAt?: Date | null } = {}) => ({
  delegated: o.delegated ?? true, status: status as never, startedAt: o.startedAt ?? null, endedAt: o.endedAt ?? null,
})

test('実行中・これから・できた・止まったを数える', () => {
  const c = countAgentTasks([{
    run: { status: 'running' },
    tasks: [
      task('running', { startedAt: ago(60_000) }),
      task('running', { startedAt: ago(STALE_MS + 1000) }),
      task('waiting'),
      task('done', { endedAt: ago(3600_000) }),
      task('done', { endedAt: ago(DONE_WITHIN_MS + 1000) }),
      task('failed', { endedAt: ago(1000) }),
      task('skipped'),
      task('running', { delegated: false, startedAt: ago(1000) }),
    ],
  }], now)
  assert.deepEqual(c, { running: 1, waiting: 1, done: 1, failed: 2 })
})

test('取り消した実行は数えない', () => {
  const c = countAgentTasks([{ run: { status: 'canceled' }, tasks: [task('running', { startedAt: ago(1000) }), task('waiting')] }], now)
  assert.deepEqual(c, { running: 0, waiting: 0, done: 0, failed: 0 })
})
