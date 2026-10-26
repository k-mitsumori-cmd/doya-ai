// AI（seo/lib/gemini.ts）とスライドの構成（/api/doyaslide/structure）の時間の上限を確かめる（2026-10-26 統括の指摘）。
// - 時間の値を渡さない呼び出しは、今までどおり（fetch に signal を付けない）
// - 締め切り（deadlineAt）を過ぎたら LlmDeadlineError を投げ、フォールバックへ進まない
// - 構成のルートは締め切りで止まると 504 を返し、プロジェクトを error に戻す（構成中のまま残さない）
// 外部 API は呼ばない（fetch は見本）。
// 実行: node scripts/security-regression/verify-llm-deadline.cjs
const assert = require('node:assert/strict')
const { z } = require('zod')
const { load, check } = require('./load-typescript.cjs')

const ENV = {
  ANTHROPIC_API_KEY: 'test-anthropic', GOOGLE_GENAI_API_KEY: 'test-google', OPENAI_API_KEY: 'test-openai',
  SEO_PRIMARY_LLM: '', SEO_CLAUDE_MODEL: '', SEO_GEMINI_TEXT_MODEL: '', SEO_GEMINI_CHAT_MODEL: '', SLACK_WEBHOOK_URL: '',
}
/** hang: true なら、signal で止められるまで返さない fetch */
function gemini({ hang }) {
  const calls = []
  const fetch = (url, init) => {
    calls.push({ url: String(url), init })
    if (!hang) return Promise.resolve(new Response(JSON.stringify({ content: [{ type: 'text', text: '{"ok":true}' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    return new Promise((_res, rej) => {
      const s = init && init.signal
      if (s) s.addEventListener('abort', () => rej(s.reason || new Error('aborted')))
    })
  }
  const mod = load('seo/lib/gemini.ts', { '@/lib/slack/notify': { postSlack: async () => true } }, { process: { env: ENV }, fetch, AbortSignal, setTimeout: (fn) => { fn(); return 0 } })
  return { mod, calls }
}
const req = (extra = {}) => ({ model: 'gemini-2.5-flash', parts: [{ text: 'hello' }], ...extra })
/** 止まらないときは、待ち続けずに失敗にする（直しが戻ったときに、確かめが止まったままにならないように） */
const within = (p, ms = 5000) => Promise.race([p, new Promise((_r, rej) => setTimeout(() => rej(new Error(`did not stop within ${ms}ms`)), ms))])

;(async () => {
  // AbortSignal.timeout のタイマーは、プロセスを生かしておかない（サーバーでは、リクエストの間は動き続ける）。確かめの間だけ生かす
  const keepAlive = setInterval(() => {}, 1000)
  await check('LLM: without time options, fetch is called exactly as before (no signal)', async () => {
    const g = gemini({ hang: false })
    assert.equal(await g.mod.geminiGenerateText(req()), '{"ok":true}')
    assert.equal(g.calls.length, 1)
    assert.equal(g.calls[0].init.signal, undefined)
    assert.deepEqual(Object.keys(g.calls[0].init).sort(), ['body', 'headers', 'method'])
  })

  await check('LLM: the overall deadline throws LlmDeadlineError and does not fall back to other providers', async () => {
    const g = gemini({ hang: true })
    const t = Date.now()
    await assert.rejects(() => within(g.mod.geminiGenerateText(req({ deadlineAt: Date.now() + 80 }))), (e) => e.name === 'LlmDeadlineError')
    assert.ok(Date.now() - t < 2000, 'stops near the deadline')
    assert.equal(g.calls.length, 1, 'no Gemini / OpenAI fallback after the deadline')
    assert.ok(g.calls[0].init.signal, 'fetch gets a signal')
    // JSON の呼び出しも同じ締め切りを使う（修正の呼び出しへ進まない）
    const j = gemini({ hang: true })
    await assert.rejects(() => within(j.mod.geminiGenerateJson({ model: 'gemini-2.5-flash', prompt: 'p', deadlineAt: Date.now() + 80 }, 'X')), (e) => e.name === 'LlmDeadlineError')
    assert.equal(j.calls.length, 1)
    // 締め切りを過ぎてから呼んだら、送らない
    const late = gemini({ hang: true })
    await assert.rejects(() => within(late.mod.geminiGenerateText(req({ deadlineAt: Date.now() - 1 }))), (e) => e.name === 'LlmDeadlineError')
    assert.equal(late.calls.length, 0)
  })

  await check('LLM: a per-request timeout alone stops each request and keeps the request budget (8 at most)', async () => {
    const g = gemini({ hang: true })
    const t = Date.now()
    await assert.rejects(() => within(g.mod.geminiGenerateText(req({ requestTimeoutMs: 20 }))), (e) => e.name !== 'LlmDeadlineError')
    assert.ok(Date.now() - t < 3000)
    assert.ok(g.calls.length >= 1 && g.calls.length <= 8, String(g.calls.length))
    assert.ok(g.calls.every((c) => c.init.signal))
  })

  await check('DoyaSlide structure: passes the deadline and timeouts, and a deadline returns 504 and releases the project to error', async () => {
    let project = { id: 'p1', userId: 'u', title: '提案', customBrief: null, docType: 'proposal', slideCount: 2, status: 'draft', updatedAt: new Date(0) }
    const matches = (w) => project.id === w.id && (!w.status || project.status === w.status) && (!w.updatedAt || project.updatedAt.getTime() === w.updatedAt.getTime())
    const store = {
      findFirst: async ({ where }) => (matches(where) ? { ...project } : null),
      updateMany: async ({ where, data }) => { if (!matches(where)) return { count: 0 }; project = { ...project, ...data }; return { count: 1 } },
      update: async ({ data }) => { project = { ...project, ...data }; return project },
    }
    const tx = { doyaSlideProject: store, doyaSlideSlide: { count: async () => 0, createMany: async () => ({}), findMany: async () => [] } }
    let llmArgs, searchArgs
    const route = load('src/app/api/doyaslide/structure/route.ts', {
      'next/server': { NextResponse: Response }, zod: { z },
      '@/lib/prisma': { prisma: { ...tx, $transaction: async (fn) => fn(tx) } },
      '@seo/lib/gemini': { GEMINI_TEXT_MODEL_DEFAULT: 'test', CLAUDE_MODEL_LIGHT: '', geminiGenerateJson: async (a) => { llmArgs = a; throw Object.assign(new Error('LLM call deadline exceeded'), { name: 'LlmDeadlineError' }) } },
      '@/lib/doyaslide/access': { getUserId: async () => 'u' },
      '@/lib/doyaslide/text-budget': { reserveDoyaSlideTextCall: async () => {}, DoyaSlideTextLimitError: class extends Error {} },
      '@/lib/doyaslide/prompts': { buildStructurePrompt: () => 'prompt' },
      '@/lib/doyaslide/scrape': { scrapeUrlText: async () => ({ title: '', text: '' }) },
      '@seo/lib/serpapi': { hasSerpApiKey: () => true, serpapiSearchGoogle: async (a) => { searchArgs = a; return { organic: [] } } },
      '@/lib/doyaslide/errors': { errorSuffix: () => '' },
    })
    const t = Date.now()
    const res = await route.POST({ headers: new Headers(), json: async () => ({ projectId: 'p1' }) })
    assert.equal(res.status, 504)
    assert.equal((await res.json()).code, 'DOYASLIDE_STRUCTURE_TIMEOUT')
    assert.equal(project.status, 'error', 'the project must not stay in structuring')
    assert.ok(llmArgs.deadlineAt >= t + 239_000 && llmArgs.deadlineAt <= Date.now() + 240_000, 'deadline is 240 seconds from the start')
    assert.equal(llmArgs.requestTimeoutMs, 150_000)
    assert.equal(searchArgs.timeoutMs, 10_000)
  })
  // 2026-10-26 本番の B1: 見積とスライド（tier=light → claude-haiku-5-5）が temperature のせいで 400 になり、Gemini に落ちていた
  await check('LLM: no temperature for models that reject non-default sampling; unchanged for the default model; the fallback log has only the status', async () => {
    const bodies = []
    const warns = []
    const mod = load('seo/lib/gemini.ts', {}, {
      process: { env: ENV }, AbortSignal, setTimeout: (fn) => { fn(); return 0 },
      console: { log() {}, error() {}, warn: (...a) => warns.push(a.join(' ')) },
      fetch: async (url, init) => {
        const body = JSON.parse(init.body)
        bodies.push(body)
        const status = String(url).includes('anthropic') && body.model === 'claude-sonnet-5-5' ? 400 : 200
        return new Response(JSON.stringify(status === 400 ? { error: { message: 'secret detail' } } : { content: [{ type: 'text', text: 'ok' }] }), { status, headers: { 'Content-Type': 'application/json' } })
      },
    })
    for (const m of ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-sonnet-5', 'claude-opus-5-5', 'claude-opus-4-8', 'claude-fable-5-1']) assert.equal(mod.claudeAcceptsTemperature(m), false, m)
    for (const m of ['claude-haiku-4-5-20251001', 'claude-haiku-4-5', 'claude-sonnet-4-6', 'claude-opus-4-6']) assert.equal(mod.claudeAcceptsTemperature(m), true, m)
    await mod.geminiGenerateText(req({ claudeModel: 'claude-haiku-5-5' }))
    assert.equal(bodies[0].model, 'claude-haiku-5-5')
    assert.equal('temperature' in bodies[0], false)
    bodies.length = 0
    await mod.geminiGenerateText(req())
    assert.equal(bodies[0].model, 'claude-haiku-4-5-20251001')
    assert.equal(bodies[0].temperature, 0.4, 'the default model keeps its temperature')
    // 400 で Gemini に落ちたときのログは、状態コードだけ（応答の本文は書かない）
    await mod.geminiGenerateText(req({ claudeModel: 'claude-sonnet-5-5' }))
    const line = warns.find((w) => w.includes('Primary failed'))
    assert.equal(line, '[Claude] Primary failed (status 400), falling back to Gemini')
    assert.equal(warns.join('\n').includes('secret detail'), false)
  })
  clearInterval(keepAlive)
})().catch((e) => { console.error(e); process.exit(1) })
