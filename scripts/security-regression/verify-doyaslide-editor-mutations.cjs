const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict');
const { check, results } = require('./load-typescript.cjs');
const file = 'src/app/doyaslide/[id]/page.tsx';
const source = fs.readFileSync(path.join(process.env.DOYA_TEST_ROOT || process.cwd(), file), 'utf8');
const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
const names = ['validSlides', 'validProject', 'readSlideResponse', 'reload', 'ensureOk', 'loadVersions', 'performSlideMutation', 'regenerate', 'revert', 'sendChat'];
const parts = {};
function visit(n) {
  if (ts.isFunctionDeclaration(n) && names.includes(n.name?.text)) parts[n.name.text] = n.getText(ast);
  if (ts.isVariableDeclaration(n) && names.includes(n.name.getText(ast))) parts[n.name.getText(ast)] = 'const ' + n.name.getText(ast) + '=' + (ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === 'useCallback' ? n.initializer.arguments[0] : n.initializer).getText(ast) + ';';
  ts.forEachChild(n, visit);
}
visit(ast);
for (const n of names) assert.ok(parts[n], 'missing actual source function ' + n);
function slide(imageUrl = null, index = 0) { return { id: 's' + index, projectId: 'synthetic', index, role: null, headline: null, subText: null, imageUrl, rawImageUrl: null, status: imageUrl ? 'done' : 'pending', version: 1, model: null }; }
function project(slides = [slide()]) { return { id: 'synthetic', title: 'synthetic', status: 'completed', aspectRatio: 'landscape', logoUrl: null, logoPosition: 'top-right', logoSize: 'M', logoBackingChip: false, slides }; }
const immediate = () => new Promise(r => setImmediate(r));
function fixture(handler, fetcher, overrideReload) {
  const state = { project: project([slide('https://example.invalid/old.png')]), selectedId: 's0', loading: true, versions: [{ id: 'old', version: 1, imageUrl: 'https://example.invalid/restored.png' }], chat: { s0: [] }, chatInput: 'synthetic edit' };
  const timers = new Map(), success = [], errors = [], requests = [];
  let timerId = 0, pollCallback, pollCleared = false;
  const toast = m => errors.push(m); toast.error = m => errors.push(m); toast.success = m => success.push(m);
  const context = { id: 'synthetic', selected: slide('https://example.invalid/old.png'), chatInput: state.chatInput, versions: state.versions, versionsError: null, versionsSequence: { current: 0 }, versionsTarget: { current: 's0' }, selectedSlideRef: { current: 's0' }, AbortController, mountedRef: { current: true }, projectReadSequence: { current: 0 }, projectReadsActive: { current: 0 }, generationBusyRef: { current: false }, slideMutationBusyRef: { current: false }, pollRef: { current: null }, toast,
    showQuotaNotice: (res, d) => { if (res.status !== 403 || d?.code !== 'LIMIT_REACHED') return false; state.limitMsg = d.error; state.limitUpgradeUrl = d.upgradeUrl === '/doyaslide/pricing' ? d.upgradeUrl : null; return true; },
    setInterval: fn => { pollCallback = fn; return 1; }, stopPoll: () => { pollCleared = true; },
    window: { setTimeout: (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId; }, clearTimeout: id => timers.delete(id) },
    fetch: async (url, init) => { requests.push({ url, init }); return fetcher(url, init, requests.length); }
  };
  for (const setter of new Set(source.match(/\bset[A-Z]\w*/g) || [])) if (!context[setter]) context[setter] = v => { const k = setter[3].toLowerCase() + setter.slice(4); state[k] = typeof v === 'function' ? v(state[k]) : v; };
  if (overrideReload) context.reload = overrideReload;
  vm.runInNewContext(ts.transpileModule(Object.entries(parts).filter(([name]) => !overrideReload || name !== 'reload').map(([, code]) => code).join('\n') + '\nglobalThis.api={regenerate,revert,sendChat,loadVersions};globalThis.run=' + handler + ';', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  if (overrideReload) context.reload = overrideReload;
  return { run: (...args) => context.run(...args), context, state, timers, success, errors, requests, fire: ms => { for (const [id, t] of [...timers]) if (t.ms === ms) { timers.delete(id); t.fn(); } }, poll: () => pollCallback(), pollCleared: () => pollCleared };
}
function response(data, status = 200) { return { ok: status >= 200 && status < 300, status, json: async () => data }; }

(async () => {
  const ack = slide('https://example.invalid/restored.png');
  const invoke = (f, name) => f.run(name === 'regenerate' ? 's0' : name === 'revert' ? 1 : undefined);
  for (const name of ['regenerate', 'revert', 'sendChat']) {
    await check(name + ' requires a valid slide acknowledgment and a matching confirmed refresh', async () => {
      for (const mode of ['empty', 'null', 'foreign', 'wrong_slide', 'missing_image', 'bad_reply', 'refresh_missing', 'refresh_mismatch', 'network', 'body', 'http_error']) {
        const data = { slide: { ...ack }, reply: '修正を反映しました。' };
        if (mode === 'foreign') data.slide.projectId = 'foreign';
        if (mode === 'wrong_slide') data.slide.id = 'another';
        if (mode === 'missing_image') data.slide.imageUrl = null;
        if (mode === 'bad_reply') data.reply = null;
        if (mode === 'bad_reply' && name !== 'sendChat') continue;
        const f = fixture(name, async (_, init) => {
          if (mode === 'network') throw Error('SYNTHETIC_PRIVATE');
          if (mode === 'body') return { ok: true, status: 200, json: async () => { throw Error('SYNTHETIC_PRIVATE'); } };
          return response(mode === 'empty' ? {} : mode === 'null' ? null : data, mode === 'http_error' ? 500 : 200);
        }, async () => mode === 'refresh_missing' ? null : project([mode === 'refresh_mismatch' ? slide() : ack]));
        const input = f.state.chatInput; await invoke(f, name); assert.equal(f.success.length, 0, name + ':' + mode); assert.equal(f.state.chatInput, input); assert.equal(f.state.chat.s0.length, 0); assert.equal(f.context.slideMutationBusyRef.current, false); assert.equal(f.state.busySlide, null); assert.equal(f.timers.size, 0); assert.doesNotMatch(f.errors.join(), /SYNTHETIC_PRIVATE/);
      }
    });
    await check(name + ' succeeds only after confirmation and releases its lock', async () => {
      const f = fixture(name, async (url, init) => init.method === 'POST' ? response({ slide: ack, reply: '修正を反映しました。' }) : response({ versions: [] }), async () => project([ack]));
      await invoke(f, name); await immediate(); assert.equal(f.success.length, 1); assert.equal(f.context.slideMutationBusyRef.current, false); assert.equal(f.state.busySlide, null); assert.equal(f.timers.size, 0);
      if (name === 'sendChat') { assert.equal(f.state.chat.s0.length, 2); assert.equal(f.state.chat.s0[0].role, 'user'); assert.equal(f.state.chat.s0[1].role, 'assistant'); assert.equal(f.state.chatInput, ''); assert.equal(f.state.chatBusy, false); }
    });
    await check(name + ' bounds response-body waiting and never automatically repeats an uncertain write', async () => {
      const f = fixture(name, async (_, init) => ({ ok: true, status: 200, json: () => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(Error('SYNTHETIC_PRIVATE')), { once: true })) }), async () => project());
      const p = invoke(f, name); await immediate(); assert.equal(f.timers.size, 1); await invoke(f, name); assert.equal(f.requests.length, 1); f.fire(310000); await p; assert.equal(f.success.length, 0); assert.equal(f.state.busySlide, null); assert.equal(f.context.slideMutationBusyRef.current, false); assert.equal(f.state.chatInput, 'synthetic edit'); assert.equal(f.timers.size, 0);
    });
  }
  await check('quota rejection preserves its upgrade notice and chat draft', async () => { const f = fixture('sendChat', async () => response({ code: 'LIMIT_REACHED', error: '上限です', upgradeUrl: '/doyaslide/pricing' }, 403), async () => project()); await f.run(); assert.equal(f.state.limitUpgradeUrl, '/doyaslide/pricing'); assert.equal(f.state.chatInput, 'synthetic edit'); assert.equal(f.success.length, 0); });
  await check('revert verifies the selected history image and rejects unavailable or stale histories before issuing a write', async () => {
    for (const mode of ['missing', 'wrong_slide', 'read_error', 'wrong_image']) {
      const f = fixture('revert', async () => response({ slide: { ...ack, imageUrl: 'https://example.invalid/another.png' } }), async () => project([{ ...ack, imageUrl: 'https://example.invalid/another.png' }]));
      if (mode === 'missing') f.context.versions = []; if (mode === 'wrong_slide') f.context.versionsTarget.current = 'other'; if (mode === 'read_error') f.context.versionsError = 'read failed';
      await f.run(1); assert.equal(f.success.length, 0); assert.equal(f.requests.length, mode === 'wrong_image' ? 1 : 0); assert.equal(f.context.slideMutationBusyRef.current, false);
    }
  });
  await check('history refresh preserves confirmed same-slide history on unconfirmed responses', async () => {
    for (const mode of ['empty', 'null', 'foreign', 'invalid_version', 'duplicate', 'network', 'body', 'server']) {
      const good = { id: 'v', slideId: 's0', version: 1, imageUrl: 'https://example.invalid/history.png', createdAt: '2026-10-06T00:00:00Z' }; const data = { versions: [{ ...good }] };
      if (mode === 'foreign') data.versions[0].slideId = 'another'; if (mode === 'invalid_version') data.versions[0].version = '1'; if (mode === 'duplicate') data.versions.push(good);
      const f = fixture('loadVersions', async () => { if (mode === 'network') throw Error('SYNTHETIC_PRIVATE'); if (mode === 'body') return { ok: true, status: 200, json: async () => { throw Error('SYNTHETIC_PRIVATE'); } }; return response(mode === 'empty' ? {} : mode === 'null' ? null : data, mode === 'server' ? 503 : 200); });
      const old = f.state.versions; await f.run('s0'); assert.equal(f.state.versions, old); assert.ok(f.state.versionsError); assert.doesNotMatch(f.state.versionsError, /SYNTHETIC_PRIVATE/); assert.equal(f.timers.size, 0);
    }
  });
  await check('history accepts valid empty data and clears private data on definitive access failure', async () => { for (const status of [200, 401, 403, 404]) { const f = fixture('loadVersions', async () => response({ versions: [] }, status)); await f.run('s0'); assert.equal(f.state.versions.length, 0); assert.equal(!!f.state.versionsError, status !== 200); } });
  await check('history body deadline and out-of-order selection reads never overwrite another slide history', async () => {
    const f = fixture('loadVersions', async (_, init) => ({ ok: true, status: 200, json: () => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(Error('SYNTHETIC_PRIVATE')), { once: true })) })); const p = f.run('s0'); await immediate(); f.fire(30000); await p; assert.equal(f.timers.size, 0); assert.ok(f.state.versionsError);
    const pending = []; const g = fixture('loadVersions', async () => ({ ok: true, status: 200, json: () => new Promise(resolve => pending.push(resolve)) })); const a = g.run('s0'); await immediate(); g.context.selectedSlideRef.current = 's1'; const b = g.run('s1'); await immediate(); assert.equal(g.state.versions.length, 0); const newest = { id: 'new', slideId: 's1', version: 2, imageUrl: 'https://example.invalid/new.png', createdAt: '2026-10-06T00:00:00Z' }; pending[1]({ versions: [newest] }); await b; pending[0]({ versions: [] }); await a; assert.equal(g.state.versions[0].id, 'new'); assert.equal(g.state.versionsError, null);
  });
  await check('a chat success never clears a newer draft and unmounted operations do not append messages', async () => {
    for (const unmount of [false, true]) { let release; const f = fixture('sendChat', async (url, init) => init.method === 'POST' ? { ok: true, status: 200, json: () => new Promise(resolve => release = resolve) } : response({ versions: [] }), async () => project([ack])); const p = f.run(); await immediate(); f.state.chatInput = 'new draft'; if (unmount) f.context.mountedRef.current = false; release({ slide: ack, reply: 'confirmed' }); await p; await immediate(); assert.equal(f.state.chatInput, 'new draft'); assert.equal(f.state.chat.s0.length, unmount ? 0 : 2); assert.equal(f.context.slideMutationBusyRef.current, false); }
  });
  await check('different slide mutations share the same lock and off-selection history refresh leaves the current history intact', async () => {
    let release; const f = fixture('sendChat', async (_, init) => ({ ok: true, status: 200, json: () => new Promise(resolve => release = resolve) }), async () => project([ack]));
    const p = f.run(); await immediate(); await f.context.api.regenerate('s0'); await f.context.api.revert(1); assert.equal(f.requests.length, 1); f.context.mountedRef.current = false; release({ slide: ack, reply: 'confirmed' }); await p;
    const g = fixture('loadVersions', async () => response({ versions: [] })); const old = g.state.versions; g.context.selectedSlideRef.current = 's1'; await g.run('s0'); assert.equal(g.state.versions, old); assert.equal(g.requests.length, 0);
  });
  console.log(JSON.stringify({ passed: results.length, scope: 'Actual AST-extracted editor mutation/history/read functions; synthetic fetch/state/clock/project. No real history writes or paid AI calls.', results }, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
