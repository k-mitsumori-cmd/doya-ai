const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { JSDOM } = require('jsdom')

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://example.test/income' })
global.window = dom.window
global.document = dom.window.document
global.HTMLElement = dom.window.HTMLElement
global.navigator = dom.window.navigator
global.IS_REACT_ACT_ENVIRONMENT = true
const { createRoot } = require('react-dom/client')
const { Simulate } = require('react-dom/test-utils')
const { act } = React
const sourceRoot = process.env.FORM_EXIT_SOURCE_ROOT || process.cwd()
const old = process.env.FORM_EXIT_EXPECT_OLD === '1'
const js = path => ts.transpileModule(fs.readFileSync(fs.existsSync(`${sourceRoot}/${path}`) ? `${sourceRoot}/${path}` : path, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText
const passthrough = tag => function SyntheticElement({ children, ...props }) {
  return React.createElement(tag, Object.fromEntries(Object.entries(props).filter(([key]) => !['initial', 'animate', 'variants', 'whileHover', 'whileTap', 'transition', 'onValueChange'].includes(key))), children)
}
const Link = ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children)
let priorHistory = null
const router = { pushes: [], backs: 0, historyDestination: null,
  push(url) { this.pushes.push(url) },
  back() { this.backs++; this.historyDestination = priorHistory }, refresh() {} }
const resetRouter = (prior = null) => { priorHistory = prior; router.pushes = []; router.backs = 0; router.historyDestination = null }
let writes = 0
let reads = 0
let isActive = true
let query = new URLSearchParams()
let operationStatus = 'ready'
let operationKey = 'scope:A'
let interviewPending = false
let interviewFailure = false
let requestFailure = false
const requestPayloads = []
const pendingKey = 'promane-project-pending:v2:wA:create:u1'
const mock = {
  react: React,
  'next/navigation': { useRouter: () => router, useSearchParams: () => query },
  'next/link': { default: Link },
  'framer-motion': { motion: { div: passthrough('div'), form: passthrough('form') }, AnimatePresence: ({ children }) => children },
  'next-auth/react': { useSession: () => ({ status: 'authenticated', data: { user: { id: 'u1' } } }) },
  '@/components/hr/ui-next': { PageTitle: passthrough('h1') },
  '@/components/hr/DepartmentListState': { default: () => React.createElement('div', null, 'department state') },
  '@/lib/hr/department-list-client': { loadHrDepartmentList: async () => ({ rows: [], organizationId: 'orgA' }) },
  '@/lib/hr/department-settings-client': { readDepartmentSettingsResponse: async () => ({ status: 200, data: {} }) },
  '@/lib/hr/organization-request-scope': { createHrOrganizationRequestScope: (actor, org) => {
    assert.equal(actor, 'u1'); assert.equal(org, 'orgA')
    return { request: async () => { reads++; return { status: 200, json: async () => ({}) } }, dispose() {} }
  } },
  'react-hot-toast': { default: { success() {}, error() {} } },
  '@/lib/kintai/types': { CLOCK_TYPE_LABELS: { clock_in: '出勤', clock_out: '退勤' } },
  '@/components/kintai/ui-next': { PageTitle: passthrough('h1') },
  '@/components/kintai/KintaiAccessContext': { useKintaiAccess: () => ({ isActive }) },
  '@/lib/interview/creation-response': {
    createInterviewProjectRequest: async () => { writes++; if (interviewPending) return new Promise(() => {}); if (interviewFailure) throw Error('failed'); return { id: 'i1' } },
    InterviewCreationResponseError: class InterviewCreationResponseError extends Error {},
  },
  '@/lib/promane/time-input': { parsePromaneIntegerInput: Number, parsePromaneWorkDate: () => new Date(), validatePromaneProjectText() {} },
  '@/lib/service-limit-ui': { showServiceLimit() {} },
  '@/lib/promane/use-project-operation': { useProjectOperation: () => ({ status: operationStatus, scopeKey: operationKey,
    message: '', save: async () => { writes++; return null }, recover: async () => null }) },
  '@/components/promane/confirm-dialog': { useConfirm: () => ({ confirm: async () => false, ConfirmDialog: () => null }) },
  '@/components/promane/ui/button': { Button: ({ children, variant, ...props }) => React.createElement('button', props, children) },
  '@/components/promane/ui/input': { Input: props => React.createElement('input', props) },
  '@/components/promane/ui/label': { Label: props => React.createElement('label', props) },
  '@/components/promane/ui/textarea': { Textarea: props => React.createElement('textarea', props) },
  '@/components/promane/ui/select': { Select: passthrough('div'), SelectContent: passthrough('div'), SelectItem: passthrough('div'), SelectTrigger: passthrough('div'), SelectValue: passthrough('div') },
  '@/components/promane/ui/card': { Card: passthrough('div'), CardContent: passthrough('div') },
  '@/lib/promane/format': { PROJECT_STATUS_LABELS: {}, BILLING_TYPE_LABELS: {} },
  sonner: { toast: { success() {}, error() {} } },
  'next/image': { default: ({ src, alt }) => React.createElement('img', { src, alt }) },
  'lucide-react': { AlertCircle: passthrough('span') },
}
const cache = new Map()
function load(path) {
  if (cache.has(path)) return cache.get(path)
  const moduleRef = { exports: {} }
  vm.runInNewContext(js(path), { module: moduleRef, exports: moduleRef.exports,
    require: name => {
      if (name === 'react/jsx-runtime') return require('react/jsx-runtime')
      if (name === '@/components/hr/HrAuthenticatedScope') return load('src/components/hr/HrAuthenticatedScope.tsx')
      if (name === '@/components/hr/HrOrganizationScope') return load('src/components/hr/HrOrganizationScope.tsx')
      if (name === '@/lib/hr/use-page-lifetime') return load('src/lib/hr/use-page-lifetime.ts')
      if (name === '@/lib/hr/use-department-list') return load('src/lib/hr/use-department-list.ts')
      if (name in mock) return mock[name]
      throw Error(`${path}: unmocked ${name}`)
    },
    console, Error, Date, URL, AbortController, crypto: require('node:crypto').webcrypto, FormData: dom.window.FormData,
    window: dom.window, navigator: dom.window.navigator,
    fetch: async (url, init) => { if (init?.method === 'POST' || init?.method === 'PATCH') { writes++; requestPayloads.push({ url, body: init.body }) } else reads++; return { ok: !requestFailure, json: async () => requestFailure ? { error: '再試行してください' } : { records: [] } } },
    setTimeout: callback => { timers.push(callback); return 1 }, clearTimeout() {},
  }, { filename: path })
  cache.set(path, moduleRef.exports)
  return moduleRef.exports
}
const timers = []
const click = async element => { assert.ok(element); await act(async () => element.click()) }
const change = async (element, value) => {
  assert.ok(element)
  await act(async () => { element.value = value; Simulate.change(element, { target: { value } }) })
}
const mount = async element => {
  const root = createRoot(document.getElementById('root'))
  await act(async () => { root.render(element); await Promise.resolve() })
  return root
}
const unmount = async root => { await act(async () => root.unmount()) }
function expectExit(path) {
  if (old) { assert.equal(router.backs, 1); assert.equal(router.historyDestination, priorHistory); assert.deepEqual(router.pushes, []) }
  else { assert.equal(router.backs, 0); assert.deepEqual(router.pushes, [path]) }
  console.log(`  synthetic history=${priorHistory ?? 'empty'}; back=${router.backs}; push=${router.pushes[0] ?? 'none'}; destination=${router.historyDestination ?? 'none'}`)
}

async function hr() {
  const HrScope = load('src/components/hr/HrOrganizationScope.tsx').default
  const Page = load('src/app/(shell)/hr/employees/new/page.tsx').default
  for (const control of ['header', 'desktop', 'mobile']) {
    resetRouter({ header: '/income', desktop: '/aishodan', mobile: null }[control]); writes = 0
    window.sessionStorage.setItem('hr-selected-organization:v1:u1', 'orgA')
    const view = enabled => React.createElement(HrScope, { actor: 'u1', organizationId: 'orgA', enabled }, React.createElement(Page))
    const root = await mount(view(true))
    const buttons = [...document.querySelectorAll('button')]
    const target = control === 'header' ? buttons.find(x => x.textContent.includes(old ? '戻る' : '従業員一覧に戻る'))
      : buttons.filter(x => x.textContent.includes('キャンセル'))[control === 'desktop' ? 0 : 1]
    await click(target)
    expectExit('/hr/employees')
    assert.equal(writes, 0)
    assert.equal(window.sessionStorage.getItem('hr-selected-organization:v1:u1'), 'orgA')
    resetRouter()
    await act(async () => root.render(view(false)))
    await click(target)
    assert.equal(router.backs, 0)
    assert.deepEqual(router.pushes, [])
    await unmount(root)
    console.log(`HR ${control}: current exit; retired no navigation; writes=0`)
  }
}

async function interview() {
  const Page = load('src/app/(shell)/interview/projects/new/page.tsx').default
  for (const control of ['header', 'cancel']) {
    resetRouter(control === 'header' ? '/income' : null); writes = 0
    const root = await mount(React.createElement(Page))
    const button = control === 'header' ? document.querySelector('button[aria-label="プロジェクト一覧に戻る"]') || document.querySelector('button:has(.material-symbols-outlined)')
      : [...document.querySelectorAll('button')].find(x => x.textContent.includes('キャンセル'))
    await click(button)
    expectExit('/interview/projects')
    assert.equal(writes, 0)
    assert.ok(document.querySelector('form fieldset'), 'existing disabled fieldset remains')
    await unmount(root)
    console.log(`Interview ${control}: project list exit; writes=0`)
  }
  interviewPending = true; resetRouter(); writes = 0
  const root = await mount(React.createElement(Page))
  await change(document.querySelector('form input[type="text"]'), 'Draft')
  await click(document.querySelector('form button[type="submit"]'))
  const cancel = [...document.querySelectorAll('form button')].find(x => x.textContent.includes('キャンセル'))
  assert.equal(cancel.closest('fieldset').disabled, true)
  await click(cancel)
  assert.deepEqual(router.pushes, [])
  assert.equal(router.backs, 0)
  assert.equal(writes, 1)
  await unmount(root)
  interviewPending = false
  console.log('Interview pending create: fieldset cancel disabled; old submission remains single')
  for (const fail of [true, false]) {
    interviewFailure = fail; resetRouter(); writes = 0
    const completedRoot = await mount(React.createElement(Page))
    await change(document.querySelector('form input[type="text"]'), 'Draft')
    await click(document.querySelector('form button[type="submit"]'))
    assert.equal(writes, 1)
    assert.deepEqual(router.pushes, fail ? [] : ['/interview/projects/i1/materials'])
    await unmount(completedRoot)
  }
  interviewFailure = false
  console.log('Interview failure navigates 0; success retains materials destination')
}

async function kintai() {
  const Page = load('src/app/(shell)/kintai/requests/new/page.tsx').default
  resetRouter('/income'); writes = 0; query = new URLSearchParams()
  let root = await mount(React.createElement(Page))
  let back = document.querySelector('button[aria-label="申請一覧に戻る"]') || document.querySelector('button .material-symbols-outlined')?.parentElement
  await click(back)
  expectExit('/kintai/requests')
  assert.equal(writes, 0)
  await unmount(root)
  resetRouter(); query = new URLSearchParams('type=leave')
  root = await mount(React.createElement(Page))
  const dates = document.querySelectorAll('input[type="date"]')
  await change(dates[0], '2026-10-22')
  await change(dates[1], '2026-10-23')
  await change(document.querySelector('textarea'), '私用のため')
  back = document.querySelector('button[aria-label="申請の種類を選び直す"]') || document.querySelector('button .material-symbols-outlined')?.parentElement
  await click(back)
  assert.equal(router.backs, 0)
  assert.deepEqual(router.pushes, [])
  assert.match(document.body.textContent, /申請の種類を選択/)
  const leaveCard = [...document.querySelectorAll('[role="button"]')].find(x => x.textContent.includes('休暇'))
  await click(leaveCard)
  const retainedDates = document.querySelectorAll('input[type="date"]')
  assert.equal(retainedDates[0].value, '2026-10-22')
  assert.equal(retainedDates[1].value, '2026-10-23')
  assert.equal(document.querySelector('textarea').value, '私用のため')
  requestFailure = true; requestPayloads.length = 0; resetRouter()
  await click([...document.querySelectorAll('button')].find(x => x.textContent.includes('申請内容を確認して提出')))
  assert.equal(requestPayloads.length, 1)
  assert.deepEqual(router.pushes, [])
  requestFailure = false; requestPayloads.length = 0; timers.length = 0
  await click([...document.querySelectorAll('button')].find(x => x.textContent.includes('申請内容を確認して提出')))
  assert.equal(requestPayloads.length, 1)
  assert.equal(requestPayloads[0].url, '/api/kintai/requests')
  assert.deepEqual(JSON.parse(requestPayloads[0].body), { type: 'leave', details: { startDate: '2026-10-22', endDate: '2026-10-23', leaveType: 'paid' }, reason: '私用のため' })
  assert.deepEqual(router.pushes, [])
  assert.equal(timers.length, 1)
  await act(async () => timers.shift()())
  assert.deepEqual(router.pushes, ['/kintai/requests'])
  await unmount(root)
  resetRouter(); query = new URLSearchParams('type=clock_fix&date=2026-10-22')
  root = await mount(React.createElement(Page))
  assert.match(document.body.textContent, /申請内容を入力/)
  await click(document.querySelector('button[aria-label="申請の種類を選び直す"]') || document.querySelector('button .material-symbols-outlined')?.parentElement)
  assert.deepEqual(router.pushes, [])
  assert.match(document.body.textContent, /申請の種類を選択/)
  await click(document.querySelector('button[aria-label="申請一覧に戻る"]') || document.querySelector('button .material-symbols-outlined')?.parentElement)
  expectExit('/kintai/requests')
  await unmount(root)
  isActive = false; query = new URLSearchParams()
  root = await mount(React.createElement(Page))
  assert.equal(document.querySelector('a[href="/kintai/requests"]')?.textContent, '申請履歴を見る')
  await unmount(root); isActive = true
  console.log('Kintai step1 exits; query step2 goes internal; inactive history link retained')
}

async function promane() {
  const Form = load('src/components/promane/project-form.tsx').ProjectForm
  for (const project of [undefined, { id: 'P /1', updatedAt: new Date('2026-10-22T00:00:00Z'), name: 'Project', clientId: null,
    description: null, status: 'active', billingType: 'fixed', contractAmount: 0, monthlyAmount: null, hourlyRate: null,
    estimatedHours: null, startDate: null, endDate: null, tags: null }]) {
    for (const status of ['ready', 'saving', 'checking', 'unknown', 'blocked']) {
      resetRouter(project ? null : '/promane/other-workspace/projects'); writes = 0; operationStatus = status; operationKey = 'scope:A'
      window.localStorage.setItem(pendingKey, '{"version":1,"operationId":"a"}')
      const root = await mount(React.createElement(Form, { workspaceSlug: 'ws A', workspaceId: 'wA', clients: [], project }))
      const cancel = [...document.querySelectorAll('button')].find(x => x.textContent.includes('キャンセル'))
      assert.ok(cancel)
      assert.equal(cancel.closest('fieldset').disabled, status !== 'ready')
      await click(cancel)
      if (status === 'ready') expectExit(project ? '/promane/ws%20A/projects/P%20%2F1' : '/promane/ws%20A/projects')
      else { assert.equal(router.backs, 0); assert.deepEqual(router.pushes, []) }
      assert.equal(writes, 0)
      assert.equal(window.localStorage.getItem(pendingKey), '{"version":1,"operationId":"a"}')
      await unmount(root)
    }
  }
  console.log('Promane create/edit + ready/saving/checking/unknown/blocked: no writes or pending changes')
}

;(async () => {
  await hr()
  await interview()
  await kintai()
  await promane()
  console.log(`Form exit: ${old ? 'before' : 'after'} controls verified`)
})().catch(error => { console.error(error); process.exitCode = 1 })
