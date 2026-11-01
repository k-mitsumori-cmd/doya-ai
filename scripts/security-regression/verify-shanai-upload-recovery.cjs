// Actual upload helper and actual VoiceSection/PhotoSection with synthetic browser I/O.
process.env.NODE_ENV = 'development';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = process.env.DOYA_SHANAI_UPLOAD_TEST_ROOT || path.resolve(__dirname, '../..');
const deps = process.env.DOYA_SHANAI_UPLOAD_TEST_DEPS || path.join(root, 'node_modules');
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
class SyntheticXHR {
  constructor() {
    this.listeners = new Map(); this.status = 0;
    this.upload = { addEventListener: (name, fn) => { this.progress = fn; } };
    fixture.xhrs.push(this);
  }
  addEventListener(name, fn) { this.listeners.set(name, fn); }
  open(method, url) { assert.equal(method, 'PUT'); assert.equal(url, 'https://upload.example.invalid/synthetic'); }
  setRequestHeader(name, value) { assert.equal(name, 'x-upsert'); assert.equal(value, 'true'); }
  send() { this.sent = true; }
  fire(event, status = 0) { this.status = status; this.listeners.get(event)?.({}); this.listeners.get('loadend')?.({}); }
}
const detail = { id: 'synthetic', mode: 'voice', status: 'DRAFT', intervieweeName: 'Synthetic', department: '', position: '', joinYear: '', photos: [], facts: [], article: null, audio: { uploaded: false, status: 'none', size: null, durationSec: null, runs: 0, error: null, segments: [] }, survey: { token: 'synthetic', answers: {}, submittedAt: null, check: { canSubmit: false, score: 0, missing: [] } } };
function fresh() { fixture = { xhrs: [], requests: [], changed: [], prepareError: false, confirmError: false, signedUrl: 'https://upload.example.invalid/synthetic' }; return fixture; }
async function fakeFetch(url, init) {
  assert.equal(init.method, 'POST');
  const body = JSON.parse(init.body); fixture.requests.push({ url, body });
  if (url.endsWith('/upload-url')) {
    if (fixture.prepareError) return Response.json({ error: '準備に失敗しました。' }, { status: 500 });
    return Response.json({ signedUrl: fixture.signedUrl, path: 'synthetic/' + fixture.requests.length });
  }
  assert.equal(url, '/api/shanai/interviews/synthetic/confirm-upload');
  if (fixture.confirmError) return Response.json({ error: '確認に失敗しました。' }, { status: 500 });
  const updated = structuredClone(detail);
  if (body.kind === 'photo') updated.photos = [{ id: 'synthetic-photo', usage: 'body', caption: '', url: null }];
  else updated.audio = { ...updated.audio, uploaded: true, status: 'uploaded', size: 10 };
  return Response.json({ interview: updated });
}
function load(file, mocks, suffix = '') {
  const exports = {};
  const compiled = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(compiled + suffix, { exports, require: name => { assert(name in mocks, 'Unmocked ' + name); return mocks[name]; }, URL, Error, fetch: fakeFetch, XMLHttpRequest: SyntheticXHR, FormData: class { append() {} }, window: dom.window, document: dom.window.document, setTimeout, clearTimeout, setInterval, clearInterval, console }, { filename: file });
  return exports;
}
const common = { react: React, 'react/jsx-runtime': req('react/jsx-runtime'), 'lucide-react': new Proxy({}, { get: () => icon }) };
const ui = load('src/components/shanai/ui.tsx', { ...common, '@/components/ds': { ErrorNotice: notice, Button: ({ children }) => React.createElement('button', null, children), EmptyState: icon }, './shell-context': { useInShanaiShell: () => true }, '@/components/ds/kun': { DoyaKun: icon } });
const page = load('src/app/(shell)/shanai/interviews/[id]/page.tsx', { ...common, 'next/navigation': {}, 'next/link': { __esModule: true, default: icon }, 'react-hot-toast': { __esModule: true, default: {} }, '@/components/shanai/SurveyForm': { __esModule: true, default: icon }, '@/components/shanai/ui': ui, '@/components/ds': { ErrorNotice: notice }, '@/lib/shanai/types': {}, '@/lib/shanai/survey': {}, '@/components/shell/power': {} }, '\nexports.TestSections = { VoiceSection, PhotoSection };');
// Model the native picker rule: selecting the unchanged file list does not dispatch change.
// Clearing input.value clears its live FileList; product code must snapshot before clearing it.
function picker(input) {
  let value = '', selected = [];
  Object.defineProperty(input, 'files', { configurable: true, get: () => selected });
  Object.defineProperty(input, 'value', { configurable: true, get: () => value, set: next => { assert.equal(next, ''); value = ''; selected.length = 0; } });
  return files => {
    const next = files.map(file => file.name).join('|');
    if (value === next) return false;
    selected = [...files]; value = next;
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    return true;
  };
}
const results = [];
async function check(name, fn) { try { await fn(); results.push({ name, passed: true }); console.log('PASS ' + name); } catch (error) { results.push({ name, passed: false, error: error.message.slice(0, 300) }); console.error('FAIL ' + name + ': ' + error.message); } }
(async () => {
  for (const kind of ['audio', 'photo']) for (const event of ['timeout', 'abort', 'error', 'load500', 'load200', 'load204']) await check(kind + ' helper ' + event, async () => {
    const f = fresh(); let state = 'pending', caught;
    const promise = ui.uploadToInterview('synthetic', kind, { name: 'synthetic.bin', type: 'application/octet-stream', size: 10 }).then(() => { state = 'resolved'; }, error => { state = 'rejected'; caught = error; });
    await tick(); assert.equal(f.xhrs.length, 1); assert.equal(f.xhrs[0].timeout, 3600000);
    f.xhrs[0].fire(event.startsWith('load') ? 'load' : event, event.startsWith('load') ? Number(event.slice(4)) : 0); await tick();
    const ok = ['load200', 'load204'].includes(event);
    assert.equal(state, ok ? 'resolved' : 'rejected', 'terminal event must settle upload');
    assert.equal(f.requests.filter(r => r.url.endsWith('confirm-upload')).length, ok ? 1 : 0);
    if (!ok) assert(caught instanceof Error);
    await promise;
  });
  for (const signedUrl of ['http://upload.example.invalid/synthetic', 'https://user:secret@upload.example.invalid/synthetic']) await check('reject unsafe signed URL ' + (signedUrl.startsWith('http:') ? 'http' : 'credentials'), async () => {
    const f = fresh(); f.signedUrl = signedUrl;
    await assert.rejects(ui.uploadToInterview('synthetic', 'photo', { name: 'synthetic.png', type: 'image/png', size: 10 })); assert.equal(f.xhrs.length, 0); assert.equal(f.requests.length, 1);
  });
  mounted = req('react-dom/client').createRoot(document.getElementById('root'));
  for (const kind of ['audio', 'photo']) for (const failure of ['timeout', 'abort', 'error', 'load500', 'prepare', 'confirm']) await check(kind + ' mounted same-file retry after ' + failure, async () => {
    const f = fresh(); const Section = kind === 'audio' ? page.TestSections.VoiceSection : page.TestSections.PhotoSection;
    await React.act(async () => { mounted.render(React.createElement(Section, { key: kind + failure, data: detail, reload: async () => {}, onChange: d => f.changed.push(d) })); });
    const input = document.querySelector('input[type=file]'), choose = picker(input);
    const file = new dom.window.File(['synthetic'], kind === 'audio' ? 'synthetic.wav' : 'synthetic.png', { type: kind === 'audio' ? 'audio/wav' : 'image/png' });
    f.prepareError = failure === 'prepare'; f.confirmError = failure === 'confirm';
    await React.act(async () => { assert(choose([file])); await tick(); });
    if (!f.prepareError) await React.act(async () => { f.xhrs[0].fire(failure === 'load500' || failure === 'confirm' ? 'load' : failure, failure === 'load500' ? 500 : failure === 'confirm' ? 200 : 0); await tick(); });
    const button = [...document.querySelectorAll('button')].find(b => b.textContent.includes(kind === 'audio' ? '録音をアップロード' : '写真を追加') || b.textContent.includes('アップロード中'));
    assert(button); assert.equal(button.disabled, false, 'failed upload must release busy button');
    assert.equal(document.querySelectorAll('[role=alert]').length, 1, 'failure must be visible');
    assert.equal(f.changed.length, 0);
    const before = f.requests.length; f.prepareError = false; f.confirmError = false;
    await React.act(async () => { assert(choose([file]), 'same file must be selectable again'); await tick(); });
    assert(f.requests.length > before); assert.equal(input.value, '', 'file picker must be ready for another selection');
    await React.act(async () => { f.xhrs.at(-1).fire('load', 200); await tick(); });
    assert.equal(f.changed.length, 1); assert.equal(document.querySelectorAll('[role=alert]').length, 0);
    assert(!f.requests.some(r => /transcribe|article|facts/.test(r.url)), 'upload must not trigger paid generation');
  });
  await check('photo live FileList retains all selected files before reset', async () => {
    const f = fresh(); await React.act(async () => { mounted.render(React.createElement(page.TestSections.PhotoSection, { key: 'multi', data: detail, onChange: d => f.changed.push(d) })); });
    const input = document.querySelector('input[type=file]'), choose = picker(input);
    const files = ['one.png', 'two.png'].map(name => new dom.window.File(['synthetic'], name, { type: 'image/png' }));
    await React.act(async () => { choose(files); await tick(); });
    assert.equal(f.xhrs.length, 1); assert.equal(input.files.length, 0);
    await React.act(async () => { f.xhrs[0].fire('load', 200); await tick(); }); assert.equal(f.xhrs.length, 2);
    await React.act(async () => { f.xhrs[1].fire('load', 200); await tick(); });
    assert.equal(f.changed.length, 2); assert.equal(f.requests.filter(r => r.url.endsWith('upload-url')).length, 2);
    assert.deepEqual(f.requests.filter(r => r.url.endsWith('upload-url')).map(r => r.body.fileName), ['one.png', 'two.png']);
  });
})().catch(error => { results.push({ name: 'harness', passed: false, error: error.message }); }).finally(async () => {
  if (mounted) await React.act(async () => mounted.unmount()); dom.window.close();
  for (const [name, descriptor] of prior) { if (descriptor) Object.defineProperty(global, name, descriptor); else delete global[name]; }
  const report = { root, passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, results, scope: 'Actual ui.tsx upload/api/Button/error handling and actual VoiceSection/PhotoSection, React/jsdom mounted. Native file selection suppression/live FileList, fetch/storage and XHR events are synthetic. Decorative leaves stubbed. No real browser upload, network, auth, DB or provider calls.' };
  const out = process.env.DOYA_SHANAI_UPLOAD_TEST_OUTPUT || path.join(root, 'docs/audits/2026-10-06-all-services-recheck/shanai-upload-recovery-results.json'); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed })); if (report.failed) process.exitCode = 1;
});
