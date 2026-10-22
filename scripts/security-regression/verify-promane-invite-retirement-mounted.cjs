process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto')
const React = require('react'), ts = require('typescript'), { JSDOM } = require('jsdom')
const { createRoot } = require('react-dom/client')
const rootPath = path.resolve(__dirname, '../..')
const sourceFile = 'src/components/promane/invite-modal.tsx'
const sourcePath = process.env.DOYA_TEST_BASELINE && fs.existsSync(path.join(process.env.DOYA_TEST_BASELINE, sourceFile))
  ? path.join(process.env.DOYA_TEST_BASELINE, sourceFile) : path.join(rootPath, sourceFile)
const source = fs.readFileSync(sourcePath, 'utf8')
const dom = new JSDOM('<body></body>', { url: 'https://synthetic.test/promane/ws/members' })
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
const events = [], requests = []
const plain = tag => ({ children, ...props }) => React.createElement(tag, props, children)
let inputProps
const mocks = {
  react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
  '@/components/promane/ui/button': { Button: plain('button') },
  '@/components/promane/ui/input': { Input: props => { inputProps = props; return React.createElement('input', props) } },
  '@/components/promane/ui/badge': { Badge: plain('span') },
  'lucide-react': new Proxy({}, { get: () => () => null }),
  sonner: { toast: {
    error: message => events.push(['error', message]), success: message => events.push(['success', message]),
    warning: message => events.push(['warning', message]), info: message => events.push(['info', message]),
  } },
  'next/image': { __esModule: true, default: () => null },
}
const loaded = {}
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} }).outputText, {
  exports: loaded, require: name => { assert(name in mocks, 'Unmocked ' + name); return mocks[name] },
  fetch: async (url, init = {}) => {
    requests.push({ url, method: init.method || 'GET' })
    if (init.method === 'POST') return Response.json({ code: 'ACCOUNT_RETIREMENT_IN_PROGRESS', error: '退会処理中です。' }, { status: 409 })
    return Response.json({ invitations: [], total: 0, nextCursor: null })
  },
  window, document, navigator: window.navigator, URL, URLSearchParams, Date, Response, setTimeout, clearTimeout, console,
}, { filename: sourceFile })
const Modal = loaded.InviteModal
assert.equal(typeof Modal, 'function')
const node = document.createElement('div'); document.body.append(node)
const root = createRoot(node)
const tick = () => new Promise(done => setImmediate(done))
const act = async fn => React.act(async () => { await fn(); for (let index = 0; index < 5; index++) await tick() })
;(async () => {
  await act(() => root.render(React.createElement(Modal, { workspaceId: 'ws', open: true, onClose() {}, canInvite: true })))
  const input = node.querySelector('input[type="email"]')
  assert(input, 'Actual invitation form input')
  await act(() => inputProps.onChange({ target: { value: 'recipient@example.test' } }))
  const send = [...node.querySelectorAll('button')].find(button => button.textContent.includes('招待メールを送信'))
  assert(send && !send.disabled, 'Actual submit is enabled for valid email')
  await act(() => send.click())
  assert.equal(requests.filter(request => request.method === 'POST').length, 1)
  assert.deepEqual(events, [['error', '退会処理中です。']])
  assert.equal(input.value, 'recipient@example.test', 'Guard refusal preserves the draft email')
  assert.equal(node.textContent.includes('招待メールを送信'), true)
  assert.equal(requests.filter(request => request.method === 'GET').length, 1, 'Refusal does not refresh history as success')
  console.log(JSON.stringify({ passed: 1, sourceSha256: crypto.createHash('sha256').update(source).digest('hex'),
    sourceFile, scope: 'Actual InviteModal TSX mounted with synthetic 409 API response, no email/provider or browser acceptance.' }))
  await act(() => root.unmount()); node.remove(); dom.window.close()
})().catch(error => { console.error(error); process.exitCode = 1 })
