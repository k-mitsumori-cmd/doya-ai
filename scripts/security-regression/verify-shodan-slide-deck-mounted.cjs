process.env.NODE_ENV = 'test'
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict')
const root = process.cwd(), req = name => require(path.join(root, 'node_modules', name))
const React = req('react'), ts = req('typescript'), { JSDOM } = req('jsdom')
const dom = new JSDOM('<body></body>', { url: 'https://example.invalid' })
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
const { createRoot } = req('react-dom/client'), exportsObject = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/shodan/SlideDeck.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, { exports: exportsObject, require: req, window: dom.window }, { filename: 'SlideDeck.tsx' })
const Deck = exportsObject.default, container = document.createElement('div'); document.body.append(container)
const mounted = createRoot(container), props = el => el[Object.keys(el).find(k => k.startsWith('__reactProps$'))]
let slides = ['First', 'Second', 'Third'].map(title => ({ title, type: 'content' })), fileBase = 'alpha'
const render = () => mounted.render(React.createElement(React.StrictMode, null, React.createElement(Deck, { slides, fileBase })))
const act = fn => React.act(async () => { await fn(); await new Promise(setImmediate) })
const buttons = () => [...container.querySelectorAll('button')]
const current = () => container.querySelector('.shadow-lg h2')?.textContent
const next = () => buttons().find(b => b.textContent === 'chevron_right')
const previous = () => buttons().find(b => b.textContent === 'chevron_left')
;(async () => {
  await act(render)
  await act(() => props(next()).onClick()); await act(() => props(next()).onClick())
  assert.equal(current(), 'Third')
  slides = [{ title: 'Replacement only', type: 'cover' }]
  await act(render)
  assert.equal(current(), 'Replacement only', 'Shrinking a deck must render the available slide without crashing')
  assert.equal(previous().disabled, true); assert.equal(next().disabled, true)
  slides = ['New first', 'New second', 'New third'].map(title => ({ title, type: 'content' }))
  await act(render); assert.equal(current(), 'New first')
  await act(() => { props(next()).onClick(); props(next()).onClick() })
  assert.equal(current(), 'New third', 'Same-turn navigation must use latest cursor')
  const retainedNext = props(next()).onClick
  fileBase = 'beta'; await act(render)
  assert.equal(current(), 'New first', 'A different document must start at its first slide')
  await act(() => retainedNext()); assert.equal(current(), 'New first', 'Old document callbacks must not move the current document')
  slides = []; await act(render); assert.equal(container.textContent, '')
  slides = [{ title: 'Restored', type: 'closing' }]; await act(render)
  assert.equal(current(), 'Restored')
  await act(() => props(previous()).onClick()); assert.equal(current(), 'Restored')
  await act(() => mounted.unmount()); dom.window.close()
  console.log('PASS: actual StrictMode SlideDeck shrink, replacement, document switch, retained callback, same-turn navigation, empty and restore')
})().catch(async error => { console.error(error); process.exitCode = 1; try { await act(() => mounted.unmount()) } catch {} dom.window.close() })
