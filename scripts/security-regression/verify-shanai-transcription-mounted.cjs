// Actual VoiceSection and actual shared API/error components; synthetic fetch, no provider.
process.env.NODE_ENV = 'development';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = process.env.DOYA_SHANAI_TRANSCRIPT_UI_ROOT || path.resolve(__dirname, '../..');
const deps = process.env.DOYA_SHANAI_TRANSCRIPT_UI_DEPS || path.join(root, 'node_modules');
const req = name => require(path.join(deps, name));
const React = req('react'), ts = req('typescript'), { JSDOM } = req('jsdom');
const tick = () => new Promise(resolve => setImmediate(resolve));
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://example.invalid' });
const globals = ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent'];
const prior = new Map(globals.map(name => [name, Object.getOwnPropertyDescriptor(global, name)]));
for (const name of globals) Object.defineProperty(global, name, { configurable: true, writable: true, value: name === 'window' ? dom.window : dom.window[name] });
global.IS_REACT_ACT_ENVIRONMENT = true;
let fixture, mounted;
const icon = () => null;
const notice = ({ what, how }) => React.createElement('div', { role: 'alert' }, what, ' ', how);
const detail = { id: 'synthetic', audio: { uploaded: true, status: 'uploaded', size: 10, durationSec: null, runs: 1, error: null, segments: [] } };
let response, calls, changed, reloaded;
function fresh(status = 'uploaded', error = null) { calls = []; changed = []; reloaded = 0; return { ...detail, audio: { ...detail.audio, status, error } }; }
async function fakeFetch(url, init) { assert.equal(url, '/api/shanai/interviews/synthetic/transcribe'); assert.equal(init.method, 'POST'); calls.push(url); return response(); }
class SyntheticXHR { constructor() { throw new Error('No upload allowed'); } }
function load(file, mocks, suffix = '') {
  const exports = {};
  const compiled = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(compiled + suffix, { exports, require: name => { assert(name in mocks, 'Unmocked ' + name); return mocks[name]; }, URL, Error, fetch: fakeFetch, XMLHttpRequest: SyntheticXHR, FormData: class { append() {} }, window: dom.window, document: dom.window.document, setTimeout, clearTimeout, setInterval, clearInterval, console }, { filename: file });
  return exports;
}
const common = { react: React, 'react/jsx-runtime': req('react/jsx-runtime'), 'lucide-react': new Proxy({}, { get: () => icon }) };
const ui = load('src/components/shanai/ui.tsx', { ...common, '@/components/ds': { ErrorNotice: notice, Button: ({ children }) => React.createElement('button', null, children), EmptyState: icon }, './shell-context': { useInShanaiShell: () => true }, '@/components/ds/kun': { DoyaKun: icon } });
const page = load('src/app/(shell)/shanai/interviews/[id]/page.tsx', { ...common, 'next/navigation': {}, 'next/link': { __esModule: true, default: icon }, 'react-hot-toast': { __esModule: true, default: {} }, '@/components/shanai/SurveyForm': { __esModule: true, default: icon }, '@/components/shanai/ui': ui, '@/components/ds': { ErrorNotice: notice }, '@/lib/shanai/types': {}, '@/lib/shanai/survey': {}, '@/components/shell/power': {} }, '\nexports.TestSections = { VoiceSection, PhotoSection };');

