'use strict'
// Actual helper and page regression fixture. DOYA_TEST_BASELINE is only for a partial Git-outside candidate.
const fixtureFs = require('node:fs')
const fixturePath = require('node:path')
const projectRoot = fixturePath.resolve(__dirname, '../..')
const baselineRoot = process.env.DOYA_TEST_BASELINE || projectRoot
const moduleRoot = fixtureFs.existsSync(fixturePath.join(projectRoot, 'node_modules/react')) ? projectRoot : baselineRoot
function sourcePath(relative) {
  const primary = fixturePath.join(projectRoot, relative)
  if (fixtureFs.existsSync(primary)) return primary
  const fallback = fixturePath.join(baselineRoot, relative)
  if (fixtureFs.existsSync(fallback)) return fallback
  throw Error(`Missing actual source ${relative}`)
}

function runNotices() {
'use strict'
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const crypto = require('node:crypto')
const { createRequire } = require('node:module')
const repo = moduleRoot
const candidate = projectRoot
const req = createRequire(path.join(repo, 'package.json'))
const React = req('react')
const ts = req('typescript')
const { renderToStaticMarkup } = req('react-dom/server')
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const sourceHashes = {}
function load(rel) {
  const filename = sourcePath(rel)
  const source = fs.readFileSync(filename)
  sourceHashes[rel] = hash(source)
  const exports = {}
  const js = ts.transpileModule(source.toString('utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  vm.runInNewContext(js, {
    exports,
    require: id => {
      if (id === 'react/jsx-runtime') return req('react/jsx-runtime')
      if (id === '@/components/ds') return {
        Button: ({ href, children }) => React.createElement('a', { href }, children),
        ErrorNotice: ({ what, how }) => React.createElement('div', null, what, how),
      }
      throw Error(`unmocked ${id}`)
    },
    fetch: () => { throw Error('network forbidden') },
    console,
  }, { filename })
  return exports
}
const a = load('src/components/aishodan/failure.tsx')
const m = load('src/components/mensetsu/states.tsx')
const links = html => [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1].replaceAll('&amp;', '&'))
const cases = []
function check(name, component, props, expected) {
  const html = renderToStaticMarkup(React.createElement(component, props))
  assert.deepEqual(links(html), expected, name)
  cases.push({ name, hrefs: links(html) })
}
check('aishodan scoped limit', a.AishodanFailureNotice,
  { failure: a.describeAishodanFailure(402, '失敗', { limit: true }), pricingHref: '/aishodan/pricing?org=A' },
  ['/aishodan/pricing?org=A'])
check('aishodan scoped auth', a.AishodanFailureNotice,
  { failure: a.describeAishodanFailure(401, '失敗'), returnHref: '/aishodan/scenarios/S1?org=A' },
  ['/auth/signin?callbackUrl=%2Faishodan%2Fscenarios%2FS1%3Forg%3DA'])
check('aishodan unverified quota lacks action', a.AishodanFailureNotice,
  { failure: a.describeAishodanFailure(429, '失敗') }, [])
check('aishodan no proof lacks login action', a.AishodanFailureNotice,
  { failure: a.describeAishodanFailure(401, '失敗') }, [])
check('mensetsu scoped limit', m.LoadIssueNotice,
  { issue: m.loadIssueOf(402), subject: '面接の情報', pricingHref: '/mensetsu/pricing?org=A' },
  ['/mensetsu/pricing?org=A'])
check('mensetsu scoped auth', m.LoadIssueNotice,
  { issue: m.loadIssueOf(401), subject: '評価レポート', returnHref: '/mensetsu/sessions/S1?org=A' },
  ['/auth/signin?callbackUrl=%2Fmensetsu%2Fsessions%2FS1%3Forg%3DA'])
check('mensetsu unknown guidance lacks pricing action', m.LoadIssueNotice,
  { issue: m.loadIssueOf(429), subject: '評価レポート' }, [])
