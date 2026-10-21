process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const React = require('react')
const { JSDOM } = require('jsdom')
const { createRoot } = require('react-dom/client')
const { load, check, results } = require('./load-typescript.cjs')
const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://example.invalid/banner' })
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
const operationId = '123e4567-e89b-42d3-a456-426614174000'
const actorId = 'actor1'
const key = `doya-subscription-operation-v1:${actorId}`
const replies = []
const requests = []
let currentActorId = actorId
const result = (phase, reason = null) => ({ actorId, operationId, kind: 'cancel', phase, reason,
  actions: phase === 'missing' ? [] : [{ subscriptionId: 'sub_a', phase: phase === 'completed' ? 'confirmed' : 'dispatched', status: phase === 'completed' ? 'scheduled_cancel' : null }],
  canAbort: phase === 'missing', canContinue: false })
const parser = load('src/lib/subscription-mutation-client.ts', {
  './billing-response-client': { BillingResponseError: class BillingResponseError extends Error {} },
  './subscription-status-client': { parseSubscriptionStatus: () => ({ hasSubscription: true }) },
})
let currentHook, refreshes = 0
const hook = load('src/hooks/useSubscriptionManagement.ts', {
  react: React, 'next-auth/react': { useSession: () => ({ status: 'authenticated', data: { user: { id: currentActorId } } }) },
  '@/lib/billing-response-client': { readBillingResponse: async (_url, init) => {
    const body = JSON.parse(init.body); requests.push(body)
    if (body.action === 'start') assert.equal(JSON.parse(dom.window.localStorage.getItem(key)).operationId, operationId)
    return { ok: true, status: 200, data: await (replies.shift() || result('completed')) }
  } },
  '@/lib/subscription-mutation-client': parser,
  '@/hooks/useSubscriptionStatus': { useSubscriptionStatus: () => ({ data: { hasSubscription: true, subscriptionId: 'sub_a', status: 'active', cancelAtPeriodEnd: false, currentPeriodEnd: 1900000000 },
    loading: false, error: null, refresh: () => { refreshes++ } }) },
}, { window: dom.window, navigator: { locks: { request: async (_key, _options, work) => work({}) } },
  crypto: { randomUUID: () => operationId }, CustomEvent: dom.window.CustomEvent, AbortController })
const tick = () => new Promise(resolve => setImmediate(resolve))
async function mount() {
  const element = document.createElement('div'); document.body.append(element)
  const root = createRoot(element)
  const Probe = () => { currentHook = hook.useSubscriptionManagement('banner'); return null }
  await React.act(async () => { root.render(React.createElement(Probe)); await tick(); await tick() })
  const close = async () => { await React.act(async () => { root.unmount(); await tick() }); element.remove() }
  close.rerender = async () => { await React.act(async () => { root.render(React.createElement(Probe)); await tick() }) }
  return close
}
;(async () => {
  await check('fresh start persists actor handle before HTTP and confirms exact result', async () => {
    const close = await mount()
    assert.equal(requests.length, 0)
    await React.act(async () => { await currentHook.run('cancel'); await tick() })
    assert.equal(requests.filter(r => r.action === 'start').length, 1)
    assert.equal(JSON.parse(dom.window.localStorage.getItem(key)).phase, 'completed')
    assert.ok(refreshes > 0)
    await close()
  })
  await check('reload observes saved operation by status only', async () => {
    replies.push(result('completed'))
    const before = requests.length
    const close = await mount()
    assert.equal(requests.length, before + 1)
    assert.equal(requests.at(-1).action, 'status')
    await close()
  })
  await check('unknown persisted operation blocks a new UUID and uses status only', async () => {
    dom.window.localStorage.setItem(key, JSON.stringify({ version: 1, actorId, operationId, kind: 'cancel', serviceId: 'banner', phase: 'executing' }))
    replies.push(result('executing', 'EXTERNAL_UNKNOWN'))
    const before = requests.length
    const close = await mount()
    assert.equal(requests.length, before + 1)
    assert.equal(requests.at(-1).action, 'status')
    await React.act(async () => { assert.equal(await currentHook.run('cancel'), null); await tick() })
    assert.equal(requests.length, before + 1)
    assert.equal(currentHook.uncertain, true)
    await close()
  })
  await check('old actor public completion is null after A to B to A and cannot promote caller success', async () => {
    dom.window.localStorage.clear()
    let release
    replies.push(new Promise(resolve => { release = resolve }))
    const close = await mount()
    let pending
    await React.act(async () => { pending = currentHook.run('cancel'); await tick() })
    assert.equal(requests.at(-1).action, 'start')
    currentActorId = 'actor2'; await close.rerender()
    currentActorId = actorId; await close.rerender()
    await React.act(async () => { release(result('completed')); assert.equal(await pending, null); await tick() })
    assert.equal(JSON.parse(dom.window.localStorage.getItem(key)).phase, 'completed')
    await close()
  })
  await check('pagehide suppresses old public success even if transport settles late', async () => {
    dom.window.localStorage.clear()
    let release
    replies.push(new Promise(resolve => { release = resolve }))
    const close = await mount()
    let pending
    await React.act(async () => { pending = currentHook.run('cancel'); await tick() })
    dom.window.dispatchEvent(new dom.window.Event('pagehide'))
    await React.act(async () => { release(result('completed')); assert.equal(await pending, null); await tick() })
    await close()
  })
  console.log(JSON.stringify({ passed: results.length, scope: 'actual management hook with synthetic session/status/HTTP/storage; no SDK or DB' }))
})().catch(error => { console.error(error); process.exitCode = 1 })
