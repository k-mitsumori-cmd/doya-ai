const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict');
const { check, results } = require('./load-typescript.cjs');
const file = 'src/app/doyaslide/[id]/page.tsx';
const source = fs.readFileSync(path.join(process.env.DOYA_TEST_ROOT || process.cwd(), file), 'utf8');
const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
const names = ['validSlides', 'validProject', 'readSlideResponse', 'reload', 'ensureOk', 'retryStructure', 'saveLogoConfig', 'exportAs'];
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
  const context = { id: 'synthetic', selected: slide('https://example.invalid/old.png'), chatInput: state.chatInput, versions: state.versions, versionsError: null, versionsSequence: { current: 0 }, versionsTarget: { current: 's0' }, selectedSlideRef: { current: 's0' }, URL, project: state.project, allDone: true, confirm: () => true, structureBusyRef: { current: false }, exportBusyRef: { current: false }, logoConfigBusyRef: { current: false }, generated: 0, downloadClicks: 0, removedAnchors: 0, runGenerate: async () => { context.generated++; }, document: { createElement: () => ({ click: () => { context.downloadClicks++; }, remove: () => { context.removedAnchors++; } }), body: { appendChild: () => {} } }, AbortController, mountedRef: { current: true }, projectReadSequence: { current: 0 }, projectReadsActive: { current: 0 }, generationBusyRef: { current: false }, slideMutationBusyRef: { current: false }, pollRef: { current: null }, toast,
    showQuotaNotice: (res, d) => { if (res.status !== 403 || d?.code !== 'LIMIT_REACHED') return false; state.limitMsg = d.error; state.limitUpgradeUrl = d.upgradeUrl === '/doyaslide/pricing' ? d.upgradeUrl : null; return true; },
    setInterval: fn => { pollCallback = fn; return 1; }, stopPoll: () => { pollCleared = true; },
    window: { setTimeout: (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId; }, clearTimeout: id => timers.delete(id) },
    fetch: async (url, init) => { requests.push({ url, init }); return fetcher(url, init, requests.length); }
  };
  for (const setter of new Set(source.match(/\bset[A-Z]\w*/g) || [])) if (!context[setter]) context[setter] = v => { const k = setter[3].toLowerCase() + setter.slice(4); state[k] = typeof v === 'function' ? v(state[k]) : v; };
  if (overrideReload) context.reload = overrideReload;
  vm.runInNewContext(ts.transpileModule(Object.entries(parts).filter(([name]) => !overrideReload || name !== 'reload').map(([, code]) => code).join('\n') + '\nglobalThis.api={retryStructure,saveLogoConfig,exportAs};globalThis.run=' + handler + ';', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  if (overrideReload) context.reload = overrideReload;
  return { run: (...args) => context.run(...args), context, state, timers, success, errors, requests, fire: ms => { for (const [id, t] of [...timers]) if (t.ms === ms) { timers.delete(id); t.fn(); } }, poll: () => pollCallback(), pollCleared: () => pollCleared };
}
function response(data, status = 200) { return { ok: status >= 200 && status < 300, status, json: async () => data }; }


(async () => {
  const patch = { logoSize: 'L', logoBackingChip: true };
  const complete = project([slide('https://example.invalid/done.png')]); Object.assign(complete, patch);
  const good = name => name === 'retryStructure' ? { slides: [slide()] } : name === 'saveLogoConfig' ? { project: complete } : { url: 'https://example.invalid/export.pdf?download=synthetic.pdf', filename: 'synthetic.pdf', skipped: 0 };
  const invoke = (f, name) => f.run(name === 'saveLogoConfig' ? patch : name === 'exportAs' ? 'pdf' : undefined);
  for (const name of ['retryStructure', 'saveLogoConfig', 'exportAs']) {
    await check(name + ' rejects uncertain or malformed responses without false success or an unintended next action', async () => {
      for (const mode of ['empty', 'null', 'network', 'body', 'http_error', 'malformed']) {
        let data = good(name); if (mode === 'empty') data = {}; if (mode === 'null') data = null; if (mode === 'malformed') data = name === 'retryStructure' ? { slides: [{ ...slide(), projectId: 'foreign' }] } : name === 'saveLogoConfig' ? { project: { ...complete, logoSize: 'M' } } : { ...data, url: {} };
        const f = fixture(name, async () => { if (mode === 'network') throw Error('SYNTHETIC_PRIVATE'); if (mode === 'body') return { ok: true, status: 200, json: async () => { throw Error('SYNTHETIC_PRIVATE'); } }; return response(data, mode === 'http_error' ? 500 : 200); }, async () => project());
        await invoke(f, name); assert.equal(f.success.length, 0); assert.equal(f.context.generated, 0); assert.equal(f.context.downloadClicks, 0); assert.equal(f.timers.size, 0); assert.doesNotMatch(f.errors.join(), /SYNTHETIC_PRIVATE/);
        if (name === 'retryStructure') { assert.equal(f.state.structuring, false); assert.equal(f.context.structureBusyRef.current, false); }
        if (name === 'saveLogoConfig') { assert.equal(f.state.logoRetryPatch, patch); assert.equal(f.state.savingLogoConfig, false); assert.equal(f.context.logoConfigBusyRef.current, false); }
        if (name === 'exportAs') { assert.equal(f.state.exporting, null); assert.equal(f.context.exportBusyRef.current, false); }
      }
    });
    await check(name + ' accepts confirmed results and releases its lock', async () => { const f = fixture(name, async () => response(good(name)), async () => name === 'retryStructure' ? project([slide()]) : complete); await invoke(f, name); assert.equal(f.success.length, 1); assert.equal(f.timers.size, 0); if (name === 'retryStructure') assert.equal(f.context.generated, 1); if (name === 'exportAs') { assert.equal(f.context.downloadClicks, 1); assert.equal(f.context.removedAnchors, 1); assert.match(f.success[0], /開始/); } if (name === 'saveLogoConfig') assert.equal(f.state.logoRetryPatch, null); });
    await check(name + ' retains its deadline through body reads and double activation never duplicates a request', async () => { const f = fixture(name, async (_, init) => ({ ok: true, status: 200, json: () => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(Error('SYNTHETIC_PRIVATE')), { once: true })) }), async () => project()); const p = invoke(f, name); await immediate(); assert.equal(f.timers.size, 1); await invoke(f, name); assert.equal(f.requests.length, 1); f.fire(310000); await p; assert.equal(f.success.length, 0); assert.equal(f.context.generated, 0); assert.equal(f.context.downloadClicks, 0); assert.equal(f.timers.size, 0); });
  }
  await check('structure confirmation failure prevents image generation and refresh exceptions never leave its lock held', async () => { for (const mode of ['missing', 'mismatch', 'throw']) { const f = fixture('retryStructure', async () => response(good('retryStructure')), async () => { if (mode === 'throw') throw Error('SYNTHETIC_PRIVATE'); if (mode === 'missing') return null; return project([{ ...slide(), headline: 'different saved headline' }]); }); await f.run(); assert.equal(f.context.generated, 0); assert.equal(f.success.length, 0); assert.equal(f.state.structuring, false); assert.equal(f.context.structureBusyRef.current, false); } });
  await check('logo partial recomposition preserves retry values and does not claim all slides were updated', async () => { const f = fixture('saveLogoConfig', async () => response({ ...good('saveLogoConfig'), error: '一部のスライドに反映できませんでした', failedSlides: 1 }, 503), async () => complete); await f.run(patch); assert.equal(f.success.length, 0); assert.equal(f.state.logoRetryPatch, patch); assert.equal(f.context.logoConfigBusyRef.current, false); });
  await check('export accepts only HTTPS credential-free URLs and valid filenames and counts', async () => { for (const data of [ { ...good('exportAs'), url: 'javascript:synthetic()' }, { ...good('exportAs'), url: 'data:application/pdf,synthetic' }, { ...good('exportAs'), url: 'http://example.invalid/file.pdf' }, { ...good('exportAs'), url: 'https://user:password@example.invalid/file.pdf' }, { ...good('exportAs'), filename: '../file.pdf' }, { ...good('exportAs'), filename: 'file.zip' }, { ...good('exportAs'), skipped: '1' }, { ...good('exportAs'), skipped: -1 } ]) { const f = fixture('exportAs', async () => response(data)); await f.run('pdf'); assert.equal(f.context.downloadClicks, 0); assert.equal(f.success.length, 0); assert.equal(f.state.exporting, null); } });
  await check('partial export starts a download but announces skipped images without claiming completion', async () => { const f = fixture('exportAs', async () => response({ ...good('exportAs'), skipped: 1 })); await f.run('pdf'); assert.equal(f.context.downloadClicks, 1); assert.equal(f.success.length, 0); assert.match(f.errors[0], /1枚.*除外/); assert.match(f.errors[0], /開始/); assert.equal(f.context.removedAnchors, 1); });
  await check('declined or duplicate exports make no request and click failure removes its anchor and unlocks', async () => { const f = fixture('exportAs', async () => response(good('exportAs'))); f.context.allDone = false; f.context.confirm = () => false; await f.run('pdf'); assert.equal(f.requests.length, 0); const g = fixture('exportAs', async () => response(good('exportAs'))); g.context.document.createElement = () => ({ click: () => { throw Error('SYNTHETIC_PRIVATE'); }, remove: () => { g.context.removedAnchors++; } }); await g.run('pdf'); assert.equal(g.context.removedAnchors, 1); assert.equal(g.context.exportBusyRef.current, false); assert.equal(g.state.exporting, null); assert.equal(g.success.length, 0); });
  await check('structure daily operational limit is a persistent notice with no image generation or paid-plan promise', async () => { const f = fixture('retryStructure', async () => response({ code: 'DOYASLIDE_TEXT_DAILY_LIMIT', error: 'synthetic limit' }, 429)); await f.run(); assert.match(f.state.structureNotice, /明日/); assert.match(f.state.structureNotice, /お問い合わせ/); assert.equal(f.context.generated, 0); assert.equal(f.success.length, 0); assert.equal(f.state.structuring, false); assert.equal(f.context.structureBusyRef.current, false); });
  console.log(JSON.stringify({ passed: results.length, scope: 'Actual structure/logo/export and response validators with synthetic fetch/clock/state/DOM. No provider request, logo save, export upload or real download.', results }, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
