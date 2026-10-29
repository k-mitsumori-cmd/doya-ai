// React's mounted regression harness needs the test runtime even in a production build job.
process.env.NODE_ENV = 'test';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const React = require('react');
const ts = require('typescript');
const { JSDOM } = require('jsdom');
const root = process.env.DOYA_TEST_BASELINE || path.resolve(__dirname, '../..');
const dom = new JSDOM('<body></body>', { url: 'https://synthetic.invalid/tenjikai/overview' });
global.window = dom.window;
global.document = dom.window.document;
global.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
const timers = new Map(), saves = [], commits = [], requests = [], routes = [];
let timerId = 0, actor, section = 'overview', mountedRoot, host, wizardProps, generatingProps, overviewProps;
dom.window.setTimeout = fn => { const id = ++timerId; timers.set(id, fn); return id; };
dom.window.clearTimeout = id => timers.delete(id);
const act = fn => React.act(async () => { await fn(); for (let i = 0; i < 4; i++) await new Promise(setImmediate); });
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, {
    exports, require: name => { if (name in mocks) return mocks[name]; throw Error('Unmocked ' + name); },
    console, window: dom.window, Date, fetch: () => { throw Error('Provider/network request prohibited'); },
  }, { filename: file });
  return exports;
}
const engine = load('src/lib/tenjikai/engine.ts');
const store = load('src/lib/tenjikai/local-store.ts');
const nav = load('src/lib/tenjikai/nav.ts');
const Null = () => null;
function marker(kind) {
  return function Marker(props) {
    if (kind === 'wizard') wizardProps = props;
    if (kind === 'generating') generatingProps = props;
    if (kind === 'overview') overviewProps = props;
    const value = JSON.stringify({ kind, input: props.input ?? props.initial, panelImages: props.panelImages });
    React.useLayoutEffect(() => { commits.push({ actor, value }); });
    return React.createElement('div', { 'data-view': kind }, value);
  };
}
const mocks = {
  react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
  'framer-motion': { motion: { div: Null, button: Null }, AnimatePresence: Null },
  'lucide-react': { Menu: Null },
  'next/navigation': { usePathname: () => '/tenjikai/' + section, useRouter: () => ({ push: href => routes.push(href) }) },
  '@/lib/tenjikai/nav': nav,
  '@/lib/tenjikai/engine': { ...engine, requestGeneratedPlan: input => new Promise(resolve => requests.push({ input, resolve })) },
  '@/lib/tenjikai/local-store': { ...store, saveProject: (id, project) => { saves.push({ actor: id, project: structuredClone(project) }); return store.saveProject(id, project); } },
};
for (const name of ['TenjikaiSidebar', 'BoothStudio', 'CreativeStudio', 'NoveltyPicker', 'BudgetPlanner', 'VendorBoard', 'DocsVault']) mocks['./' + name] = { __esModule: true, default: marker(name) };
mocks['./Wizard'] = { __esModule: true, default: marker('wizard') };
mocks['./Generating'] = { __esModule: true, default: marker('generating') };
mocks['./Overview'] = { __esModule: true, default: marker('overview') };
const App = load('src/components/tenjikai/TenjikaiApp.tsx', mocks).default;
const A = 'synthetic-a', B = 'synthetic-b';
function project(label) {
  const input = { ...engine.SAMPLE_INPUT, eventName: label };
  return { input, generated: engine.mockGeneratedPlan(input), variant: 'B', selectedNovelty: [label + '-selection'], panelImages: { front: 'https://synthetic.invalid/' + label } };
}
const seed = (id, label) => { assert.equal(store.saveProject(id, project(label)), 'saved'); };
const render = id => { actor = id; return act(() => mountedRoot.render(React.createElement(React.StrictMode, null, React.createElement(App, { shell: true, userId: id })))); };
const flush = () => act(() => { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } });
const noForeignCommits = (id, label) => assert.ok(!commits.some(c => c.actor === id && c.value.includes(label)), 'Foreign project must never commit for new actor');
const noForeignSaves = (id, label) => assert.ok(!saves.some(s => s.actor === id && JSON.stringify(s.project).includes(label)), 'Foreign project must never save under new actor');
const checks = [];
async function test(name, run) {
  if (mountedRoot) await act(() => mountedRoot.unmount());
  host?.remove(); dom.window.localStorage.clear(); timers.clear(); saves.length = commits.length = requests.length = routes.length = 0;
  wizardProps = generatingProps = overviewProps = undefined; section = 'overview';
  host = document.createElement('div'); document.body.append(host); mountedRoot = createRoot(host);
  await run(); checks.push(name); console.log('PASS', name);
}
(async () => {
  try {
    await test('Saved A to empty B never displays or autosaves A under B', async () => {
      seed(A, 'A_PRIVATE'); const original = dom.window.localStorage.getItem(store.storeKey(A));
      await render(A); assert(host.textContent.includes('A_PRIVATE')); await render(B); await flush();
      noForeignCommits(B, 'A_PRIVATE'); noForeignSaves(B, 'A_PRIVATE'); assert.equal(store.loadProject(B), null);
      assert.equal(dom.window.localStorage.getItem(store.storeKey(A)), original); assert(host.querySelector('[data-view=wizard]'));
    });
    await test('Saved A to saved B restores B without a transient A commit or write', async () => {
      seed(A, 'A_PRIVATE'); seed(B, 'B_PRIVATE'); await render(A); await render(B); await flush();
      noForeignCommits(B, 'A_PRIVATE'); noForeignSaves(B, 'A_PRIVATE'); assert(host.textContent.includes('B_PRIVATE'));
      assert.equal(store.loadProject(B).input.eventName, 'B_PRIVATE');
    });
    await test('Authenticated to anonymous never copies a private saved project', async () => {
      seed(A, 'A_PRIVATE'); await render(A); await render(null); await flush();
      noForeignCommits(null, 'A_PRIVATE'); noForeignSaves(null, 'A_PRIVATE'); assert.equal(store.loadProject(null), null);
    });
    await test('Anonymous to authenticated never copies anonymous saved project', async () => {
      seed(null, 'ANON_PRIVATE'); await render(null); await render(A); await flush();
      noForeignCommits(A, 'ANON_PRIVATE'); noForeignSaves(A, 'ANON_PRIVATE'); assert.equal(store.loadProject(A), null);
    });
    await test('Pending autosave is cancelled at actor switch before timer runs', async () => {
      seed(A, 'A_PRIVATE'); await render(A); assert(timers.size > 0); await render(B); await flush();
      assert.equal(saves.length, 0); assert.equal(store.loadProject(B), null);
    });
    await test('Same actor rerender preserves an unsaved generation and admits no duplicate request', async () => {
      section = 'new'; await render(A); const input = project('A_UNSAVED').input;
      await act(() => wizardProps.onSubmit(input)); await render(A);
      assert.equal(requests.length, 1); assert(host.querySelector('[data-view=generating]'));
      await act(() => requests[0].resolve(engine.mockGeneratedPlan(input))); await act(() => generatingProps.onDone());
      section = 'overview'; await render(A); await flush(); assert(host.textContent.includes('A_UNSAVED'));
      assert.equal(store.loadProject(A).input.eventName, 'A_UNSAVED');
    });
    await test('Late generation for A cannot display, save or navigate B', async () => {
      section = 'new'; await render(A); const input = project('A_LATE').input;
      await act(() => wizardProps.onSubmit(input)); const oldDone = generatingProps.onDone;
      await render(B); await act(() => { oldDone(); requests[0].resolve(engine.mockGeneratedPlan(input)); }); await flush();
      noForeignCommits(B, 'A_LATE'); noForeignSaves(B, 'A_LATE'); assert.equal(routes.length, 0); assert.equal(store.loadProject(B), null);
    });
    await test('ABA switch never lets old A generation replace a new A generation', async () => {
      section = 'new'; await render(A); const oldInput = project('A_OLD').input, freshInput = project('A_FRESH').input;
      await act(() => wizardProps.onSubmit(oldInput)); const oldDone = generatingProps.onDone;
      await render(B); await render(A); await act(() => wizardProps.onSubmit(freshInput));
      assert.equal(requests.length, 2); await act(() => { oldDone(); requests[0].resolve(engine.mockGeneratedPlan(oldInput)); });
      assert.equal(routes.length, 0); assert(host.querySelector('[data-view=generating]'));
      await act(() => requests[1].resolve(engine.mockGeneratedPlan(freshInput))); await act(() => generatingProps.onDone());
      section = 'overview'; await render(A); await flush(); assert.equal(store.loadProject(A).input.eventName, 'A_FRESH');
      assert(!host.textContent.includes('A_OLD')); assert.equal(routes.length, 1);
    });
    await test('Same actor navigation preserves stored images, variant and novelty choices', async () => {
      seed(A, 'A_PRIVATE'); await render(A); await flush();
      assert.equal(store.loadProject(A).variant, 'B'); assert.deepEqual(Array.from(store.loadProject(A).selectedNovelty), ['A_PRIVATE-selection']);
      section = 'booth'; await render(A); assert(host.textContent.includes('https://synthetic.invalid/A_PRIVATE'));
      section = 'overview'; await render(A); await flush(); assert.equal(store.loadProject(A).panelImages.front, 'https://synthetic.invalid/A_PRIVATE');
    });
    console.log(JSON.stringify({ passed: checks.length, checks, scope: 'Actual TenjikaiApp, local-store and pure engine in React18 StrictMode; marker children, synthetic actor props/JSDOM storage, controlled timers/deferred generation only. No real accounts/provider/network/DB/production calls.' }));
  } finally {
    if (mountedRoot) await act(() => mountedRoot.unmount());
    host?.remove(); dom.window.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
