// seo/lib/gemini.ts のテキスト生成ラッパーが、1回の呼び出しで外部APIへ送るリクエストの数と出力上限を確かめる。
// 外部APIは呼ばない。fetch をモックにして、提供元ごとの呼び出し回数と送った本文を数える。
const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

const ENV = {
  ANTHROPIC_API_KEY: 'test-anthropic',
  GOOGLE_GENAI_API_KEY: 'test-google',
  OPENAI_API_KEY: 'test-openai',
  SEO_PRIMARY_LLM: '',
  SEO_CLAUDE_MODEL: '',
  SEO_GEMINI_TEXT_MODEL: '',
  SEO_GEMINI_CHAT_MODEL: '',
  SLACK_WEBHOOK_URL: '',
}

const provider = (url) =>
  url.startsWith('https://api.anthropic.com/') ? 'claude'
    : url.startsWith('https://generativelanguage.googleapis.com/') ? 'gemini'
      : url.startsWith('https://api.openai.com/') ? 'openai'
        : 'other'

const claudeText = (text) => ({ content: text ? [{ type: 'text', text }] : [] })
const geminiText = (text) => ({ candidates: [{ content: { parts: text ? [{ text }] : [] } }] })
const openaiText = (text) => ({ choices: [{ message: { content: text } }] })

// respond(provider, body, url) → { status, json }
function fixture(respond, env = {}) {
  const calls = []
  const fetch = async (url, init) => {
    const p = provider(String(url))
    const body = init && init.body ? JSON.parse(init.body) : null
    calls.push({ provider: p, url: String(url), body })
    const r = respond(p, body, String(url))
    return new Response(JSON.stringify(r.json ?? {}), { status: r.status ?? 200, headers: { 'Content-Type': 'application/json' } })
  }
  // Slack 送信は共通の送り口を通る。SLACK_WEBHOOK_URL は空なので呼ばれないが、呼ばれたら fetch に流して数える。
  const mod = load('seo/lib/gemini.ts', { '@/lib/slack/notify': { postSlack: async (url, payload) => { await fetch(url, { method: 'POST', body: JSON.stringify(payload) }); return 'sent' } } }, {
    process: { env: { ...ENV, ...env } },
    fetch,
    setTimeout: (fn) => { fn(); return 0 },
  })
  const count = (p) => calls.filter((c) => c.provider === p).length
  return { mod, calls, count }
}

const req = (extra = {}) => ({ model: 'gemini-2.5-flash', parts: [{ text: 'hello' }], ...extra })

