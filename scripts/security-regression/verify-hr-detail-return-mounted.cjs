process.env.NODE_ENV = 'test'

const fs = require('node:fs')
const pathModule = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const ts = require('typescript')
const React = require('react')
const { JSDOM } = require('jsdom')

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://example.test/hr/employees/e1' })
global.window = dom.window
global.document = dom.window.document
global.HTMLElement = dom.window.HTMLElement
global.IS_REACT_ACT_ENVIRONMENT = true
const { createRoot } = require('react-dom/client')
const { act } = React
const sourceRoot = process.env.HR_DETAIL_RETURN_SOURCE_ROOT || process.cwd()

let mode = 'employee'
let responseMode = 'ok'
let selectedOrganization = 'orgA'
let reads = 0
let mutations = 0
let historyBacks = 0
let clickedHref = null
let lifetimeLoads = 0
const router = { back: () => { historyBacks++ }, push: () => { throw Error('unexpected router.push') } }
const memberResponse = () => ({
  employee: { id: 'e1', firstName: 'Taro', lastName: 'Yamada', status: 'ACTIVE' },
  evaluations: [], oneOnOnes: [], transfers: [],
})
const oneOnOneResponse = () => ({ oneOnOne: {
  id: 'o1', employeeId: 'e1', employeeName: 'Name', date: '2026-10-22T01:00:00Z',
  duration: 30, agenda: [], managerNote: '', sharedNote: '', actionItems: [],
  canViewManagerNotes: false, status: 'DRAFT',
} })
function read(url, init) {
  assert.equal(selectedOrganization, 'orgA')
  if (init?.method && init.method !== 'GET') mutations++
  else reads++
  if (responseMode === 'pending') return new Promise(() => {})
  const ok = responseMode === 'ok'
  return Promise.resolve({ ok, status: ok ? 200 : 404,
    json: async () => ok ? mode === 'employee' ? memberResponse() : oneOnOneResponse() : {} })
}
const mock = {
  react: React,
  'next/navigation': { useRouter: () => router, useParams: () => ({ id: mode === 'employee' ? 'e1' : 'o1' }) },
  '@/lib/hr/organization-request-scope': { createHrOrganizationRequestScope: (actor, organizationId, origin, current) => {
    assert.equal(actor, 'u1')
    assert.equal(organizationId, 'orgA')
    assert.equal(origin, 'https://example.test')
    return { request: (url, init) => {
      assert.equal(current(), true)
      return read(url, init)
    }, dispose: () => {} }
  } },
  'react-hot-toast': { default: { success: () => {}, error: () => {} } },
  '@/lib/hr/department-settings-client': { readDepartmentSettingsResponse: async (url, init, signal, requester) => {
    const response = await requester(url, { ...init, signal })
    return { status: response.status, data: await response.json() }
  } },
  'framer-motion': { motion: { div: 'div' }, AnimatePresence: ({ children }) => React.createElement(React.Fragment, null, children) },
  '@/components/hr/ui-next': { PageTitle: ({ children, ...props }) => React.createElement('h1', props, children) },
  'next/link': { default: ({ href, children, onClick, ...props }) => React.createElement('a', {
    href, ...props,
    onClick: event => { event.preventDefault(); clickedHref = href; onClick?.(event) },
  }, children) },
  '@/components/hr/OneOnOneForm': { default: () => React.createElement('div', null, 'form') },
}
const cache = new Map()
function load(path) {
  if (cache.has(path)) return cache.get(path)
  const code = ts.transpileModule(fs.readFileSync(pathModule.join(sourceRoot, path), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const loadedModule = { exports: {} }
  vm.runInNewContext(code, {
    module: loadedModule, exports: loadedModule.exports, console, AbortController, Error, window: global.window,
    require: name => {
      if (name === 'react/jsx-runtime') return require('react/jsx-runtime')
      if (name === '@/lib/hr/use-page-lifetime') {
        lifetimeLoads++
        return load('src/lib/hr/use-page-lifetime.ts')
      }
      if (name === '@/components/hr/HrOrganizationScope') return load('src/components/hr/HrOrganizationScope.tsx')
      if (name in mock) return mock[name]
      throw Error(`${path}: unmocked ${name}`)
    },
  }, { filename: path })
  cache.set(path, loadedModule.exports)
  return loadedModule.exports
}
const components = {
  employee: load('src/app/(shell)/hr/employees/[id]/page.tsx').default,
  oneOnOne: load('src/app/(shell)/hr/one-on-one/[id]/page.tsx').default,
}
const HrOrganizationScope = load('src/components/hr/HrOrganizationScope.tsx').default
const scoped = Component => React.createElement(HrOrganizationScope,
  { actor: 'u1', organizationId: 'orgA', enabled: true }, React.createElement(Component))
const listUrl = { employee: '/hr/employees', oneOnOne: '/hr/one-on-one' }
const listLabel = { employee: '従業員一覧に戻る', oneOnOne: '1on1一覧に戻る' }

;(async () => {
  let cases = 0
  for (const kind of Object.keys(components)) {
    for (const state of ['ok', 'error']) {
      for (const prior of [listUrl[kind], '/income', null]) {
        mode = kind
        responseMode = state
        clickedHref = null
        reads = mutations = historyBacks = 0
        selectedOrganization = 'orgA'
        window.sessionStorage.setItem('hr-selected-organization:v1:u1', 'orgA')
        const mount = document.getElementById('root')
        const root = createRoot(mount)
        await act(async () => { root.render(scoped(components[kind])); await new Promise(resolve => setTimeout(resolve, 0)) })
        const link = [...mount.querySelectorAll('a')].find(a => a.textContent.includes(listLabel[kind]))
        assert.ok(link, `${kind}/${state}: list link must be rendered`)
        assert.equal(link.getAttribute('href'), listUrl[kind])
        assert.equal(link.textContent.trim().replace(/^arrow_back/, ''), listLabel[kind])
        await act(async () => { link.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })) })
        assert.equal(clickedHref, listUrl[kind], `${kind}/${state}/${prior}: exact navigation`)
        assert.equal(historyBacks, 0, 'prior history must not be used')
        assert.equal(reads, 1)
        assert.equal(mutations, 0)
        assert.equal(window.sessionStorage.getItem('hr-selected-organization:v1:u1'), 'orgA')
        console.log(`${kind}/${state}/${prior || 'direct'} -> ${clickedHref}; back=0; GET=1; mutation=0; org=orgA`)
        cases++
        await act(async () => root.unmount())
      }
    }
    mode = kind
    responseMode = 'pending'
    const root = createRoot(document.getElementById('root'))
    await act(async () => { root.render(scoped(components[kind])); await new Promise(resolve => setTimeout(resolve, 0)) })
    assert.equal(document.querySelector('#root a[href="' + listUrl[kind] + '"]'), null, `${kind} loading branch unchanged`)
    await act(async () => root.unmount())
    console.log(`${kind}/loading -> no return link`)
    cases++
  }
  assert.equal(lifetimeLoads, 2, 'both actual pages retain the actual lifetime module')
  console.log(JSON.stringify({ passed: cases, lifetimeLoads }))
})().catch(error => { console.error(error); process.exitCode = 1 })
