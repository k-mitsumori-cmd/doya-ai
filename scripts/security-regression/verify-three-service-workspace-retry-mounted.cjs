process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), crypto = require('node:crypto')
const repo = path.resolve(process.env.DOYA_TEST_ROOT || path.join(__dirname, '../..'))
const overlay = process.env.DOYA_TEST_BASELINE ? path.resolve(process.env.DOYA_TEST_BASELINE) : null
const req = Module.createRequire(path.join(repo, 'package.json'))
const React = req('react'), ts = req('typescript'), { JSDOM } = req('jsdom'), { createRoot } = req('react-dom/client')
const tick = () => new Promise(resolve => setImmediate(resolve))
const specs = [
  ['quote', 'src/components/quote/QuoteWorkspaceBoundary.tsx', 'QuoteWorkspaceBoundary', 'useQuoteWorkspace'],
  ['mensetsu', 'src/components/mensetsu/MensetsuWorkspaceBoundary.tsx', 'MensetsuWorkspaceBoundary', 'useMensetsuWorkspace'],
  ['aishodan', 'src/components/org/OrganizationWorkspaceBoundary.tsx', 'OrganizationWorkspaceBoundary', 'useOrganizationWorkspace'],
]
const results = [], hashes = {}
async function scenario(origin, variant, service, relative, exportName, hookName, strictMode) {
  const returnScenario = variant === 'return-session-ABA'
  const dom = new JSDOM('<div id="root"></div>', { url: `https://example.invalid/${service}?${returnScenario ? 'success=1&session_id=cs_test_A' : 'org=A'}` })
  Object.assign(global, { window: dom.window, document: dom.window.document, CustomEvent: dom.window.CustomEvent, IS_REACT_ACT_ENVIRONMENT: true })
  let actor = 'actor-X', fail = true, hold = false, currentRetry, childMounts = 0
  const operationId = '11111111-1111-4111-8111-111111111111'
  const handle = returnScenario ? { operationId } : null
  const calls = [], held = [], observations = [], cache = new Map()
  class WorkspaceReadError extends Error { constructor(kind) { super(kind); this.kind = kind } }
  const memberships = [{ id: 'orgA', slug: 'A', name: 'Org A', role: 'owner' }, { id: 'orgB', slug: 'B', name: 'Org B', role: 'owner' }]
  const snapshot = (who, selected) => ({ service, actorId: who, current: memberships.find(row => row.slug === selected.slug), memberships })
  const mocks = {
    react: React, 'react/jsx-runtime': req('react/jsx-runtime'),
    'next/link': { __esModule: true, default: ({ href, children }) => React.createElement('a', { href }, children) },
    '@/components/SignInReturnLink': { __esModule: true, default: () => null },
    'next-auth/react': { useSession: () => ({ status: 'authenticated', data: { user: { id: actor } } }) },
    'next/navigation': { usePathname: () => window.location.pathname, useSearchParams: () => new URLSearchParams(window.location.search), useRouter: () => router },
    '@/components/org/OrgSwitcher': { getSelectedOrg: () => 'A', selectOrganization() {} },
    '@/lib/ui/guest-path': { isGuestPath: () => false },
    '@/components/CheckoutRecoveryProvider': { useCheckoutRecovery: () => ({ manager: null, snapshot: { phase: returnScenario ? 'unknown' : 'idle', handle } }) },
    '@/lib/checkout-recovery-client': { checkoutStoredIntent: () => returnScenario ? { serviceId: service, organization: null } : null },
    '@/lib/organization-workspace-client': {
      readOrganizationWorkspace: async (who, selected, signal, svc = 'aishodan') => {
        assert.equal(svc, service); assert.equal(selected.kind, 'selected'); assert.equal(selected.slug,
          returnScenario ? 'A' : new URLSearchParams(window.location.search).get('org')); assert.equal(Object.keys(selected).sort().join(','), 'kind,slug')
        calls.push({ actor: who, selected, signal })
        if (fail) throw Error('Synthetic transport failure')
        if (hold) return new Promise((resolve, reject) => held.push({ actor: who,
          resolve: () => resolve(snapshot(who, selected)), reject }))
        return snapshot(who, selected)
      },
      selectedWorkspaceFromUrl: raw => load('src/lib/organization-workspace-selection.ts').organizationSelection(raw),
      WorkspaceReadError,
    },
  }
  const router = { replace() { throw Error('Explicit workspace must not redirect') }, push() { throw Error('Unexpected navigation') } }
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports
    const candidate = overlay && path.join(overlay, file)
    const location = candidate && fs.existsSync(candidate) ? candidate : path.join(repo, file)
    const bytes = fs.readFileSync(location); hashes[origin + ':' + file] = crypto.createHash('sha256').update(bytes).digest('hex')
    const m = new Module(location); cache.set(file, m)
    m.require = id => {
      if (id in mocks) return mocks[id]
      if (id.startsWith('@/')) return load('src/' + id.slice(2) + '.ts')
      if (id.startsWith('.')) return load(path.posix.normalize(path.posix.join(path.posix.dirname(file), id)) + '.ts')
      throw Error('Unmocked ' + id)
    }
    const code = ts.transpileModule(bytes.toString('utf8'), { fileName: location, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    require('node:vm').runInNewContext(code, { exports: m.exports, require: m.require, window, URL, URLSearchParams, AbortController, CustomEvent: dom.window.CustomEvent }, { filename: location })
    return m.exports
  }
  const loaded = load(relative), Boundary = loaded[exportName]
  function Child() {
    const context = loaded[hookName](); currentRetry = context.retry
    React.useEffect(() => { childMounts++ }, [])
    const scope = context.scope
    return React.createElement(React.Fragment, null,
      React.createElement('input', { 'data-draft': 'current', defaultValue: 'draft-initial' }),
      React.createElement('span', { 'data-scope': 'current' }, scope.kind === 'ready'
        ? `ready:${scope.proof.actorId}:${scope.proof.organization.slug}` : scope.kind))
  }
  const root = createRoot(document.getElementById('root'))
  let rootUnmounted = false
  const flush = async () => { for (let i = 0; i < 4; i++) await tick() }
  const act = fn => React.act(async () => { fn(); await flush() })
  const render = () => act(() => root.render(strictMode ? React.createElement(React.StrictMode, null, React.createElement(Boundary, null, React.createElement(Child))) : React.createElement(Boundary, null, React.createElement(Child))))
  const observe = label => observations.push({ label, actor, text: document.body.textContent, draft: document.querySelector('[data-draft]')?.value || null, childMounts, calls: calls.map(c => ({ actor: c.actor, selected: c.selected, aborted: c.signal.aborted })) })
  try {
    if (variant === 'suspended-render') {
      await render()
      const button = [...document.querySelectorAll('button')].find(b => b.textContent === '再読み込みする'); assert(button)
      const propsKey = Object.keys(button).find(k => k.startsWith('__reactProps$')); assert(propsKey)
      const oldRetry = button[propsKey].onClick
      let wake
      const pending = new Promise(resolve => { wake = resolve })
      function Suspender() { throw pending }
      actor = 'actor-Y'
      const suspended = React.createElement(React.Fragment, null,
        React.createElement(Boundary, null, React.createElement(Child)), React.createElement(Suspender))
      await act(() => React.startTransition(() => root.render(strictMode
        ? React.createElement(React.StrictMode, null, suspended) : suspended)))
      assert(document.body.contains(button), 'Committed error button remains visible during uncommitted render')
      actor = 'actor-X'
      fail = false
      const before = calls.length
      await act(oldRetry)
      const afterRetry = calls.length
      await act(() => {
        wake()
        root.render(strictMode
          ? React.createElement(React.StrictMode, null, React.createElement(Boundary, null, React.createElement(Child)))
          : React.createElement(Boundary, null, React.createElement(Child)))
      })
      assert.equal(afterRetry, before + 1, 'Discarded render cannot retire a committed retry')
      results.push({ origin, strictMode, service, variant, before, afterRetry,
        scope: 'Actual React transition/Suspense and Boundary; synthetic SDK/HTTP.' })
      return
    }
    if (variant === 'initial-no-loop') {
      fail = false
      await render()
      assert.equal(document.querySelector('[data-scope]')?.textContent, 'ready:actor-X:A')
      const initialReads = calls.length
      assert(initialReads >= 1 && initialReads <= 2, 'React StrictMode can replay the initial effect once')
      await render()
      assert.equal(calls.length, initialReads, 'A completed initial read must not start a render loop')
      const current = currentRetry
      await act(current)
      assert.equal(calls.length, initialReads + 1, 'Current Context callback remains usable after read completion')
      await act(current)
      assert.equal(calls.length, initialReads + 1, 'A consumed callback cannot retry twice')
      results.push({ origin, strictMode, service, variant, initialReads, freshAddedRequests: 1,
        scope: 'Actual Boundary initial read and current Context callback; synthetic SDK/HTTP.' })
      return
    }
    if (returnScenario) {
      const hintFile = `src/lib/${service}/checkout-origin-hint.ts`
      const hints = load(hintFile)
      const save = hints.saveQuoteCheckoutHint || hints.saveMensetsuCheckoutHint || hints.saveCheckoutOriginHint
      assert.equal(save(window.sessionStorage, { version: 1, actorId: actor, operationId,
        organizationId: 'orgA', slug: 'A', returnPath: `/${service}` }), true)
      await render()
      const button = [...document.querySelectorAll('button')].find(b => b.textContent === '再読み込みする'); assert(button)
      const propsKey = Object.keys(button).find(k => k.startsWith('__reactProps$')); assert(propsKey)
      const oldRetry = button[propsKey].onClick
      window.history.pushState({}, '', `/${service}?success=1&session_id=cs_test_B`); await render()
      window.history.pushState({}, '', `/${service}?success=1&session_id=cs_test_A`); await render()
      const currentButton = [...document.querySelectorAll('button')].find(b => b.textContent === '再読み込みする'); assert(currentButton)
      const currentPropsKey = Object.keys(currentButton).find(k => k.startsWith('__reactProps$')); assert(currentPropsKey)
      const freshRetry = currentButton[currentPropsKey].onClick
      const beforeOld = calls.length
      await act(oldRetry)
      assert.equal(calls.length, beforeOld, 'Old return-session callback cannot borrow current marker after ABA')
      fail = false; await act(freshRetry)
      assert.equal(calls.length, beforeOld + 1)
      assert.match(document.body.textContent, /Org Aの作業に戻る/)
      assert.doesNotMatch(document.body.textContent, /Org Bの作業に戻る/)
      results.push({ origin, strictMode, service, variant, oldAddedRequests: 0, freshAddedRequests: 1,
        origin: 'orgA', scope: 'Actual return Boundary and hint parser with synthetic checkout handle/HTTP.' })
      return
    }
    await render()
    const button = [...document.querySelectorAll('button')].find(b => b.textContent === '再読み込みする'); assert(button)
    const propsKey = Object.keys(button).find(k => k.startsWith('__reactProps$')); assert(propsKey)
    const errorRetry = button[propsKey].onClick
    fail = false
    await act(errorRetry) // Positive control before retirement: exact actual error callback works.
    assert(document.querySelector('[data-draft]')); observe('initial-fresh-control')
    const oldRetry = currentRetry // Capture the ready Context callback before actor/page transition.
    assert.equal(typeof oldRetry, 'function')
    const afterReady = calls.length
    await act(errorRetry)
    assert.equal(calls.length, afterReady, 'Unmounted error button callback cannot retry a ready scope')
    if (variant === 'boundary-unmount') {
      const beforeUnmount = calls.length
      await act(() => root.unmount())
      rootUnmounted = true
      await act(oldRetry)
      assert.equal(calls.length, beforeUnmount, 'Unmounted Boundary callback must not start a read')
      results.push({ origin, strictMode, service, variant, oldAddedRequests: calls.length - beforeUnmount,
        scope: 'Actual Boundary unmount and captured callback, synthetic SDK/HTTP.' })
      return
    }
    if (variant.startsWith('late-old-')) {
      hold = true
      actor = 'actor-Y'; await render()
      actor = 'actor-X'; await render()
      assert.equal(held.length, 2)
      const old = held.shift(), fresh = held.shift()
      assert.equal(old.actor, 'actor-Y'); assert.equal(fresh.actor, 'actor-X')
      hold = false; await act(fresh.resolve)
      assert.equal(document.querySelector('[data-scope]')?.textContent, 'ready:actor-X:A')
      const beforeOld = calls.length
      await act(oldRetry)
      assert.equal(calls.length, beforeOld, 'Old ready callback cannot borrow a recovered actor ABA scope')
      await act(() => variant === 'late-old-success' ? old.resolve()
        : old.reject(variant === 'late-old-401' ? new WorkspaceReadError('denied') : Error('late network failure')))
      assert.equal(document.querySelector('[data-scope]')?.textContent, 'ready:actor-X:A',
        'Late former actor response must not replace fresh actor scope')
      results.push({ origin, strictMode, service, variant, oldAddedRequests: calls.length - beforeOld,
        currentReady: document.querySelector('[data-scope]')?.textContent, scope: 'Actual Boundary and synthetic noncooperative read.' })
      return
    }
    if (variant === 'actor-ABA') {
      actor = 'actor-Y'; await render(); actor = 'actor-X'; await render()
    } else if (variant === 'path-ABA') {
      window.history.pushState({}, '', `/${service}/settings?org=A`); await render()
      window.history.pushState({}, '', `/${service}?org=A`); await render()
    } else if (variant === 'org-ABA') {
      window.history.pushState({}, '', `/${service}?org=B`); await render()
      window.history.pushState({}, '', `/${service}?org=A`); await render()
    } else if (variant === 'query-ABA') {
      window.history.pushState({}, '', `/${service}?org=A&marker=other`); await render()
      window.history.pushState({}, '', `/${service}?org=A`); await render()
    } else {
      document.querySelector('[data-draft]').value = 'retained-before-BFCache'
      if (variant === 'BFCache') {
        const beforeHide = calls.length
        await act(() => {
          window.dispatchEvent(new window.Event('pagehide'))
          oldRetry() // Same event turn: pagehide must retire the public callback synchronously.
          assert.equal(calls.length, beforeHide)
        })
      }
      hold = true
      const event = new window.Event('pageshow'); Object.defineProperty(event, 'persisted', { value: true })
      await act(() => window.dispatchEvent(event))
    }
    const draftBefore = document.querySelector('[data-draft]')
    if (draftBefore) draftBefore.value = 'fresh-final-proof-draft'
    const freshRetry = currentRetry, before = calls.length, pending = calls.at(-1)
    observe('before-retired-callback')
    await act(oldRetry)
    const afterOld = calls.length, abortAfterOld = pending.signal.aborted
    observe('after-retired-callback')
    hold = false; await act(() => held.splice(0).forEach(item => item.resolve()))
    const recoveredDraft = document.querySelector('[data-draft]'); assert(recoveredDraft)
    assert.equal(document.querySelector('[data-scope]')?.textContent, 'ready:actor-X:A',
      'Fresh response must adopt the current actor and organization after the old callback is rejected')
    if (!draftBefore) recoveredDraft.value = 'fresh-final-proof-draft'
    const beforeFresh = calls.length
    await act(currentRetry)
    observe('after-current-positive-control')
    assert.equal(calls.length, beforeFresh + 1, 'Current context retry remains functional')
    assert.equal(document.querySelector('[data-draft]').value, 'fresh-final-proof-draft')
    assert.equal(afterOld, before, 'Retired callback must not borrow current scope')
    if (variant === 'BFCache' || variant === 'pageshow-only') assert.equal(abortAfterOld, false, 'Retired callback must not abort in-flight fresh read')
    results.push({ origin, strictMode, service, variant, draftNodePresentAfterRetirement: !!draftBefore, oldRetryIsFreshCallback: oldRetry === freshRetry, oldAddedRequests: afterOld - before, freshReadAbortedByOld: abortAfterOld, observations, scope: 'Actual Boundary callback and mounted state, synthetic SDK/HTTP, direct callback invocation. Not real browser BFCache or external delivery.' })
  } catch (error) { console.error(JSON.stringify({ origin, strictMode, variant, service, actor, observations, calls: calls.map(c => ({actor:c.actor,selected:c.selected,aborted:c.signal.aborted})), html: document.body.innerHTML, message: error.message })); throw error } finally { if (!rootUnmounted) await act(() => root.unmount()); dom.window.close() }
}
;(async () => { for (const strictMode of [false, true]) for (const origin of ['repo-default']) for (const row of specs) for (const variant of ['suspended-render', 'initial-no-loop', 'actor-ABA', 'path-ABA', 'org-ABA', 'query-ABA', 'return-session-ABA', 'BFCache', 'pageshow-only', 'boundary-unmount', 'late-old-success', 'late-old-401', 'late-old-reject']) await scenario(origin, variant, ...row, strictMode); console.log(JSON.stringify({ passed: results.length, results, hashes, runtimeChanged: false }, null, 2)) })().catch(error => { console.error(error); process.exitCode = 1 })