;(async () => {
  await check('limits add up to eight requests per text call and sixteen per JSON call', async () => {
    const { mod } = fixture(() => ({ status: 500 }))
    assert.equal(mod.TEXT_CALL_MAX_REQUESTS, 8)
    assert.equal(mod.JSON_CALL_MAX_REQUESTS, 16)
    assert.equal(mod.TEXT_MAX_OUTPUT_TOKENS_DEFAULT, 4096)
    assert.equal(mod.TEXT_MAX_OUTPUT_TOKENS_CEILING, 16384)
    assert.equal(mod.OPENAI_FALLBACK_MODEL, 'gpt-4o-mini')
  })

  await check('all providers rate limited sends at most eight requests (Claude 3, Gemini 2x2, OpenAI 1)', async () => {
    const f = fixture(() => ({ status: 429 }))
    await assert.rejects(() => f.mod.geminiGenerateText(req()))
    assert.equal(f.count('claude'), 3)
    assert.equal(f.count('gemini'), 4)
    assert.equal(f.count('openai'), 1)
    assert.equal(f.calls.length, f.mod.TEXT_CALL_MAX_REQUESTS)
    assert.equal(new Set(f.calls.filter((c) => c.provider === 'gemini').map((c) => c.url)).size, 2)
  })

  await check('server errors stay within the budget', async () => {
    const f = fixture(() => ({ status: 500 }))
    await assert.rejects(() => f.mod.geminiGenerateText(req()))
    assert.equal(f.count('claude'), 3)
    assert.ok(f.count('gemini') <= 4)
    assert.equal(f.count('openai'), 1)
    assert.ok(f.calls.length <= f.mod.TEXT_CALL_MAX_REQUESTS)
  })

  await check('empty responses retry Claude only once and stay within the budget', async () => {
    const f = fixture((p) => ({ status: 200, json: p === 'claude' ? claudeText('') : p === 'gemini' ? geminiText('') : openaiText('') }))
    assert.equal(await f.mod.geminiGenerateText(req()), '')
    assert.equal(f.count('claude'), 2)
    assert.equal(f.count('gemini'), 2)
    assert.equal(f.count('openai'), 1)
    assert.ok(f.calls.length <= f.mod.TEXT_CALL_MAX_REQUESTS)
  })

  await check('Claude success makes exactly one request with the 4,096 default output limit', async () => {
    const f = fixture(() => ({ status: 200, json: claudeText('ok') }))
    assert.equal(await f.mod.geminiGenerateText(req()), 'ok')
    assert.equal(f.calls.length, 1)
    assert.equal(f.calls[0].body.max_tokens, 4096)
  })

  await check('caller output limits are passed through and capped at 16,384', async () => {
    const f = fixture(() => ({ status: 200, json: claudeText('ok') }))
    await f.mod.geminiGenerateText(req({ generationConfig: { maxOutputTokens: 8192 } }))
    await f.mod.geminiGenerateText(req({ generationConfig: { maxOutputTokens: 65536 } }))
    assert.deepEqual(f.calls.map((c) => c.body.max_tokens), [8192, 16384])
  })

  await check('Gemini fallback receives the same output limit', async () => {
    const f = fixture((p) => p === 'claude' ? { status: 400, json: {} } : { status: 200, json: geminiText('from gemini') })
    assert.equal(await f.mod.geminiGenerateText(req({ generationConfig: { maxOutputTokens: 6000 } })), 'from gemini')
    assert.equal(f.count('claude'), 1)
    assert.equal(f.count('gemini'), 1)
    assert.equal(f.calls[1].body.generationConfig.maxOutputTokens, 6000)
  })

  await check('last resort is gpt-4o-mini with the resolved output limit', async () => {
    const f = fixture((p) => p === 'openai' ? { status: 200, json: openaiText('from openai') } : { status: 400, json: {} })
    assert.equal(await f.mod.geminiGenerateText(req()), 'from openai')
    const openai = f.calls.filter((c) => c.provider === 'openai')
    assert.equal(openai.length, 1)
    assert.equal(openai[0].body.model, 'gpt-4o-mini')
    assert.equal(openai[0].body.max_tokens, 4096)
  })

  await check('JSON repair calls once more with the original output limit, never 65,536', async () => {
    const f = fixture(() => ({ status: 200, json: claudeText('this is not json at all') }))
    await assert.rejects(() => f.mod.geminiGenerateJson({ model: 'gemini-2.5-flash', prompt: 'x' }))
    assert.equal(f.calls.length, 2)
    assert.deepEqual(f.calls.map((c) => c.body.max_tokens), [4096, 4096])
  })

  await check('JSON repair keeps a caller-provided output limit', async () => {
    const f = fixture(() => ({ status: 200, json: claudeText('broken') }))
    await assert.rejects(() => f.mod.geminiGenerateJson({ model: 'gemini-2.5-flash', prompt: 'x', generationConfig: { maxOutputTokens: 8192 } }))
    assert.deepEqual(f.calls.map((c) => c.body.max_tokens), [8192, 8192])
  })

  await check('JSON worst case stays within sixteen requests', async () => {
    const f = fixture((p) => p === 'openai' ? { status: 200, json: openaiText('broken') } : { status: 429 })
    await assert.rejects(() => f.mod.geminiGenerateJson({ model: 'gemini-2.5-flash', prompt: 'x' }))
    assert.equal(f.calls.length, f.mod.JSON_CALL_MAX_REQUESTS)
    assert.ok(f.calls.every((c) => (c.body.max_tokens ?? c.body.generationConfig.maxOutputTokens) === 4096))
  })

  await check('valid JSON needs no repair call', async () => {
    const f = fixture(() => ({ status: 200, json: claudeText('{"a":1}') }))
    assert.equal(JSON.stringify(await f.mod.geminiGenerateJson({ model: 'gemini-2.5-flash', prompt: 'x' })), '{"a":1}')
    assert.equal(f.calls.length, 1)
  })

  console.log(JSON.stringify({ passed: results.length }))
})().catch((e) => { console.error(e); process.exitCode = 1 })
