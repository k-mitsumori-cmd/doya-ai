// Real new-interview page and form UI. Browser focus/scroll boundary is observed, not laid out by jsdom.
process.env.NODE_ENV = 'development';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = process.env.DOYA_SHANAI_NEW_TEST_ROOT || path.resolve(__dirname, '../..');
const deps = process.env.DOYA_SHANAI_NEW_TEST_DEPS || path.join(root, 'node_modules');
const req = name => require(path.join(deps, name));
const React = req('react'), ts = req('typescript'), { JSDOM } = req('jsdom');
const dom = new JSDOM('<!doctype html><main id="shell-main"><div id="root"></div></main>', { url: 'https://example.invalid' });
const names = ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent'];
const prior = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(global, name)]));
for (const name of names) Object.defineProperty(global, name, { configurable: true, writable: true, value: name === 'window' ? dom.window : dom.window[name] });
global.IS_REACT_ACT_ENVIRONMENT = true;
let state, mounted;
const tick = () => new Promise(resolve => setImmediate(resolve));
const nativeFocus = dom.window.HTMLInputElement.prototype.focus;
dom.window.HTMLInputElement.prototype.focus = function (options) {
  if (this.required) state.focus.push({ errorRendered: !!document.getElementById('shanai-new-name-error'), invalid: this.getAttribute('aria-invalid'), options });
  nativeFocus.call(this, options);
};
dom.window.HTMLElement.prototype.scrollIntoView = function (options) {
  state.scroll.push({ targetIsName: this.matches('input[required]'), focused: document.activeElement === this, errorRendered: !!document.getElementById('shanai-new-name-error'), invalid: this.getAttribute('aria-invalid'), options });
};
async function fakeFetch(url, init = {}) {
  state.requests.push({ url, method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : null });
  if (url === '/api/shanai/company' && !init.method) return Response.json({ company: { sources: [] } });
  assert.equal(url, '/api/shanai/interviews'); assert.equal(init.method, 'POST');
  return Response.json({ id: 'synthetic-created' });
}
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, { exports, require: name => { assert(name in mocks, 'Unmocked ' + name); return mocks[name]; }, URL, Error, fetch: fakeFetch, setTimeout, clearTimeout, setInterval, clearInterval, window: dom.window, document: dom.window.document, console }, { filename: file });
  return exports;
}
const no = () => null;
const common = { react: React, 'react/jsx-runtime': req('react/jsx-runtime'), 'lucide-react': new Proxy({}, { get: () => no }) };
const ui = load('src/components/shanai/ui.tsx', { ...common, '@/components/ds': { ErrorNotice: ({ what, how }) => React.createElement('div', { role: 'alert' }, what, how), Button: ({ children }) => React.createElement('button', null, children), EmptyState: no }, './shell-context': { useInShanaiShell: () => true }, '@/components/ds/kun': { DoyaKun: no } });
const types = load('src/lib/shanai/types.ts');
const Page = load('src/app/(shell)/shanai/new/page.tsx', { ...common, 'next/navigation': { useRouter: () => ({ push: url => state.routes.push(url) }) }, '@/components/shanai/ui': ui, '@/lib/shanai/types': types, '@/components/ds/kun': { DoyaKun: no } }).default;
let key = 0;
async function fresh() {
  state = { focus: [], scroll: [], requests: [], routes: [] };
  await React.act(async () => { mounted.render(React.createElement(Page, { key: ++key })); await tick(); });
  return document.querySelector('#shell-main input[required]');
}
async function submit(times = 1) {
  const button = [...document.querySelectorAll('button')].find(b => b.textContent === '作成して次へ'); assert(button);
  await React.act(async () => { for (let i = 0; i < times; i++) button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); await tick(); });
}
async function name(value) {
  const input = document.querySelector('#shell-main input[required]');
  await React.act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); await tick(); });
  assert.equal(input.value, value);
}
function blockedAndPositioned(input) {
  const error = document.getElementById('shanai-new-name-error'); assert(error); assert.equal(error.getAttribute('role'), 'alert');
  assert.equal(input.getAttribute('aria-invalid'), 'true'); assert.equal(input.getAttribute('aria-describedby'), error.id); assert.equal(document.activeElement, input);
  assert(state.focus.some(e => e.errorRendered && e.invalid === 'true'), 'invalid input must be focused after its error is rendered');
  assert(state.scroll.some(e => e.targetIsName && e.errorRendered && e.focused && e.invalid === 'true' && e.options?.block === 'center'), 'invalid input must be brought to the middle of the viewport after render, clear of sticky edges');
  assert.equal(state.requests.filter(r => r.method === 'POST').length, 0); assert.equal(state.routes.length, 0);
}
const results = [];
async function check(label, fn) { try { await fn(); results.push({ name: label, passed: true }); console.log('PASS ' + label); } catch (error) { results.push({ name: label, passed: false, error: error.message.slice(0, 300) }); console.error('FAIL ' + label + ': ' + error.message); } }
(async () => {
  mounted = req('react-dom/client').createRoot(document.getElementById('root'));
  await check('first empty submit renders error before focus and viewport positioning', async () => { const input = await fresh(); await submit(); blockedAndPositioned(input); });
  await check('every repeated empty submit positions the invalid input again', async () => { const input = await fresh(); for (let i = 0; i < 3; i++) { state.focus.length = 0; state.scroll.length = 0; await submit(); blockedAndPositioned(input); } });
  await check('whitespace-only name is blocked and positioned without creation', async () => { const input = await fresh(); await name('   '); await submit(); blockedAndPositioned(input); });
  await check('typing a valid name removes the error without reclaiming scroll', async () => { const input = await fresh(); await submit(); const count = state.scroll.length; await name('Synthetic employee'); assert.equal(document.getElementById('shanai-new-name-error'), null); assert.equal(input.getAttribute('aria-invalid'), null); assert.equal(input.getAttribute('aria-describedby'), null); assert.equal(state.scroll.length, count); assert.equal(state.requests.filter(r => r.method === 'POST').length, 0); });
  await check('clearing a corrected name starts a fresh validation position', async () => { const input = await fresh(); await submit(); await name('Synthetic employee'); await name(''); state.focus.length = 0; state.scroll.length = 0; await submit(); blockedAndPositioned(input); });
  await check('two rapid empty submits stay blocked with one connected error', async () => { const input = await fresh(); await submit(2); blockedAndPositioned(input); assert.equal(document.querySelectorAll('#shanai-new-name-error').length, 1); });
  await check('valid creation keeps its existing payload and navigation', async () => { await fresh(); await name('Synthetic employee'); await submit(); const posts = state.requests.filter(r => r.method === 'POST'); assert.equal(posts.length, 1); assert.equal(posts[0].url, '/api/shanai/interviews'); assert.equal(posts[0].body.intervieweeName, 'Synthetic employee'); assert.equal(posts[0].body.mode, 'voice'); assert.equal(posts[0].body.purpose, 'recruit'); assert.equal(posts[0].body.tone, 'friendly'); assert.deepEqual(state.routes, ['/shanai/interviews/synthetic-created']); assert.equal(state.scroll.length, 0); });
})().catch(error => { results.push({ name: 'harness', passed: false, error: error.message }); }).finally(async () => {
  if (mounted) await React.act(async () => mounted.unmount()); dom.window.close();
  for (const [name, descriptor] of prior) { if (descriptor) Object.defineProperty(global, name, descriptor); else delete global[name]; }
  const report = { root, passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, results, scope: 'Actual new page, form UI and purpose/tone types mounted in React/jsdom. Asserts rendered validation, browser focus/scroll calls after DOM update, retry and unchanged valid submission. Decorative DS/Kun leaves and fetch/router are synthetic. Does not measure real browser viewport geometry; actual production native-pointer evidence is recorded separately. No network/DB/storage/providers.' };
  const out = process.env.DOYA_SHANAI_NEW_TEST_OUTPUT || path.join(root, 'docs/audits/2026-10-06-all-services-recheck/shanai-new-validation-mounted-results.json'); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ passed: report.passed, failed: report.failed })); if (report.failed) process.exitCode = 1;
});
