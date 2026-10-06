const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), ts = require('typescript');
function extract(file, name) {
  const source = fs.readFileSync(path.resolve(__dirname, '../../', file), 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) {
      callback = ts.isCallExpression(node.initializer) ? node.initializer.arguments[0].getText(ast) : node.initializer.getText(ast);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(callback, name);
  return ts.transpileModule('(' + callback + ');', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
}
const code = {
  portrait: extract('src/app/persona/Tool.tsx', 'handleGeneratePortrait'),
  scene: extract('src/app/persona/Tool.tsx', 'handleGenerateScene'),
  banner: extract('src/components/persona/PersonaBannerGenerator.tsx', 'generate'),
};
const reader = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../src/lib/persona/image-response.ts'), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const CONTACT = 'https://example.invalid/support'; // Synthetic imported constant; no navigation.
function fixture(kind, scenario) {
  const persona = { persona: { name: 'synthetic' } }, requests = [], timers = new Map();
  let timerId = 0;
  const state = { image: '/api/persona/images/previous', error: '', loading: false, writes: 0, usage: 0, quota: null, action: null };
  const set = key => value => { state[key] = typeof value === 'function' ? value(state[key]) : value; };
  const env = {
    crypto: require('node:crypto'), AbortController,
    generatedData: persona, currentPersona: { current: persona }, currentRecordId: { current: 'synthetic' },
    portraitImage: state.image, sceneImages: { 'scene-1': state.image }, imageAttempts: { current: {} },
    imageRequests: { current: {} }, scenePending: { current: new Set() }, scenePrompts: { current: {} },
    setPortraitLoading: set('loading'), setPortraitError: set('error'), setPortraitImage: set('image'),
    setSceneLoading: f => { state.loading = f({ 'scene-1': state.loading })['scene-1']; },
    setSceneErrors: f => { state.error = f({ 'scene-1': state.error })['scene-1']; },
    setSceneImages: f => { state.image = f({ 'scene-1': state.image })['scene-1']; },
    setError: set('error'), setQuotaNotice: set('quota'), setQuotaAction: set('action'),
    accountStorage: {}, savePersonaImage: () => { if (scenario === 'save-fails') throw Error('SYNTHETIC_PRIVATE'); state.writes++; },
    PersonaQuotaError: class PersonaQuotaError extends Error {}, personaQuotaAction: body => body.upgradeUrl === '/persona/pricing' ? 'pricing' : null,
    projectId: 'synthetic', isPaid: true, catchphrase: 'synthetic', serviceName: '', sizeKey: 'google-responsive',
    image: state.image, loading: false, pending: { current: null }, controller: { current: null },
    setLoading: set('loading'), setErrorCode() {}, setImage: set('image'), onUsageChanged: () => state.usage++, SUPPORT_CONTACT_URL: CONTACT,
  };
  const exports = {};
  vm.runInNewContext(reader, { exports, Error, TextDecoder, TextEncoder, AbortController,
    setTimeout: (fn, ms) => { assert.equal(ms, 310000); timers.set(++timerId, fn); return timerId; },
    clearTimeout: id => timers.delete(id),
    fetch: (url, init) => new Promise((resolve, reject) => requests.push({ url, init, body: JSON.parse(init.body), resolve, reject })),
  });
  Object.assign(env, exports);
  const callback = vm.runInNewContext(code[kind], env);
  return { env, state, requests, timers, invoke: () => kind === 'scene' ? callback('synthetic prompt', 'scene-1') : callback() };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  let cases = 0;
  for (const kind of ['portrait', 'scene', 'banner']) {
    for (const scenario of ['success', 'object-image', 'truthy-success', 'foreign-url', 'invalid-json', 'private-network', 'fetch-deadline', 'body-deadline', 'late-result', 'quota', 'conflict', 'http401', 'http500', 'save-fails']) {
      const f = fixture(kind, scenario), first = f.invoke();
      await f.invoke(); assert.equal(f.requests.length, 1, kind + ' must reject same-turn duplicates');
      const req = f.requests[0]; assert.equal(req.init.signal.aborted, false); assert.equal(f.state.loading, true);
      if (scenario === 'private-network') req.reject(Error('SYNTHETIC_PRIVATE'));
      else if (scenario === 'fetch-deadline') for (const expire of f.timers.values()) expire();
      else if (scenario === 'body-deadline') {
        let canceled = 0;
        req.resolve(new Response(new ReadableStream({ pull() { return new Promise(() => {}); }, cancel() { canceled++; } })));
        await tick(); for (const expire of f.timers.values()) expire(); await first;
        assert.equal(canceled, 1);
      } else {
        if (scenario === 'late-result') {
          if (kind === 'banner') { f.env.controller.current.abort(); f.env.controller.current = null; }
          else { f.env.currentPersona.current = { persona: { name: 'newer' } }; f.env.scenePending.current = new Set(['newer']); }
        }
        const body = scenario === 'object-image' ? { success: true, image: {} }
          : scenario === 'truthy-success' ? { success: 'yes', image: '/api/persona/images/new' }
          : scenario === 'foreign-url' ? { success: true, image: 'https://example.invalid/image' }
          : scenario === 'quota' ? { code: 'DAILY_LIMIT_REACHED', error: 'SYNTHETIC_PRIVATE', upgradeUrl: '/persona/pricing' }
          : scenario === 'conflict' ? { code: 'REQUEST_CONFLICT', error: 'SYNTHETIC_PRIVATE' }
          : { success: true, image: '/api/persona/images/new', error: 'SYNTHETIC_PRIVATE' };
        req.resolve(scenario === 'invalid-json' ? new Response('{') : Response.json(body, { status: scenario === 'quota' ? 429 : scenario === 'conflict' ? 409 : scenario === 'http401' ? 401 : scenario === 'http500' ? 500 : 200 }));
      }
      await first;
      assert.equal(f.timers.size, 0, kind + ' clears reader timers');
      assert.ok(!f.state.error.includes('SYNTHETIC_PRIVATE'));
      if (['success', 'save-fails'].includes(scenario)) {
        assert.equal(f.state.image, '/api/persona/images/new');
        assert.equal(kind === 'banner' ? f.state.usage : f.state.writes, scenario === 'save-fails' && kind !== 'banner' ? 0 : 1);
      } else {
        assert.equal(f.state.image, '/api/persona/images/previous'); assert.equal(f.state.writes, 0); assert.equal(f.state.usage, 0);
        if (scenario !== 'late-result') assert.ok(f.state.error, kind + ' exposes failure');
      }
      if (scenario !== 'late-result') {
        assert.equal(f.state.loading, false);
        if (!['success', 'save-fails'].includes(scenario)) {
          if (scenario === 'quota') assert.equal(f.state.action, 'pricing');
          const retry = f.invoke(); assert.equal(f.requests.length, 2);
          assert.equal(f.requests[1].body.requestKey === req.body.requestKey, scenario !== 'conflict');
          f.requests[1].resolve(Response.json({ success: true, image: '/api/persona/images/recovered' })); await retry;
          assert.equal(f.state.image, '/api/persona/images/recovered'); assert.equal(f.state.error, '');
        }
      } else if (kind !== 'banner') assert.equal(f.env.scenePending.current.has('newer'), true);
      cases++;
    }
  }
  console.log(JSON.stringify({ passed: cases, scope: 'Actual portrait, scene and banner callbacks with actual response helper; synthetic state, fetch, clock and storage. No real AI, DB or browser E2E.' }));
})().catch(error => { console.error(error); process.exitCode = 1; });
