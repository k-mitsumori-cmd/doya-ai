// Actual Report consumer; synthetic scoped transport and actor, no provider/DB/network.
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module')
const root = path.resolve(__dirname, '../..'), req = Module.createRequire(path.join(root, 'package.json'))
const React = req('react'), ts = req('typescript'), { JSDOM, VirtualConsole } = req('jsdom'), { createRoot } = req('react-dom/client')
const navigation = [], virtualConsole = new VirtualConsole()
virtualConsole.on('jsdomError', error => {
  if (!error.message.includes('navigation to another Document')) throw error
  navigation.push(error.message)
})
const dom = new JSDOM('<main id="root"></main>', { url: 'https://example.invalid/mensetsu/sessions/session-B?org=B', virtualConsole })
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
let active = true, interval = null, writes = 0, reads = 0, oldPoll = null, holdPoll = true
window.setInterval = callback => { interval = callback; return 1 }
window.clearInterval = () => { interval = null }
const organization = { id: 'org-B', slug: 'B', name: 'Organization B', role: 'owner' }
const proof = { actorId: 'actor-1', organization, revision: 1, current: () => active,
  href: value => value.includes('?') ? value + '&org=B' : value + '?org=B',
  api: value => value.includes('?') ? value + '&org=B' : value + '?org=B' }
const report = (state, candidate) => ({ session: {
  id: 'session-B', candidateName: candidate, status: state, verdict: state === 'evaluated' ? 'recommend' : null,
  updatedAt: '2020-01-01T00:00:00Z', startedAt: '2020-01-01T00:00:00Z', endedAt: '2020-01-01T00:10:00Z',
  evaluatedAt: '2020-01-01T00:20:00Z', template: { jobTitle: 'Engineer', durationMin: 10, criteria: [] },
  scores: [], turns: [], recordingPath: null, overallComment: null, recruiterReport: null, candidateFeedback: null,
}, average: state === 'evaluated' ? 4 : null })
const request = (target, init = {}) => {
  assert.equal(proof.current(), true)
  assert.equal(target.includes('org='), false, 'request helper receives a path before org sealing')
  if ((init.method || 'GET') === 'POST') { writes++; return Promise.resolve(Response.json({ status: 'evaluating' })) }
  if (target.endsWith('/hr-handoff')) return Promise.resolve(Response.json({ canHandoff: false, organizations: [] }))
  assert.equal(target, '/api/mensetsu/sessions/session-B')
  reads++
  if (reads === 1) return Promise.resolve(Response.json(report('evaluating', 'Old candidate')))
  if (reads === 2 && holdPoll) { oldPoll = deferred(); return oldPoll.promise }
  return Promise.resolve(Response.json(report('evaluated', 'New candidate')))
}
const leaves = require('./caller14-leaf-bridge.cjs')(root, React, ts)
const filename = path.join(root, 'src/app/(shell)/mensetsu/sessions/[id]/page.tsx'), module_ = new Module(filename)
module_.filename = filename
const operationFile = path.join(root, 'src/components/mensetsu/useMensetsuOperation.ts'), operationModule = new Module(operationFile)
operationModule.filename = operationFile
operationModule.require = id => id === 'react' ? React : req(id)
operationModule._compile(ts.transpileModule(fs.readFileSync(operationFile, 'utf8'), { fileName: operationFile, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, operationFile)
const mocks = {
  react: React, 'react/jsx-runtime': req('react/jsx-runtime'),
  'next/navigation': { useParams: () => ({ id: 'session-B' }) },
  'next/link': { __esModule: true, default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) },
  '@/components/mensetsu/ui-next': { PageTitle: ({ children, ...props }) => React.createElement('h1', props, children), useToolUiNext: () => false },
  '@/components/ds': leaves.ds, '@/components/mensetsu/states': leaves.mensetsuStates(), '@/components/shell/icons': { ShellIcon: () => null },
  '@/lib/ui/notify': { notifyError: (setter, message) => setter(message) },
  '@/lib/mensetsu/types': { EVALUATION_STALE_MS: 1000 },
  '@/components/mensetsu/useMensetsuRequest': { useMensetsuRequest: () => ({ proof, request }) },
  '@/components/mensetsu/MensetsuWorkspaceBoundary': { useMensetsuWorkspace: () => ({ suspended: false }) },
  '@/components/mensetsu/useMensetsuOperation': operationModule.exports,
}
module_.require = id => id in mocks ? mocks[id] : req(id)
module_._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename)
const Report = module_.exports.default
let view = createRoot(document.getElementById('root'))
const act = fn => React.act(async () => { await fn(); for (let i = 0; i < 4; i++) await new Promise(setImmediate) })
const button = label => [...document.querySelectorAll('button')].find(value => value.textContent.includes(label))
;(async () => {
  await act(() => view.render(React.createElement(Report)))
  assert.ok(document.body.textContent.includes('Old candidate'))
  assert.equal(typeof interval, 'function')
  await act(() => interval())
  assert.ok(oldPoll, 'hold an old background poll')
  await act(() => button('再評価する').click())
  assert.equal(writes, 1)
  assert.ok(document.body.textContent.includes('New candidate'))
  await act(() => oldPoll.resolve(Response.json(report('evaluating', 'Old candidate'))))
  assert.ok(document.body.textContent.includes('New candidate'), 'old poll must not roll back the fresh evaluation')
  const links = [...document.querySelectorAll('a[href*="/pdf"]')]
  assert.equal(links.length, 2)
  for (const link of links) {
    assert.equal(new URL(link.href).searchParams.get('org'), 'B')
    const current = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })
    link.dispatchEvent(current)
    assert.equal(current.defaultPrevented, false, 'current native PDF click remains available')
  }
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(navigation.length, 2, 'both current PDF links attempt native navigation')
  assert.equal(new URL(links[1].href).searchParams.get('transcript'), '1')
  active = false
  for (const link of links) {
    const retired = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })
    link.dispatchEvent(retired)
    assert.equal(retired.defaultPrevented, true, 'retired proof prevents each native PDF click')
  }
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(navigation.length, 2, 'retired PDF links attempt no further navigation')
  await act(() => view.unmount())
  active = true; reads = 0; holdPoll = false; oldPoll = null
  view = createRoot(document.getElementById('root'))
  await act(() => view.render(React.createElement(Report)))
  assert.ok(document.body.textContent.includes('Old candidate'))
  await act(() => interval())
  assert.ok(document.body.textContent.includes('New candidate'), 'a current background poll still updates the report')
  await act(() => view.unmount()); dom.window.close()
  console.log('mensetsu Report old poll cannot replace fresh evaluation; current poll and both PDF current/retired clicks PASS')
})().catch(error => { console.error(error); process.exitCode = 1; dom.window.close() })