const results = [];
async function check(name, fn) { try { await fn(); results.push({ name, passed: true }); console.log('PASS ' + name); } catch (e) { results.push({ name, passed: false, error: e.message.slice(0, 300) }); console.error('FAIL ' + name + ': ' + e.message); } }
async function render(data) { await React.act(async () => { mounted.render(React.createElement(React.StrictMode, null, React.createElement(page.TestSections.VoiceSection, { key: results.length, data, onChange: d => changed.push(d), reload: async () => { reloaded++; } }))); }); }
const button = () => [...document.querySelectorAll('button')].find(b => /文字起こしする|送信状況を確認する/.test(b.textContent));
async function click() { assert(button()); await React.act(async () => { button().click(); await tick(); }); }
(async () => {
  mounted = req('react-dom/client').createRoot(document.getElementById('root'));
  await check('uncertain state persists warning and check-only label without auto request', async () => {
    const d = fresh('uncertain'); await render(d); assert(document.querySelector('[role=alert]').textContent.includes('再送を停止')); assert.equal(button().textContent, '送信状況を確認する'); assert.equal(calls.length, 0);
  });
  await check('uncertain 409 stops loop after one request and reloads persisted state', async () => {
    const d = fresh('uncertain'); response = () => Response.json({ error: '送信不明のため再送を停止', code: 'TRANSCRIPT_SUBMISSION_UNCERTAIN' }, { status: 409 }); await render(d); await click(); assert.equal(calls.length, 1); assert.equal(reloaded, 1); assert.equal(changed.length, 0); assert.equal(button().disabled, false); assert(document.querySelector('[role=alert]').textContent.includes('再送を停止')); await click(); assert.equal(calls.length, 2, 'one explicit check must not become six submissions');
  });
  await check('failed state shows stored server reason after remount', async () => {
    const d = fresh('failed', '録音を読み取れませんでした。別形式をお試しください。'); await render(d); assert(document.querySelector('[role=alert]').textContent.includes(d.audio.error)); assert.equal(calls.length, 0);
  });
  await check('known pending job polls then renders completed interview', async () => {
    const d = fresh('processing'); const done = { ...d, audio: { ...d.audio, status: 'done' } }; response = () => calls.length === 1 ? Response.json({ pending: true }) : Response.json({ interview: done }); await render(d); await click(); assert.equal(calls.length, 2); assert.equal(changed.length, 1); assert.equal(changed[0].audio.status, 'done'); assert.equal(reloaded, 0); assert.equal(document.querySelectorAll('[role=alert]').length, 0);
  });
  await check('recording generation conflict stops polling and refreshes once', async () => {
    const d = fresh('processing'); response = () => Response.json({ error: '録音が変更または削除されました。' }, { status: 409 }); await render(d); await click(); assert.equal(calls.length, 1); assert.equal(reloaded, 1); assert.equal(changed.length, 0); assert.equal(button().disabled, false); assert(document.querySelector('[role=alert]').textContent.includes('変更'));
  });
  await check('six pending responses stop with visible recovery and no endless loop', async () => {
    const d = fresh('processing'); response = () => Response.json({ pending: true }); await render(d); await click(); assert.equal(calls.length, 6); assert.equal(button().disabled, false); assert(document.querySelector('[role=alert]').textContent.includes('時間がかかっています'));
  });
  for (const outcome of ['pending', 'completed']) await check('unmounted voice section ignores late ' + outcome + ' response', async () => {
    if (!mounted) mounted = req('react-dom/client').createRoot(document.getElementById('root'));
    const d = fresh('processing'); let finish; response = () => new Promise(resolve => { finish = resolve; }); await render(d); await click(); assert.equal(calls.length, 1); assert.equal(button().disabled, true);
    await React.act(async () => mounted.unmount()); mounted = null;
    await React.act(async () => { finish(Response.json(outcome === 'pending' ? { pending: true } : { interview: { ...d, audio: { ...d.audio, status: 'done' } } })); await tick(); });
    assert.equal(calls.length, 1); assert.equal(changed.length, 0); assert.equal(reloaded, 0);
  });
})().catch(e => { results.push({ name: 'harness', passed: false, error: e.message }); }).finally(async () => {
  if (mounted) await React.act(async () => mounted.unmount()); dom.window.close();
  for (const [name, descriptor] of prior) { if (descriptor) Object.defineProperty(global, name, descriptor); else delete global[name]; }
  const report = { root, passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, results, scope: 'Actual VoiceSection, api, Button and LimitNotice mounted with React/jsdom StrictMode, including unmount and late responses. Decorative DS leaves stubbed, fetch synthetic. No real browser, DB, uploads, network or provider calls.' };
  const out = process.env.DOYA_SHANAI_TRANSCRIPT_UI_OUTPUT || path.join(root, 'docs/audits/2026-10-06-all-services-recheck/shanai-transcription-mounted-results.json'); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ passed: report.passed, failed: report.failed })); if (report.failed) process.exitCode = 1;
});