console.log(JSON.stringify({ cases, sourceHashes, scope: 'Actual notice components rendered with React SSR and synthetic validated caller hrefs; full Boundary/page, browser, and API not run.' }))

return 7
}

async function runSettings() {
'use strict'
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const crypto = require('node:crypto')
const repo = moduleRoot
const candidate = projectRoot
const req = Module.createRequire(path.join(repo, 'package.json'))
const React = req('react'), ts = req('typescript'), { JSDOM } = req('jsdom'), { createRoot } = req('react-dom/client')
const dom = new JSDOM('<main id="root"></main>', { url: 'https://example.invalid/mensetsu/settings?org=A' })
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
const sha = value => crypto.createHash('sha256').update(value).digest('hex')
const loaded = {}, moduleCache = new Map()
let proofVersion = 1, firstRead, nextFailure = false
const reads = []
const makeProof = () => {
  const captured = proofVersion
  return { actorId: 'actor-A', organization: { id: 'org-A', slug: 'A', name: 'Org A', role: 'owner' }, revision: captured,
    current: () => captured === proofVersion, href: value => `${value}?org=A`, api: value => `${value}?org=A` }
}
let currentProof = makeProof()
const no = () => null
const UI = {
  Button: ({ href, children, ...props }) => href ? React.createElement('a', { ...props, href }, children) : React.createElement('button', props, children),
  EmptyState: ({ children }) => React.createElement('div', null, children),
  ErrorNotice: ({ what, how, onRetry, retryLabel }) => React.createElement('div', { role: 'alert' }, what, how, onRetry && React.createElement('button', { onClick: onRetry }, retryLabel)),
  Skeleton: () => React.createElement('div', { 'data-skeleton': true }),
}
const org = { id: 'org-A', slug: 'A', name: 'Org A', role: 'owner', retentionDays: 30, recordAudio: false, discloseToCandidate: false }
const request = async (url, init) => {
  assert.equal(init?.method || 'GET', 'GET', 'read-only fixture')
  reads.push(String(url))
  if (String(url) === '/api/mensetsu/organizations') {
    if (firstRead) { const held = firstRead; firstRead = null; return held.promise }
    if (nextFailure) { nextFailure = false; return Response.json({ error: '現在の読取失敗' }, { status: 500 }) }
    return Response.json({ current: org })
  }
  if (String(url) === '/api/mensetsu/members') return Response.json({ myUserId: 'actor-A', myRole: 'owner', members: [] })
  throw Error(`unexpected ${url}`)
}
const mocks = {
  react: React, 'react/jsx-runtime': req('react/jsx-runtime'),
  'next/link': { __esModule: true, default: ({ href, children, ...props }) => React.createElement('a', { ...props, href }, children) },
  'next-auth/react': { useSession: () => ({ status: 'authenticated', data: { user: { id: 'actor-A', name: 'Actor A' } } }) },
  '@/components/mensetsu/ui-next': { PageTitle: ({ children }) => React.createElement('h1', null, children), useToolUiNext: () => true },
  '@/components/ds': UI,
  '@/components/mensetsu/useMensetsuRequest': { useMensetsuRequest: () => ({ proof: currentProof, request }) },
  '@/components/mensetsu/MensetsuWorkspaceBoundary': { useMensetsuWorkspace: () => ({ retry() {} }) },
  '@/components/mensetsu/useMensetsuOperation': { useMensetsuOperation: () => ({ unknown: false, begin() { throw Error('write forbidden') } }) },
  '@/components/org/OwnerTransferPanel': { __esModule: true, default: no },
  '@/lib/ui/notify': { notifyError: (setter, message) => setter(message) },
}
function load(relative) {
  if (moduleCache.has(relative)) return moduleCache.get(relative).exports
  const filename = sourcePath(relative)
  const bytes = fs.readFileSync(filename)
  loaded[relative] = sha(bytes)
  const mod = new Module(filename); mod.filename = filename; moduleCache.set(relative, mod)
  mod.require = id => {
    if (id in mocks) return mocks[id]
    if (id === '@/components/mensetsu/states') return load('src/components/mensetsu/states.tsx')
    throw Error(`unmocked ${id}`)
  }
  mod._compile(ts.transpileModule(bytes.toString('utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename)
  return mod.exports
}
const Page = load('src/app/(shell)/mensetsu/settings/page.tsx').default
const root = createRoot(document.getElementById('root'))
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const render = () => React.act(async () => { root.render(React.createElement(Page)); await new Promise(setImmediate); await new Promise(setImmediate) })
const flush = () => React.act(async () => { await new Promise(setImmediate); await new Promise(setImmediate) })

  firstRead = deferred()
  const oldRead = firstRead
  await render()
  assert.equal(reads.length, 1)
  proofVersion = 2; currentProof = makeProof(); await render()
  assert.ok(document.body.textContent.includes('Org A'), 'fresh settings data visible')
  await React.act(async () => { oldRead.reject(Error('late old settings GET')); await new Promise(setImmediate) })
  assert.equal(document.body.textContent.includes('設定を読み込めませんでした'), false, 'late old rejection cannot replace fresh settings')
  proofVersion = 3; currentProof = makeProof(); nextFailure = true; await render(); await flush()
  assert.ok(document.querySelector('[role="alert"]'), 'current HTTP failure visible over existing settings')
  await React.act(async () => root.unmount())
  proofVersion = 4; currentProof = makeProof(); nextFailure = true
  const freshRoot = createRoot(document.getElementById('root'))
  const renderFresh = () => React.act(async () => { freshRoot.render(React.createElement(Page)); await new Promise(setImmediate); await new Promise(setImmediate) })
  await renderFresh()
  assert.ok(document.querySelector('[role="alert"]'), 'fresh page current failure visible')
  const retry = [...document.querySelectorAll('button')].find(button => button.textContent.includes('再読み込み') || button.textContent.includes('やり直す'))
  assert.ok(retry, 'current failure has retry')
  await React.act(async () => { retry.click(); await new Promise(setImmediate) })
  assert.ok(document.body.textContent.includes('Org A'), 'current retry restores settings')
  assert.equal(reads.filter(url => url === '/api/mensetsu/organizations').length, 5)
  console.log(JSON.stringify({ passed: 4, loaded, scope: 'Actual Settings page + actual LoadIssueNotice mounted with synthetic proof and read transport; no Boundary/auth/DB/provider.' }))
  await React.act(async () => freshRoot.unmount()); dom.window.close()

return 4
}

async function runTemplate() {
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module')
const root = moduleRoot, candidate = projectRoot, req = Module.createRequire(path.join(root, 'package.json'))
const React = req('react'), ts = req('typescript'), { JSDOM } = req('jsdom'), { createRoot } = req('react-dom/client')
const dom = new JSDOM('<main id="root"></main>', { url: 'https://example.invalid/mensetsu/sessions/session-B?org=B' })
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
let actor = 'actor-A', status = 'authenticated', pathname = '/mensetsu/templates/template-B', search = '?org=B', remembered = null
let snapshot = { phase: 'idle', handle: null }, calls = [], pushes = [], replaces = [], mounts = 0
const router = { push: href => pushes.push(href), replace: href => replaces.push(href) }
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const writes = []
let transportMode = false
const transportWrites = []
const templateReads = []
let deferNextTemplateRead = false
global.fetch = async (target, init) => {
  assert.equal(new URL(String(target), 'https://example.invalid').searchParams.get('org'), 'B')
  const held = deferred(); transportWrites.push({ target, init, held }); return held.promise
}
const read = (expected, selected, signal, service) => {
  if (calls.length > 60) throw Error('unexpected workspace read loop')
  const held = deferred(); calls.push({ expected, selected, signal, service, held }); return held.promise
}
const cache = new Map()
const mocks = {
  react: React, 'react/jsx-runtime': req('react/jsx-runtime'),
  'next/link': { __esModule: true, default: ({ href, children, ...props }) => React.createElement('a', { ...props, href }, children) },
  '@/components/SignInReturnLink': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', { ...props, href: '/auth/signin' }, children) },
  'next-auth/react': { useSession: () => ({ status, data: status === 'authenticated' ? { user: { id: actor } } : null }) },
  'next/navigation': { usePathname: () => pathname, useSearchParams: () => new URLSearchParams(search), useRouter: () => router, useParams: () => ({ id: 'template-B' }) },
  '@/components/org/OrgSwitcher': { getSelectedOrg: () => remembered, selectOrganization: (service, slug) => { assert.equal(service, 'mensetsu'); remembered = slug } },
  '@/lib/ui/guest-path': { isGuestPath: value => /^\/mensetsu\/(?:live|invite)\//.test(value) },
  '@/lib/organization-workspace-client': {
    readOrganizationWorkspace: read,
    selectedWorkspaceFromUrl: (raw, stored) => { const selection = load('src/lib/organization-workspace-selection.ts').organizationSelection(raw); return selection.kind !== 'absent' ? selection : stored ? { kind: 'selected', slug: stored } : selection },
    WorkspaceReadError: class WorkspaceReadError extends Error { constructor(status, kind) { super(); this.status = status; this.kind = kind } },
  },
  '@/components/CheckoutRecoveryProvider': { useCheckoutRecovery: () => ({ manager: { inspectStored() {} }, snapshot }) },
  '@/lib/checkout-recovery-client': { checkoutStoredIntent: () => ({ serviceId: 'mensetsu', organization: null }) },
  '@/components/mensetsu/ui-next': { PageTitle: ({ children, ...props }) => React.createElement('h1', props, children), useToolUiNext: () => true },
  '@/components/ds': {
    Button: ({ href, children, ...props }) => href ? React.createElement('a', { href, ...props }, children) : React.createElement('button', props, children),
    EmptyState: ({ children }) => React.createElement('div', null, children),
    ErrorNotice: ({ what, how, onRetry, retryLabel }) => React.createElement('div', { role: 'alert' }, what, how, onRetry && React.createElement('button', { onClick: onRetry }, retryLabel)),
    Skeleton: () => React.createElement('div', { 'data-skeleton': 'true' }),
  },
  '@/lib/ui/notify': { notifyError: (setter, message) => setter(message) },
}
function load(relative) {
  if (cache.has(relative)) return cache.get(relative).exports
  const filename = sourcePath(relative), m = new Module(filename)
  cache.set(relative, m)
  m.require = id => {
    if (id in mocks) return mocks[id]
    if (id === '@/lib/organization-workspace-selection') return load('src/lib/organization-workspace-selection.ts')
    if (id === '@/lib/mensetsu/checkout-origin-hint') return load('src/lib/mensetsu/checkout-origin-hint.ts')
    if (id === '@/components/mensetsu/states') return load('src/components/mensetsu/states.tsx')
    if (id === '@/components/mensetsu/MensetsuWorkspaceBoundary') return load('src/components/mensetsu/MensetsuWorkspaceBoundary.tsx')
    if (id === './MensetsuWorkspaceBoundary') return load('src/components/mensetsu/MensetsuWorkspaceBoundary.tsx')
    if (id === '@/components/mensetsu/useMensetsuRequest') return load('src/components/mensetsu/useMensetsuRequest.ts')
    if (id === '@/components/mensetsu/useMensetsuOperation') return load('src/components/mensetsu/useMensetsuOperation.ts')
    if (id === '@/lib/mensetsu/staff-request-client') return { requestMensetsuStaff: (proof, path, init) => {
      assert.equal(proof.current(), true)
      assert.equal(path, '/api/mensetsu/templates/template-B')
      if (init?.method === 'PATCH') {
        if (transportMode) return load('src/lib/mensetsu/staff-request-client.ts').requestMensetsuStaff(proof, path, init)
        const held = deferred(); writes.push({ proof, held }); return held.promise
      }
      assert.equal(init?.method || 'GET', 'GET')
      if (deferNextTemplateRead) {
        deferNextTemplateRead = false
        const held = deferred(); templateReads.push(held); return held.promise
      }
      return Promise.resolve(Response.json({ template: { id: 'template-B', name: 'Original B', jobTitle: 'Engineer', status: 'draft', intro: '', closing: '', questions: [], criteria: [] } }))
    } }
    throw Error('Unmocked ' + id)
  }
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename)
  return m.exports
}
const boundary = load('src/components/mensetsu/MensetsuWorkspaceBoundary.tsx')
const Template = load('src/app/(shell)/mensetsu/templates/[id]/page.tsx').default
const orgs = [{ id: 'orgA', slug: 'A', name: 'Org A', role: 'owner' }, { id: 'orgB', slug: 'B', name: 'Org B', role: 'member' }]
const payload = (user, slug) => ({ service: 'mensetsu', actorId: user, memberships: orgs, current: orgs.find(o => o.slug === slug) || null })
function Probe() {
  const workspace = boundary.useOptionalMensetsuWorkspace()
  if (!workspace) return React.createElement('div', { 'data-guest': 'true' })
  const { scope, switchTo } = workspace
  const mount = React.useRef(0)
  if (!mount.current) mount.current = ++mounts
  return React.createElement('div', { 'data-kind': scope.kind, 'data-mount': mount.current, 'data-actor': scope.kind === 'ready' ? scope.proof.actorId : '', 'data-org': scope.kind === 'ready' ? scope.proof.organization.slug : '' },
    scope.kind === 'ready' ? React.createElement('button', { onClick: () => switchTo('A') }, scope.proof.organization.slug) : '')
}
const view = createRoot(document.getElementById('root'))
const render = () => React.act(async () => { view.render(React.createElement(boundary.MensetsuWorkspaceBoundary, null, React.createElement(Template))); await new Promise(setImmediate); await new Promise(setImmediate) })
const settle = (i, value) => React.act(async () => { calls[i].held.resolve(value); await new Promise(setImmediate) })
const navigate = async (path, query) => { pathname = path; search = query; window.history.replaceState(null, '', path + query); await render() }

  await render(); assert.deepEqual(calls[0].selected, { kind: 'selected', slug: 'B' }); assert.equal(calls[0].service, 'mensetsu')
  await settle(0, payload(actor, 'B'))
  const name = [...document.querySelectorAll('input')].find(input => input.value === 'Original B')
  assert.ok(name, 'actual Template should mount after selected-org proof')
  const props = element => element[Object.keys(element).find(key => key.startsWith('__reactProps$'))]
  await React.act(async () => props(name).onChange({ target: { value: 'Unsaved B' } }))
  const edited = [...document.querySelectorAll('input')].find(input => input.value === 'Unsaved B')
  assert.ok(edited, 'actual Template draft edit')
  status = 'loading'; await render()
  assert.equal(document.body.contains(edited) && edited.closest('[hidden]') !== null, true, 'same actor SDK loading must retain the actual draft behind a mask')
  status = 'authenticated'; await render(); await settle(calls.length - 1, payload(actor, 'B'))
  assert.equal(document.body.contains(edited) && edited.value === 'Unsaved B', true, 'fresh proof must keep the same draft node and value')
  assert.equal(edited.closest('[inert]'), null, 'fresh proof releases the retained input for interaction')
  status = 'loading'; await render()
  status = 'authenticated'; await render()
  await React.act(async () => { calls.at(-1).held.reject(new mocks['@/lib/organization-workspace-client'].WorkspaceReadError(503, 'unavailable')); await new Promise(setImmediate) })
  assert.equal(document.body.contains(edited) && edited.closest('[hidden]') !== null, true, 'same-scope unavailable keeps the draft hidden')
  assert.ok(document.querySelector('[role="alert"] button')?.textContent.includes('再読み込み'))
  await React.act(async () => document.querySelector('[role="alert"] button').click())
  await settle(calls.length - 1, payload(actor, 'B'))
  assert.equal(document.body.contains(edited) && edited.value === 'Unsaved B', true, 'retry restores the same draft')
  await React.act(async () => window.dispatchEvent(new dom.window.PageTransitionEvent('pageshow', { persisted: true })))
  assert.equal(document.body.contains(edited) && edited.closest('[hidden][inert]') !== null, true, 'pageshow without pagehide keeps dirty draft inert during fresh read')
  await settle(calls.length - 1, payload(actor, 'B'))
  assert.equal(document.body.contains(edited) && edited.value === 'Unsaved B', true, 'no-pagehide fresh proof preserves actual draft')
  await React.act(async () => window.dispatchEvent(new dom.window.PageTransitionEvent('pagehide', { persisted: true })))
  assert.equal(document.body.contains(edited) && edited.closest('[hidden]') !== null, true, 'pagehide retires without destroying the draft')
  await React.act(async () => window.dispatchEvent(new dom.window.PageTransitionEvent('pageshow', { persisted: true })))
  await settle(calls.length - 1, payload(actor, 'B'))
  assert.equal(document.body.contains(edited) && edited.value === 'Unsaved B', true, 'persisted pageshow reproof keeps the same draft')
  const save = () => [...document.querySelectorAll('button')].find(button => button.textContent === '保存する')
  await React.act(async () => save().click())
  assert.equal(writes.length, 1)
  await React.act(async () => window.dispatchEvent(new dom.window.PageTransitionEvent('pageshow', { persisted: true })))
  assert.equal(document.body.contains(edited) && edited.closest('[hidden][inert]') !== null, true, 'no-pagehide pending PATCH remains inert')
  await settle(calls.length - 1, payload(actor, 'B'))
  assert.ok(document.body.textContent.includes('保存結果を確認できません'), 'lost write response must surface unknown')
  assert.equal(edited.value, 'Unsaved B')
  await React.act(async () => save().click())
  assert.equal(writes.length, 1, 'no blind repeat PATCH')
  await React.act(async () => { writes[0].held.resolve(Response.json({ template: {} })); await new Promise(setImmediate) })
  assert.equal(document.body.textContent.includes('保存しました'), false, 'late old acknowledgment cannot be adopted')
  actor = 'actor-B'; await render(); await settle(calls.length - 1, payload(actor, 'B'))
  assert.equal(document.body.contains(edited), false, 'confirmed different actor discards the previous draft')
  await React.act(async () => save().click())
  assert.equal(writes.length, 2)
  await React.act(async () => { writes[1].held.resolve(Response.json({ template: {} })); await new Promise(setImmediate) })
  assert.ok(document.body.textContent.includes('保存しました'), 'current Template save remains usable')
  transportMode = true
  const nativeSetTimeout = global.setTimeout
  let expireWrite = null
  global.setTimeout = (callback, delay, ...args) => {
    if (delay === 310_000) { expireWrite = () => callback(...args); return 0 }
    return nativeSetTimeout(callback, delay, ...args)
  }
  try {
    await React.act(async () => save().click())
    assert.ok(expireWrite, 'actual Template transport has a finite write deadline')
    assert.equal(transportWrites.length, 1)
    await React.act(async () => { expireWrite(); await new Promise(setImmediate) })
  } finally { global.setTimeout = nativeSetTimeout }
  assert.ok(document.body.textContent.includes('保存結果を確認できません'), 'same-proof Template header timeout is unknown')
  await React.act(async () => save().click())
  assert.equal(transportWrites.length, 1, 'same-proof Template retry makes no second PATCH')
  const currentName = document.querySelector('input[value="Original B"]')
  assert.ok(currentName)
  await React.act(async () => window.dispatchEvent(new dom.window.PageTransitionEvent('pageshow', { persisted: true })))
  assert.ok(currentName.closest('[hidden][inert]'), 'unknown Template is inert during no-pagehide reproof')
  await settle(calls.length - 1, payload(actor, 'B'))
  await React.act(async () => save().click())
  assert.equal(transportWrites.length, 1, 'fresh same-actor proof cannot clear Template unknown outcome')
  await React.act(async () => { transportWrites[0].held.resolve(Response.json({ template: {} })); await new Promise(setImmediate) })
  await React.act(async () => view.unmount())
  actor = 'actor-A'; status = 'authenticated'; remembered = null; calls = []; transportMode = false
  deferNextTemplateRead = true
  const second = createRoot(document.getElementById('root'))
  const renderSecond = () => React.act(async () => { second.render(React.createElement(boundary.MensetsuWorkspaceBoundary, null, React.createElement(Template))); await new Promise(setImmediate); await new Promise(setImmediate) })
  await renderSecond()
  await React.act(async () => { calls.at(-1).held.resolve(payload(actor, 'B')); await new Promise(setImmediate) })
  assert.equal(templateReads.length, 1, 'old GET must be pending before fresh proof')
  status = 'loading'; await renderSecond()
  status = 'authenticated'; await renderSecond()
  await React.act(async () => { calls.at(-1).held.resolve(payload(actor, 'B')); await new Promise(setImmediate) })
  assert.ok([...document.querySelectorAll('input')].some(input => input.value === 'Original B'), 'fresh GET should restore current template')
  await React.act(async () => { templateReads[0].reject(Error('late old GET')); await new Promise(setImmediate) })
  assert.ok([...document.querySelectorAll('input')].some(input => input.value === 'Original B'), 'old rejection cannot replace fresh form')
  assert.equal(document.body.textContent.includes('質問セットを読み込めませんでした'), false, 'old rejection cannot expose new error branch')
  await React.act(async () => second.unmount())
  calls = []; deferNextTemplateRead = true
  const third = createRoot(document.getElementById('root'))
  const renderThird = () => React.act(async () => { third.render(React.createElement(boundary.MensetsuWorkspaceBoundary, null, React.createElement(Template))); await new Promise(setImmediate); await new Promise(setImmediate) })
  await renderThird()
  await React.act(async () => { calls.at(-1).held.resolve(payload(actor, 'B')); await new Promise(setImmediate) })
  assert.equal(templateReads.length, 2)
  await React.act(async () => { templateReads[1].reject(Error('current GET failed')); await new Promise(setImmediate) })
  assert.ok(document.body.textContent.includes('質問セットを読み込めませんでした'), 'current failure remains visible')
  const retry = [...document.querySelectorAll('button')].find(button => button.textContent.includes('再読み込み'))
  assert.ok(retry, 'current failure has a retry')
  await React.act(async () => { retry.click(); await new Promise(setImmediate) })
  assert.ok([...document.querySelectorAll('input')].some(input => input.value === 'Original B'), 'retry restores current template')
  await React.act(async () => third.unmount()); dom.window.close()
  console.log('mensetsu actual boundary + Template dirty/unknown retained; old GET reject after fresh proof rejected; current error visible and retry PASS')

return 3
}

;(async () => {
  const notices = runNotices()
  const settings = await runSettings()
  const template = await runTemplate()
  const sourceHashes = Object.fromEntries([
    'src/components/aishodan/failure.tsx',
    'src/components/mensetsu/states.tsx',
    'src/app/(shell)/mensetsu/settings/page.tsx',
    'src/app/(shell)/mensetsu/templates/[id]/page.tsx',
    'src/components/mensetsu/MensetsuWorkspaceBoundary.tsx',
    'src/components/mensetsu/useMensetsuRequest.ts',
    'src/components/mensetsu/useMensetsuOperation.ts',
    'src/lib/organization-workspace-selection.ts',
  ].map(relative => [relative, require('node:crypto').createHash('sha256').update(fixtureFs.readFileSync(sourcePath(relative))).digest('hex')]))
  console.log(JSON.stringify({ passed: notices + settings + template, breakdown: { notice: notices, settings, template }, sourceHashes, scope: 'Actual two notice helpers and actual Mensetsu Settings/Template components; synthetic proof/read transport; no full Boundary/auth/provider/DB/browser.' }))
})().catch(error => { console.error(error); process.exitCode = 1 })
