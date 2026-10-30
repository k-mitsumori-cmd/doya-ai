process.env.NODE_ENV = 'test';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const scenarios = ['actor-switch', 'late-failure', 'unmount', 'aba', 'same-actor', 'normal', 'reference-await', 'crop-await', 'after-one-image', 'independent-new-actor', 'network-abort', 'limit', 'transient-error'];

if (!process.env.DOYA_BATCH_SCENARIO) {
  const cases = [];
  for (const scenario of scenarios) {
    const child = spawnSync(process.execPath, [__filename], {
      env: { ...process.env, DOYA_BATCH_SCENARIO: scenario }, encoding: 'utf8', timeout: 15000,
    });
    if (child.error || child.status !== 0) {
      process.stderr.write(child.stdout || ''); process.stderr.write(child.stderr || '');
      if (child.error) console.error(child.error);
      process.exit(child.status || 1);
    }
    const result = child.stdout.split('\n').find(line => line.startsWith('{'));
    assert(result, 'Each mounted scenario must produce observations');
    cases.push(JSON.parse(result));
    console.log('PASS Tenjikai batch scope: ' + scenario);
  }
  const report = { passed: cases.length, cases, scope: 'Actual BoothStudio, runPanelBatch, requestImages and engine/graphics mounted in React StrictMode. Synthetic HTTP responses, quota, image preprocessing and decorative children. No real accounts, providers, charge, storage or network.' };
  fs.writeFileSync(path.join(root, 'docs/audits/2026-10-06-all-services-recheck/tenjikai-batch-scope-mounted-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: cases.length, scope: report.scope }));
  process.exit(0);
}

const mode = process.env.DOYA_BATCH_SCENARIO;
assert(scenarios.includes(mode));
const React = require('react');
const { JSDOM } = require('jsdom');
const ts = require('typescript');
const { load } = require('./load-typescript.cjs');
const dom = new JSDOM('<body><main></main></body>', { url: 'https://synthetic.invalid/tenjikai/booth' });
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
const engine = load('src/lib/tenjikai/engine.ts');
const kit = load('src/lib/tenjikai/design-kit.ts');
const fit = load('src/lib/tenjikai/image-fit.ts');
const image = load('src/lib/tenjikai/imagegen.ts', { './design-kit': kit, './image-fit': fit });
const graphics = load('src/lib/tenjikai/graphics.ts', { './design-kit': kit, './imagegen': image, './image-fit': fit });
const batch = load('src/lib/tenjikai/batch.ts');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
let actor = 'A';
const requests = [], writes = [], refreshes = [], references = [], crops = [];
const referenceGate = deferred(), cropGate = deferred();

function fakeFetch(url, options) {
  assert.equal(url, '/api/tenjikai/image');
  assert.equal(options.method, 'POST');
  const body = JSON.parse(options.body);
  assert.equal(body.approved, true); assert.equal(body.count, 1); assert.equal(body.kind, 'graphic_panel');
  const pending = deferred();
  const onAbort = () => pending.reject(new Error('synthetic transport abort'));
  const remove = () => options.signal?.removeEventListener('abort', onAbort);
  const record = {
    actor, signal: options.signal,
    resolve(status = 200) {
      remove();
      pending.resolve(new Response(JSON.stringify({ images: ['data:image/png;base64,c3ludGhldGlj'], error: 'synthetic' }), { status }));
    },
    reject() { remove(); pending.reject(new Error('synthetic late failure')); },
  };
  requests.push(record);
  // Most scenarios deliberately ignore abort to reproduce a noncooperating late response.
  if (mode === 'network-abort') options.signal?.addEventListener('abort', onAbort, { once: true });
  return pending.promise;
}

const client = load('src/components/tenjikai/useImageGen.ts', { react: React }, { fetch: fakeFetch });
const Null = () => null;
const mocks = {
  react: React, 'react/jsx-runtime': require('react/jsx-runtime'), clsx: require('clsx'),
  'framer-motion': { AnimatePresence: ({ children }) => children, motion: new Proxy({}, { get: (_, tag) => ({ children }) => React.createElement(tag, null, children) }) },
  'lucide-react': new Proxy({}, { get: () => Null }),
  '@/lib/tenjikai/engine': engine, '@/lib/tenjikai/graphics': graphics, '@/lib/tenjikai/imagegen': image,
  '@/lib/tenjikai/batch': batch, '@/lib/tenjikai/tokens': load('src/lib/tenjikai/tokens.ts'),
  '@/lib/tenjikai/image-fit': {
    ...fit,
    toReferencePng: async value => { references.push(value); return mode === 'reference-await' ? referenceGate.promise : 'synthetic-reference'; },
    cropImageToAspect: async value => { crops.push(value); return mode === 'crop-await' ? cropGate.promise : value; },
  },
  './useImageGen': { ...client, useImageQuota: () => ({ quota: { enabled: true, remaining: 99, perDay: 100 }, refresh: async () => { refreshes.push(actor); } }) },
  '@/components/one-button/context': { useOneButton: () => false },
  '@/components/one-button/OneButtonBar': { OneButtonBar: Null },
  '@/components/shell/power': { ShellCostBadge: Null },
  '@/components/shell/DoyaWorking': { __esModule: true, default: Null },
  './ui': { PageHeader: Null, CountUp: ({ value }) => React.createElement('span', null, String(value)), Modal: ({ open, children }) => open ? children : null },
  '@/components/ds/next-step': { FlowSteps: Null, NextStepBar: ({ action }) => React.createElement('section', null, action), NextStepAction: ({ children, onClick, disabled }) => React.createElement('button', { onClick, disabled }, children) },
  'next/image': { __esModule: true, default: Null },
};
for (const name of ['IsoBooth', 'Booth3D', 'GraphicPlanner', 'ImageGenModal', 'EmptyState', 'BoothSizeInput', 'DesignKitStudio']) mocks['./' + name] = { __esModule: true, default: Null };
const file = 'src/components/tenjikai/BoothStudio.tsx';
const baseline = process.env.DOYA_TEST_BASELINE && path.join(process.env.DOYA_TEST_BASELINE, file);
const source = fs.readFileSync(baseline && fs.existsSync(baseline) ? baseline : path.join(root, file), 'utf8');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, {
  exports: exportsObject, require: name => { if (name in mocks) return mocks[name]; throw Error('Unmocked ' + name); },
  console, window: dom.window, document: dom.window.document, AbortController,
  fetch: () => { throw Error('Unmocked network is prohibited'); },
});
const Component = exportsObject.default;
const input = engine.SAMPLE_INPUT, generated = engine.mockGeneratedPlan(input), plans = engine.generateBoothPlans(input);
const panels = graphics.generateGraphicPlan(plans[0], generated.analysis), designKit = kit.deriveKit(generated.analysis);
const hero = panels.find(panel => panel.layout === 'hero');
assert(hero, 'The actual fixture must include its master panel');
const host = document.querySelector('main'), mounted = createRoot(host);
const act = fn => React.act(async () => { await fn(); for (let i = 0; i < 3; i++) await new Promise(setImmediate); });
function props(owner) {
  return {
    plans, variant: 'A', setVariant() {}, input, analysis: generated.analysis,
    panelImages: mode === 'reference-await' ? { [hero.id]: 'data:image/png;base64,c3ludGhldGlj' } : {},
    setPanelImages() { writes.push({ owner, actor }); }, kit: designKit, kitConfirmed: true,
    onKitChange() {}, onKitConfirm() {}, onKitReopen() {},
  };
}
const render = owner => { actor = owner; return act(() => mounted.render(React.createElement(React.StrictMode, null, React.createElement(Component, { key: owner, ...props(owner) })))); };
async function start() {
  const open = [...host.querySelectorAll('button')].find(button => button.textContent.includes('面の画像をまとめて作る'));
  assert(open && !open.disabled, 'Actual batch action must be available');
  await act(() => open.click());
  const confirm = [...host.querySelectorAll('button')].find(button => button.textContent.trim() === '作りはじめる');
  assert(confirm && !confirm.disabled, 'Actual confirmation must be enabled');
  await act(() => confirm.click());
}
async function finishFrom(index, status = 200) {
  assert(requests[index], 'The expected request must already have started');
  await act(() => requests[index].resolve(status));
}

(async () => {
  await render('A'); await start();
  if (mode === 'reference-await') {
    assert.equal(references.length, 1); assert.equal(requests.length, 0);
    await render('B'); await act(() => referenceGate.resolve('synthetic-reference'));
    assert.equal(requests.length, 0); assert.equal(writes.length, 0); assert.equal(refreshes.length, 0);
  } else if (['normal', 'same-actor', 'transient-error'].includes(mode)) {
    if (mode === 'same-actor') await render('A');
    for (let i = 0; i < panels.length; i++) await finishFrom(i, mode === 'transient-error' && i === 0 ? 500 : 200);
    assert.equal(requests.length, panels.length);
    assert.equal(writes.length, panels.length - (mode === 'transient-error' ? 1 : 0));
    assert.deepEqual(refreshes, ['A']);
  } else if (mode === 'limit') {
    await finishFrom(0, 429);
    assert.equal(requests.length, 1); assert.equal(writes.length, 0); assert.deepEqual(refreshes, ['A']);
  } else if (mode === 'independent-new-actor') {
    await render('B'); await start();
    assert.equal(requests.length, 2);
    await finishFrom(0);
    assert.equal(requests.length, 2); assert.equal(writes.length, 0);
    for (let i = 1; i <= panels.length; i++) await finishFrom(i);
    assert.equal(requests.length, panels.length + 1); assert.equal(writes.length, panels.length);
    assert(writes.every(write => write.owner === 'B' && write.actor === 'B'));
    assert.deepEqual(refreshes, ['B']);
  } else {
    if (mode === 'crop-await') { await finishFrom(0); assert.equal(crops.length, 1); }
    if (mode === 'after-one-image') { await finishFrom(0); assert.equal(writes.length, 1); assert.equal(requests.length, 2); }
    const accepted = writes.length, count = requests.length;
    if (mode === 'unmount') { actor = 'none'; await act(() => mounted.render(null)); }
    else { await render('B'); if (mode === 'aba') await render('A'); }
    if (mode === 'crop-await') await act(() => cropGate.resolve('synthetic-fitted'));
    else if (mode === 'late-failure') await act(() => requests[0].reject());
    else if (mode !== 'network-abort') await finishFrom(count - 1);
    assert.equal(requests.length, count, 'No new POST after retiring the old scope');
    assert.equal(writes.length, accepted, 'No late image callback after scope retirement');
    assert.equal(refreshes.length, 0, 'Retired work must not refresh the new actor quota');
    assert(requests[0].signal?.aborted, 'The real request helper must receive the retiring signal');
  }
  assert(requests.every(request => request.signal), 'Every actual HTTP helper call receives a scope signal');
  const result = { scenario: mode, requests: requests.length, requestActors: requests.map(request => request.actor), abortedBeforeCleanup: requests.map(request => request.signal?.aborted || false), acceptedImageCallbacks: writes, quotaRefreshes: refreshes, actualRequestHelper: true, realNetworkCalls: 0 };
  await act(() => mounted.unmount());
  console.log(JSON.stringify(result));
})().catch(error => { console.error(error); process.exitCode = 1; });
