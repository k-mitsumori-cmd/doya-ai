const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict');
const { check, results } = require('./load-typescript.cjs');
const file = 'src/app/doyaslide/[id]/page.tsx';
const source = fs.readFileSync(path.join(process.env.DOYA_TEST_ROOT || process.cwd(), file), 'utf8');
const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
const names = ['validSlides', 'validProject', 'readSlideResponse', 'reload', 'ensureOk', 'runGenerate'];
const parts = {};
function visit(n) {
  if (ts.isFunctionDeclaration(n) && names.includes(n.name?.text)) parts[n.name.text] = n.getText(ast);
  if (ts.isVariableDeclaration(n) && names.includes(n.name.getText(ast))) parts[n.name.getText(ast)] = 'const ' + n.name.getText(ast) + '=' + n.initializer.arguments[0].getText(ast) + ';';
  ts.forEachChild(n, visit);
}
visit(ast);
for (const n of names) assert.ok(parts[n], 'missing actual source function ' + n);
function slide(imageUrl = null, index = 0) { return { id: 's' + index, projectId: 'synthetic', index, role: null, headline: null, subText: null, imageUrl, rawImageUrl: imageUrl, status: imageUrl ? 'done' : 'pending', version: 1, model: imageUrl ? 'synthetic' : null }; }
function project(slides = [slide()]) { return { id: 'synthetic', title: 'synthetic', status: 'completed', aspectRatio: 'landscape', logoUrl: null, logoPosition: 'top-right', logoSize: 'M', logoBackingChip: false, slides }; }
const immediate = () => new Promise(r => setImmediate(r));
function fixture(handler, fetcher, overrideReload) {
  const state = { project: project([slide('https://example.invalid/old.png')]), selectedId: 's0', loading: true, versions: [{ id: 'old' }], chat: { s0: ['old'] } };
  const timers = new Map(), success = [], errors = [], requests = [];
  let timerId = 0, pollCallback, pollCleared = false;
  const toast = m => errors.push(m); toast.error = m => errors.push(m); toast.success = m => success.push(m);
  const context = { id: 'synthetic', AbortController, mountedRef: { current: true }, projectReadSequence: { current: 0 }, projectReadsActive: { current: 0 }, generationBusyRef: { current: false }, slideMutationBusyRef: { current: false }, pollRef: { current: null }, toast,
    showQuotaNotice: (res, d) => { if (res.status !== 403 || d?.code !== 'LIMIT_REACHED') return false; state.limitMsg = d.error; state.limitUpgradeUrl = d.upgradeUrl === '/doyaslide/pricing' ? d.upgradeUrl : null; return true; },
    setInterval: fn => { pollCallback = fn; return 1; }, stopPoll: () => { pollCleared = true; },
    window: { setTimeout: (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId; }, clearTimeout: id => timers.delete(id) },
    fetch: async (url, init) => { requests.push({ url, init }); return fetcher(url, init, requests.length); }
  };
  for (const setter of new Set(source.match(/\bset[A-Z]\w*/g) || [])) if (!context[setter]) context[setter] = v => { const k = setter[3].toLowerCase() + setter.slice(4); state[k] = typeof v === 'function' ? v(state[k]) : v; };
  if (overrideReload) context.reload = overrideReload;
  vm.runInNewContext(ts.transpileModule(Object.entries(parts).filter(([name]) => !overrideReload || name !== 'reload').map(([, code]) => code).join('\n') + '\nglobalThis.run=' + handler + ';', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  if (overrideReload) context.reload = overrideReload;
  require('./doyaslide-editor-operation-fixture.cjs')(context);
  return { run: (...args) => context.run(...args), context, state, timers, success, errors, requests, fire: ms => { for (const [id, t] of [...timers]) if (t.ms === ms) { timers.delete(id); t.fn(); } }, poll: () => pollCallback(), pollCleared: () => pollCleared };
}
function response(data, status = 200) { return { ok: status >= 200 && status < 300, status, json: async () => data }; }
(async () => {
  await check('project refresh preserves last confirmed data and exposes persistent errors for bad responses', async () => {
    for (const scenario of ['503', 'empty', 'null', 'foreign', 'bad_slide', 'duplicate', 'network', 'body']) {
      const f = fixture('reload', async () => {
        if (scenario === 'network') throw new Error('SYNTHETIC_PRIVATE');
        if (scenario === 'body') return { ok: true, status: 200, json: async () => { throw new Error('SYNTHETIC_PRIVATE'); } };
        const p = project(); if (scenario === 'foreign') p.id = 'foreign'; if (scenario === 'bad_slide') p.slides[0].headline = {};
        if (scenario === 'duplicate') p.slides.push(p.slides[0]);
        return response(scenario === 'empty' ? {} : scenario === 'null' ? null : { project: p }, scenario === '503' ? 503 : 200);
      });
      const old = f.state.project; assert.equal(await f.run(), null); assert.equal(f.state.project, old); assert.equal(f.state.loading, false); assert.ok(f.state.projectReadError); assert.doesNotMatch(f.state.projectReadError, /SYNTHETIC_PRIVATE/); assert.equal(f.timers.size, 0);
    }
  });
  await check('definitive auth/access/missing responses clear private state without needing a response body', async () => {
    for (const status of [401, 403, 404]) { let bodyRead = false; const f = fixture('reload', async () => ({ ok: false, status, json: () => { bodyRead = true; throw Error('unreadable'); } })); await f.run(); assert.equal(bodyRead, false); assert.equal(f.state.project, null); assert.equal(f.state.selectedId, null); assert.equal(f.state.versions.length, 0); assert.equal(Object.keys(f.state.chat).length, 0); assert.ok(f.state.projectReadError); }
  });
  await check('valid refresh restores data and keeps only a selection that exists in the confirmed project', async () => {
    const f = fixture('reload', async () => response({ project: project([slide(null, 1)]) })); f.state.projectReadError = 'old error'; await f.run(); assert.equal(f.state.selectedId, 's1'); assert.equal(f.state.projectReadError, null); assert.equal(f.state.loading, false);
  });
  await check('body timeout settles refresh, releases busy accounting and preserves the confirmed output', async () => {
    const f = fixture('reload', async (_, init) => ({ ok: true, status: 200, json: () => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('SYNTHETIC_PRIVATE')), { once: true })) })); const old = f.state.project; const p = f.run(); await immediate(); assert.equal(f.timers.size, 1); f.fire(30000); await p; assert.equal(f.state.project, old); assert.equal(f.state.loading, false); assert.equal(f.context.projectReadsActive.current, 0); assert.equal(f.timers.size, 0);
  });
  await check('older concurrent reads cannot overwrite a newer state or error and background polls do not overlap', async () => {
    const pending = []; const f = fixture('reload', async () => ({ ok: true, status: 200, json: () => new Promise(resolve => pending.push(resolve)) })); const a = f.run(); await immediate(); assert.equal(await f.run(false), null); assert.equal(f.requests.length, 1); const b = f.run(); await immediate(); const newer = project(); newer.title = 'newer'; pending[1]({ project: newer }); await b; pending[0]({}); await a; assert.equal(f.state.project.title, 'newer'); assert.equal(f.state.projectReadError, null); assert.equal(f.context.projectReadsActive.current, 0);
  });
  await check('unmounted refresh never applies data or error', async () => { const f = fixture('reload', async () => response({ project: project() })); const old = f.state.project; f.context.mountedRef.current = false; await f.run(); assert.equal(f.state.project, old); assert.equal(f.state.loading, true); });
  await check('invalid generation results never announce completion or trigger another paid batch', async () => {
    const good = { slides: [slide('https://example.invalid/done.png')], errorCount: 0, skipped: 0 };
    for (const data of [{}, null, { ...good, slides: [] }, { ...good, errorCount: '0' }, { ...good, slides: [{ ...good.slides[0], projectId: 'foreign' }] }]) {
      const f = fixture('runGenerate', async url => url.endsWith('/operations') ? response(data) : response({ project: project(good.slides) })); await f.run(); assert.equal(f.success.length, 0); assert.equal(f.requests.filter(r => r.url.endsWith('/operations')).length, 1); assert.equal(f.state.generating, false); assert.equal(f.context.generationBusyRef.current, false); assert.equal(f.timers.size, 0); assert.ok(f.errors.length);
    }
  });
  await check('completion requires a matching confirmed project; failed final reload cannot retain the generation lock', async () => {
    const good = { slides: [slide('https://example.invalid/done.png')], errorCount: 0, skipped: 0 };
    for (const mode of ['success', 'refresh_null', 'refresh_mismatch', 'final_throw']) { let reads = 0; const f = fixture('runGenerate', async () => response(good), async () => { reads++; if (mode === 'final_throw' && reads >= 2) throw Error('SYNTHETIC_PRIVATE'); return mode === 'refresh_null' ? null : project(mode === 'refresh_mismatch' ? [slide()] : good.slides); }); await f.run(); assert.equal(f.success.length, mode === 'success' || mode === 'final_throw' ? 1 : 0, mode); assert.equal(f.state.generating, false); assert.equal(f.context.generationBusyRef.current, false); assert.equal(f.pollCleared(), true); assert.equal(f.timers.size, 0); }
  });
  await check('generation body timeout produces a public unknown-result notice and no automatic reissue', async () => {
    const f = fixture('runGenerate', async (url, init) => url.endsWith('/operations') ? { ok: true, status: 200, json: () => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(Error('SYNTHETIC_PRIVATE')), { once: true })) } : response({ project: project() })); const p = f.run(); await immediate(); f.fire(310000); await p; assert.equal(f.success.length, 0); assert.equal(f.state.generating, false); assert.equal(f.requests.filter(r => r.url.endsWith('/operations')).length, 1); assert.doesNotMatch(f.errors.join(), /SYNTHETIC_PRIVATE/); assert.equal(f.timers.size, 0);
  });
  await check('non-cooperating headers or JSON still time out and late responses never replace confirmed state', async () => {
    for(const phase of ['headers','body']) {
      let release;const pending=new Promise(resolve=>release=resolve);
      const f=fixture('reload',async()=>phase==='headers'?pending:{ok:true,status:200,json:()=>pending});const old=f.state.project;const run=f.run();await immediate();f.fire(30000);await run;assert.equal(f.state.project,old);assert.equal(f.timers.size,0);assert.equal(f.context.projectReadsActive.current,0);
      release(phase==='headers'?response({project:project()}):{project:project()});await immediate();assert.equal(f.state.project,old);
    }
  });
  await check('quota rejection and partial quota results retain the upgrade notice and stop generation', async () => {
    for (const partial of [false, true]) { const data = partial ? { slides: [slide(), slide('https://example.invalid/done.png', 1)], errorCount: 0, skipped: 1, limit: 20, quota: { upgradeUrl: '/doyaslide/pricing' } } : { code: 'LIMIT_REACHED', limit: 20, error: '上限です', upgradeUrl: '/doyaslide/pricing' }; const f = fixture('runGenerate', async () => response(data, partial ? 200 : 403), async () => project(data.slides || [slide()])); await f.run(); assert.equal(f.success.length, 0); assert.equal(f.state.limitUpgradeUrl, '/doyaslide/pricing'); assert.ok(f.state.limitMsg); assert.equal(f.requests.length, 1); assert.equal(f.state.generating, false); }
  });
  await check('failed partial generation requires explicit new action instead of automatic AI retry', async () => { const d = { slides: [slide()], errorCount: 1, skipped: 0 }; const f = fixture('runGenerate', async () => response(d), async () => project(d.slides)); await f.run(); assert.equal(f.requests.length, 1); assert.equal(f.success.length, 0); assert.equal(f.state.generating, false); });
  await check('double activation and unmount never start an extra generation request', async () => { let release; const good = { slides: [slide()], errorCount: 0, skipped: 0 }; const f = fixture('runGenerate', async () => ({ ok: true, status: 200, json: () => new Promise(resolve => release = resolve) }), async () => project()); const p = f.run(); await immediate(); await f.run(); assert.equal(f.requests.length, 1); f.context.mountedRef.current = false; release(good); await p; assert.equal(f.requests.length, 1); assert.equal(f.context.generationBusyRef.current, false); });
  await check('continuing progress remains bounded to twelve batches and only requests pending slides', async () => {
    let batch = 0, last;
    const f = fixture('runGenerate', async (_, init) => { const payload=JSON.parse(init.body); assert.equal(payload.projectId,'synthetic'); assert.equal(payload.onlyPending,true); assert.equal(payload.kind,'batch'); assert.match(payload.operationId,/^[a-f0-9-]{36}$/); batch++; last = Array.from({ length: 14 }, (_, i) => slide(i < batch ? 'https://example.invalid/done.png' : null, i)); return response({ slides: last, errorCount: 0, skipped: 0 }); }, async () => project(last));
    await f.run(); assert.equal(batch, 12); assert.equal(f.success.length, 0); assert.equal(f.state.generating, false); assert.match(f.errors.join(), /2枚が未完成/);
  });
  await check('failed or unreadable generation HTTP responses retain outputs and public errors', async () => {
    for (const mode of ['network', 'non_json', 'server']) {
      const f = fixture('runGenerate', async () => { if (mode === 'network') throw Error('SYNTHETIC_PRIVATE'); if (mode === 'non_json') return { ok: false, status: 500, json: async () => { throw Error('SYNTHETIC_PRIVATE'); } }; return response({ error: '生成に失敗しました' }, 500); }, async () => project());
      const old = f.state.project; await f.run(); assert.equal(f.state.project, old); assert.equal(f.success.length, 0); assert.equal(f.state.generating, false); assert.equal(f.requests.length, 1); assert.doesNotMatch(f.errors.join(), /SYNTHETIC_PRIVATE/); assert.equal(f.timers.size, 0);
    }
  });
  console.log(JSON.stringify({ passed: results.length, scope: 'Actual editor functions extracted from source; synthetic fetch/state/clock/auth responses. No real user/project writes or paid AI calls.', results }, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
