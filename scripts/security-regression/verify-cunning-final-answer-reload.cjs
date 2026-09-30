const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
const { load, check } = require('./load-typescript.cjs')

const recovery = load('src/lib/cunning/final-answer-recovery.ts')
const items = new Map()
const storage = {
  getItem: key => items.get(key) ?? null,
  setItem: (key, value) => items.set(key, value),
  removeItem: key => items.delete(key),
}
const originalNow = Date.now
const savedAt = originalNow()
const entry = { sessionId: 's', recordingToken: 'token', finalTranscriptId: 'last',
  contextTranscriptIds: ['first'], question: 'Original question?', recentTranscript: 'Earlier context', language: 'ja', savedAt }

;(async () => {
  await check('saved final input survives reload with the original language and context', () => {
    assert.equal(recovery.saveFinalAnswerRecovery(entry, storage), true)
    assert.deepEqual(JSON.parse(JSON.stringify(recovery.loadFinalAnswerRecovery('s', storage, savedAt + 1000))), entry)
    assert.equal(recovery.loadFinalAnswerRecovery('other', storage, savedAt + 1000), null)
  })
  await check('tampered or expired recovery input is discarded before any request', () => {
    const key = [...items.keys()][0]
    items.set(key, JSON.stringify({ ...entry, contextTranscriptIds: ['last'] }))
    assert.equal(recovery.loadFinalAnswerRecovery('s', storage, savedAt + 1000), null)
    assert.equal(items.size, 0)
    recovery.saveFinalAnswerRecovery(entry, storage)
    assert.equal(recovery.loadFinalAnswerRecovery('s', storage, savedAt + 30 * 60000 + 1), null)
    assert.equal(items.size, 0)
  })
  await check('successful final answer removes recovery data', () => {
    recovery.saveFinalAnswerRecovery(entry, storage)
    recovery.clearFinalAnswerRecovery('s', storage)
    assert.equal(recovery.loadFinalAnswerRecovery('s', storage), null)
  })

  const source = fs.readFileSync('src/app/cunning/live/[sessionId]/page.tsx', 'utf8')
  const ast = ts.createSourceFile('live.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let declaration
  function walk(node) {
    if (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText(ast) === 'retrySavedFinalAnswer')) declaration = node.getText(ast)
    ts.forEachChild(node, walk)
  }
  walk(ast)
  assert(declaration)
  await check('reloaded retry sends the saved token and input, then resumes report generation once', async () => {
    recovery.saveFinalAnswerRecovery(entry, storage)
    const calls = []
    const report = []
    const exports = {}
    const context = { exports, sessionId: 's', retryingFinalAnswer: false, finishingRef: { current: false },
      storedFinalAnswer: entry, loadFinalAnswerRecovery: id => recovery.loadFinalAnswerRecovery(id, storage),
      setRetryingFinalAnswer: value => calls.push(['busy', value]), setTranscriptionIssue: value => calls.push(['issue', value]),
      setStoredFinalAnswer: () => {}, requestAnswer: async (question, opts) => { calls.push(['answer', question, opts]); return true },
      finishRef: { current: async () => report.push('generated') } }
    vm.runInNewContext(ts.transpileModule(declaration + ';exports.retry=retrySavedFinalAnswer;',
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context)
    await exports.retry()
    const sent = calls.find(call => call[0] === 'answer')
    assert.equal(sent[1], entry.question)
    assert.equal(sent[2].recordingToken, entry.recordingToken)
    assert.equal(sent[2].finalTranscriptId, entry.finalTranscriptId)
    assert.deepEqual(Array.from(sent[2].contextTranscriptIds), entry.contextTranscriptIds)
    assert.equal(sent[2].language, 'ja')
    assert.equal(sent[2].recentTranscript, 'Earlier context')
    assert.deepEqual(report, ['generated'])
  })
  await check('failed retry does not generate a report', async () => {
    recovery.saveFinalAnswerRecovery(entry, storage)
    const exports = {}, report = []
    const context = { exports, sessionId: 's', retryingFinalAnswer: false, finishingRef: { current: false },
      storedFinalAnswer: entry, loadFinalAnswerRecovery: id => recovery.loadFinalAnswerRecovery(id, storage),
      setRetryingFinalAnswer: () => {}, setTranscriptionIssue: () => {}, setStoredFinalAnswer: () => {},
      requestAnswer: async () => false, finishRef: { current: async () => report.push('generated') } }
    vm.runInNewContext(ts.transpileModule(declaration + ';exports.retry=retrySavedFinalAnswer;',
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context)
    await exports.retry()
    assert.deepEqual(report, [])
    assert(recovery.loadFinalAnswerRecovery('s', storage))
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
