process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript')
const React = require('react'), { JSDOM } = require('jsdom')
const dom = new JSDOM('<body></body>', { url: 'https://example.invalid/interview/projects' })
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
let reduced = false; const listeners = new Set()
window.matchMedia = () => ({ get matches() { return reduced }, addEventListener: (_type, fn) => listeners.add(fn), removeEventListener: (_type, fn) => listeners.delete(fn) })
const { createRoot } = require('react-dom/client')
const jsx = require('react/jsx-runtime')
function load(file, mocks) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, {
    exports, require: name => { if (name === 'react') return React; if (name === 'react/jsx-runtime') return jsx; if (name in mocks) return mocks[name]; throw Error('Unmocked ' + name) }, window, document, console, setTimeout, clearTimeout,
  }, { filename: file })
  return exports
}
const motion = load('src/components/ds/motion.tsx', { './motion.module.css': { __esModule: true, default: {} } })
const CashBars = load('src/components/expense/CashBars.tsx', { '@/components/ds/motion': motion, '@/lib/expense/constants': { CATEGORY_LABEL: { other: 'その他' } }, './ui': { formatYen: n => String(n) } }).default
const ui = load('src/components/shell/ui-next-context.tsx', {})
const Frame = load('src/components/interview/InterviewShellFrame.tsx', {
  'next/navigation': require('next/navigation'), '@/components/shell/ui-next-context': ui,
  '@/components/shell/ToolFrame': { __esModule: true, default: ({ children }) => React.createElement('section', { 'data-frame': true }, children) }, '@/lib/interview/nav': { INTERVIEW_NAV: [] },
}).default
const { PathnameContext } = require('next/dist/shared/lib/hooks-client-context.shared-runtime')
const act = fn => React.act(async () => { await fn(); await new Promise(setImmediate) })
;(async () => {
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host)
  const failures = [], originalError = console.error
  console.error = (...args) => { if (/order of Hooks|Rendered more hooks|Rendered fewer hooks/.test(args.join(' '))) failures.push(args.join(' ')); else originalError(...args) }
  try {
    const cash = { months: ['2026-10'], categories: ['other'], totals: { '2026-10': { amount: 1000 } }, cells: { other: { '2026-10': { amount: 1000, estimated: 0 } } } }
    for (const grow of [false, true, false, true]) await act(() => root.render(React.createElement(React.StrictMode, null, React.createElement(CashBars, { cash, grow }))))
    assert(host.textContent.includes('その他')); assert(host.innerHTML.includes('height 700ms'))
    await act(() => { reduced = true; for (const fn of listeners) fn() })
    assert(!host.innerHTML.includes('height 700ms'), 'reduced-motion removes bar animation')
    console.log('PASS real CashBars can toggle animation and reduced motion without changing hook order')
    for (const [mode, pathname, padded] of [[null, '/interview/projects', false], ['all', '/interview/projects', true], ['all', '/interview/projects/p/edit', false], [null, '/interview/projects', false]]) {
      await act(() => root.render(React.createElement(React.StrictMode, null, React.createElement(ui.UiNextContext.Provider, { value: mode }, React.createElement(PathnameContext.Provider, { value: pathname }, React.createElement(Frame, null, 'Content'))))))
      assert.equal(!!host.querySelector('.max-w-7xl'), padded); assert(host.textContent.includes('Content'))
    }
    assert.deepEqual(failures, [])
    console.log('PASS real InterviewShellFrame and Next pathname hook keep order across UI modes and edit routes')
    console.log(JSON.stringify({ passed: 2, externalCalls: 0, productionWrites: 0 }))
  } finally { await act(() => root.unmount()); host.remove(); console.error = originalError; dom.window.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
