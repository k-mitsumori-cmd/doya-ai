'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { collectFailures, summarizeLog, toMarkdown } = require('./ci-failure-report.cjs')

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-failure-report-'))
  const write = (name, body) => fs.writeFileSync(path.join(dir, name), typeof body === 'string' ? body : JSON.stringify(body))
  return { dir, write }
}

test('失敗した検査の対のログから、原因の行と末尾を取り出す', () => {
  const { dir, write } = fixture()
  write('adimage-analysis-postgres-supervisor.json', { startedAt: new Date().toISOString(), status: 'failed', probeExitCode: 1, evidenceValid: false, endedAt: new Date().toISOString() })
  write('adimage-analysis-postgres.log', "PASS one\nError: ENOENT: no such file or directory, open 'src/app/adimage/Tool.tsx'\n    at Object.openSync (node:fs:560:18)\n  path: 'src/app/adimage/Tool.tsx'\n")
  write('passing-supervisor.json', { status: 'passed' })
  const failures = collectFailures(dir, Date.now() - 60_000)
  assert.equal(failures.length, 1)
  assert.match(failures[0].causes[0], /ENOENT: no such file or directory, open 'src\/app\/adimage\/Tool\.tsx'/)
  assert.ok(failures[0].causes.every(c => !/^\s+at /.test(c)), 'スタックの at 行は原因の行に入れない')
  const md = toMarkdown(failures)
  assert.match(md, /CI の失敗の要約（1件）/)
  assert.match(md, /#### adimage-analysis-postgres/)
  assert.match(md, /検査の終了コード: 1/)
  assert.match(md, /src\/app\/adimage\/Tool\.tsx/)
})

test('今回の実行より前に書かれた記録は数えない', () => {
  const { dir, write } = fixture()
  write('old-supervisor.json', { status: 'failed', probeExitCode: 1 })
  const past = new Date(Date.now() - 3600_000)
  fs.utimesSync(path.join(dir, 'old-supervisor.json'), past, past)
  assert.equal(collectFailures(dir, Date.now() - 60_000).length, 0)
})

test('対のログが無いときは、その検査の実行中に書かれたログを使う', () => {
  const { dir, write } = fixture()
  const start = new Date(Date.now() - 2000).toISOString()
  write('persona-read-supervisor.json', { startedAt: start, endedAt: new Date().toISOString(), status: 'failed', probeExitCode: 1 })
  write('persona-read-other-name.log', 'Error: Unmocked ./image-entitlements\n')
  const [f] = collectFailures(dir, Date.now() - 60_000)
  assert.match(f.log, /persona-read-other-name\.log$/)
  assert.deepEqual(f.causes, ['Error: Unmocked ./image-entitlements'])
})

test('失敗の記録が無いときは、その旨を書く', () => {
  assert.match(toMarkdown([]), /失敗はありません/)
})

test('長い行は切り、末尾の行数を絞る', () => {
  const { tail } = summarizeLog(Array.from({ length: 100 }, (_, i) => 'line ' + i + ' ' + 'x'.repeat(i === 99 ? 500 : 0)).join('\n'), 5)
  assert.equal(tail.length, 5)
  assert.ok(tail[4].endsWith('…'))
})
