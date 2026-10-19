// Offline regression: 有料APIの呼び過ぎ防止（ドヤカンニングの自動回答）。
// すべてモックで呼び出し回数を数える。外部APIは呼ばない。process.env の既定値には頼らない。
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { load, check } = require('./load-typescript.cjs')
const root = path.resolve(__dirname, '../..')
const ts = require(path.join(root, 'node_modules/typescript'))

const ENV = { GOOGLE_GENAI_API_KEY: 'offline-gemini-key', OPENAI_API_KEY: 'offline-openai-key' }
const isOpenAi = (url) => String(url).includes('openai.com')

// 仮の時計とタイマー（実時間を待たない）
function fakeClock() {
  let now = 0
  const timers = []
  return {
    now: () => now,
    setTimer: (fn, ms) => { const t = { at: now + ms, fn, done: false }; timers.push(t); return t },
    clearTimer: (t) => { if (t) t.done = true },
    advance(ms) {
      now += ms
      for (const t of timers) if (!t.done && t.at <= now) { t.done = true; t.fn() }
    },
  }
}

function pageStatement(predicate) {
  const file = 'src/app/(shell)/cunning/live/[sessionId]/page.tsx'
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  const ast = ts.createSourceFile('live.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let found
  const walk = (n) => { if (!found && predicate(n, ast)) found = n.getText(ast); ts.forEachChild(n, walk) }
  walk(ast)
  assert.ok(found, 'page statement not found')
  return found
}

;(async () => {
  const modes = load('src/lib/cunning/modes.ts')
  const throttleLib = load('src/lib/cunning/answer-throttle.ts')

  await check('自動回答の間隔は15〜20秒の定数', async () => {
    assert.ok(modes.AUTO_ANSWER_MIN_INTERVAL_MS >= 15000 && modes.AUTO_ANSWER_MIN_INTERVAL_MS <= 20000)
  })

  await check('全発話モードで短い間に発話が続いても、間隔内の回答APIは1回（間の発話はまとめて次の1回）', async () => {
    const flushDecl = pageStatement((n, ast) => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(ast) === 'flushUtterance'))
    const sendAssign = pageStatement((n, ast) => ts.isExpressionStatement(n) && ts.isBinaryExpression(n.expression) && n.expression.left.getText(ast) === 'autoAnswerSendRef.current')
    const clock = fakeClock()
    const questions = []
    const autoAnswerSendRef = { current: () => {} }
    const env = {
      exports: {},
      useCallback: (f) => f,
      pendingRef: { current: '' },
      pendingTranscriptIdsRef: { current: [] },
      modeRef: { current: 'idol' },
      getMode: () => ({ trigger: 'any' }),
      looksLikeQuestion: () => true,
      recordingVersionRef: { current: 2 },
      runningRef: { current: true },
      // 回答APIの呼び出し（/api/cunning/answer）を数える
      requestAnswer: async (q) => { questions.push(q); return true },
      autoAnswerSendRef,
      autoAnswerRef: { current: throttleLib.createAutoAnswerThrottle({
        intervalMs: modes.AUTO_ANSWER_MIN_INTERVAL_MS,
        send: (q) => autoAnswerSendRef.current(q),
        now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
      }) },
    }
    const code = ts.transpileModule(`${flushDecl};${sendAssign};exports.flush=flushUtterance;`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText
    vm.runInNewContext(code, env)

    const utterances = ['こんにちは元気ですか', '今日の配信楽しみにしてました', '次の曲は何ですか', '好きな食べ物を教えて', 'また来週も見ます']
    for (const u of utterances) {
      env.pendingRef.current = u
      env.exports.flush()
      clock.advance(2000) // 2秒おきに発話
    }
    assert.equal(questions.length, 1, '間隔内の回答は1回だけ')
    assert.equal(questions[0], utterances[0])
    clock.advance(modes.AUTO_ANSWER_MIN_INTERVAL_MS)
    assert.equal(questions.length, 2, '間隔が空いたらまとめて1回')
    for (const u of utterances.slice(1)) assert.ok(questions[1].includes(u), '間の発話は捨てずにまとめる')

    // 録音停止後（v2）はまとめ待ちを送らない
    env.pendingRef.current = '停止直前の発話です'
    env.exports.flush()
    env.runningRef.current = false
    clock.advance(modes.AUTO_ANSWER_MIN_INTERVAL_MS)
    assert.equal(questions.length, 2)
  })

  await check('取り消すとまとめ待ちの発話は送られない', async () => {
    const clock = fakeClock()
    let sent = 0
    const t = throttleLib.createAutoAnswerThrottle({ intervalMs: 20000, send: () => sent++, now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer })
    t.submit('最初の発話です'); t.submit('二つ目の発話です')
    t.cancel()
    clock.advance(60000)
    assert.equal(sent, 1)
    assert.equal(t.pending(), '')
  })

  await check('回答は gemini-2.5-flash を1回だけ呼び、出力上限800を渡す', async () => {
    const requests = []
    const answer = load('src/lib/cunning/answer.ts', {
      '@/lib/fetch-timeout': { withTimeout: async (_n, t, fn) => { assert.equal(t, 20000); return fn(new AbortController().signal) } },
      './modes': modes,
    }, {
      process: { env: { ...ENV } },
      fetch: async (url, options) => {
        requests.push({ url, body: JSON.parse(options.body), headers: options.headers })
        return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"summary":"要点","script":"話す内容"}' }] } }] }) }
      },
    })
    const result = await answer.generateAnswer({ mode: 'sales', question: '料金はいくらですか' })
    assert.equal(requests.length, 1)
    assert.ok(requests[0].url.includes('/models/gemini-2.5-flash:generateContent'))
    assert.equal(requests[0].body.generationConfig.maxOutputTokens, 800)
    assert.equal(requests[0].headers['x-goog-api-key'], ENV.GOOGLE_GENAI_API_KEY)
    assert.equal(result.model, 'gemini-2.5-flash')
    assert.equal(result.summary, '要点')
  })

  await check('回答が20秒で打ち切られても gpt-4o を呼ばず「作れませんでした」で返す', async () => {
    const urls = []
    const answer = load('src/lib/cunning/answer.ts', {
      '@/lib/fetch-timeout': { withTimeout: async (label, t, fn) => {
        const controller = new AbortController()
        const pending = fn(controller.signal)
        controller.abort()
        await pending.catch(() => {})
        throw new Error(`${label} timeout (${t}ms)`)
      } },
      './modes': modes,
    }, {
      process: { env: { ...ENV } },
      fetch: (url, options) => {
        urls.push(url)
        return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))))
      },
    })
    await assert.rejects(() => answer.generateAnswer({ mode: 'idol', question: 'こんにちは' }), (e) => e.cunningAnswerMayBeRunning === false)
    assert.equal(urls.length, 1)
    assert.equal(urls.filter(isOpenAi).length, 0)
  })

})().catch((error) => { console.error(error); process.exitCode = 1 })
