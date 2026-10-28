const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { check, results, load } = require('./load-typescript.cjs');

function page(kind) {
  const source = fs.readFileSync(`src/app/(shell)/seo/${kind}/[id]/page.tsx`, 'utf8');
  const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const effects = []; let allowed;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect') effects.push(node.arguments[0].getText(ast));
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'automaticActionsAllowed') allowed = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(allowed);
  return { effects, allowed };
}
function effect(kind, marker, values = {}, auto = '0') {
  const { effects, allowed } = page(kind);
  const matches = effects.filter(source => source.includes(marker));
  assert.equal(matches.length, 1, marker);
  const timers = new Map(); const calls = { advance: 0, fetch: 0, images: 0 };
  const context = { AbortController, searchParams: new URLSearchParams({ auto }), job: null, article: null, autoRun: true, latestJob: null,
    autoImagesRequestedRef: { current: false }, advanceOnce: async () => { calls.advance++; },
    ensureImages: async mode => { assert.equal(mode, 'auto'); calls.images++; },
    fetch: async () => { calls.fetch++; return Response.json({ success: true, isLoggedIn: true, canUseSeoImages: true }); },
    document: { visibilityState: 'visible' },
    setTimeout: fn => { const id = timers.size + 1; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id), ...values };
  const code = ts.transpileModule(`const automaticActionsAllowed = ${allowed}; (${matches[0]})()`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const cleanup = vm.runInNewContext(code, context);
  return { context, timers, calls, cleanup };
}

(async () => {
  for (const kind of ['jobs', 'articles']) for (const mode of ['read-only', 'needs-review', 'cancelled']) await check(`${kind}: every generation effect respects ${mode}`, () => {
    const effects = page(kind).effects.filter(source => /\badvanceOnce\b/.test(source));
    assert.ok(effects.length > 0);
    const job = { id: 'j', status: mode === 'cancelled' ? 'cancelled' : 'running', activityState: mode === 'needs-review' ? 'needs-review' : 'executing' };
    for (const source of effects) {
      const f = effect(kind, source, { job, latestJob: job, article: job }, mode === 'read-only' ? '0' : '1');
      assert.equal(f.timers.size, 0, 'Unexpected automatic generation effect: ' + source);
      assert.equal(f.calls.advance, 0);
    }
  });
  for (const kind of ['jobs', 'articles']) await check(`${kind}: auto=0 never schedules generation`, () => {
    const f = effect(kind, kind === 'jobs' ? 'setTimeout(tick, 1800)' : 'setTimeout(advanceOnce, 800)', {
      job: { id: 'j', status: 'running', activityState: 'executing' }, latestJob: { status: 'running' }, article: { activityState: 'executing' },
    });
    assert.equal(f.timers.size, 0); assert.equal(f.calls.advance, 0);
  });
  for (const status of ['paused', 'cancelled', 'done', 'error']) for (const kind of ['jobs', 'articles']) await check(`${kind}: ${status} never auto advances`, () => {
    const f = effect(kind, kind === 'jobs' ? 'setTimeout(tick, 1800)' : 'setTimeout(advanceOnce, 800)', { job: { status }, latestJob: { status } }, '1');
    assert.equal(f.timers.size, 0);
  });
  for (const kind of ['jobs', 'articles']) await check(`${kind}: review/replaced jobs never auto advance`, () => {
    for (const replaced of [false, true]) {
      const job = { status: 'running', ...(replaced ? { supersededAt: 'date' } : { activityState: 'needs-review' }) };
      const f = effect(kind, kind === 'jobs' ? 'setTimeout(tick, 1800)' : 'setTimeout(advanceOnce, 800)', { job, latestJob: job, article: job }, '1');
      assert.equal(f.timers.size, 0);
    }
  });
  await check('fresh automatic job continues and cleanup cancels future work', async () => {
    const f = effect('jobs', 'setTimeout(tick, 1800)', { job: { id: 'j', status: 'running', activityState: 'waiting' } }, '1');
    assert.equal(f.timers.size, 1);
    const tick = [...f.timers.values()][0]; f.timers.clear(); await tick();
    assert.equal(f.calls.advance, 1); assert.equal(f.timers.size, 1);
    f.cleanup(); assert.equal(f.timers.size, 0); await tick(); assert.equal(f.calls.advance, 1);
  });
  await check('fresh article auto=1 advances once and cancels its timer', async () => {
    const f = effect('articles', 'setTimeout(advanceOnce, 800)', { latestJob: { status: 'running' }, article: { activityState: 'executing' } }, '1');
    assert.equal(f.timers.size, 1); await [...f.timers.values()][0](); assert.equal(f.calls.advance, 1);
    f.cleanup(); assert.equal(f.timers.size, 0);
  });
  await check('auto=0 prevents automatic image entitlement and paid calls', async () => {
    const f = effect('articles', "ensureImages('auto')", { article: { autoBundle: true, status: 'DONE', images: [] } });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(f.calls, { advance: 0, fetch: 0, images: 0 });
    assert.equal(f.context.autoImagesRequestedRef.current, false);
  });
  await check('normal completed bundle retains one automatic image request', async () => {
    const f = effect('articles', "ensureImages('auto')", { article: { autoBundle: true, status: 'DONE', images: [] } }, '1');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.calls.fetch, 1); assert.equal(f.calls.images, 1);
    const repeated = effect('articles', "ensureImages('auto')", { article: f.context.article, autoImagesRequestedRef: f.context.autoImagesRequestedRef }, '1');
    assert.equal(repeated.calls.fetch, 0);
  });
  await check('leaving an article during entitlement lookup prevents late image generation', async () => {
    let resolve, signal;
    const pending = new Promise(done => { resolve = done; });
    const f = effect('articles', "ensureImages('auto')", { article: { autoBundle: true, status: 'DONE', images: [] },
      fetch: async (_url, init) => { signal = init.signal; return pending; } }, '1');
    f.cleanup(); assert.equal(signal.aborted, true);
    resolve(Response.json({ success: true, isLoggedIn: true, canUseSeoImages: true }));
    await new Promise(done => setImmediate(done));
    assert.equal(f.calls.images, 0); assert.equal(f.context.autoImagesRequestedRef.current, false);
    const retry = effect('articles', "ensureImages('auto')", { article: f.context.article, autoImagesRequestedRef: f.context.autoImagesRequestedRef }, '1');
    await new Promise(done => setImmediate(done)); assert.equal(retry.calls.images, 1);
  });
  await check('leaving a job during advance never schedules another tick', async () => {
    let resolve;
    const pending = new Promise(done => { resolve = done; });
    const f = effect('jobs', 'setTimeout(tick, 1800)', { job: { id: 'j', status: 'running' }, advanceOnce: () => pending }, '1');
    const tick = [...f.timers.values()][0]; f.timers.clear(); const running = tick();
    f.cleanup(); resolve(); await running; assert.equal(f.timers.size, 0);
  });
  for (const kind of ['articles', 'jobs']) for (const mode of ['active', 'stale', 'anonymous', 'missing', 'error']) await check(`${kind} GET ${mode}: private metadata response`, async () => {
    const job = { id: 'j', articleId: 'a', status: 'running', updatedAt: new Date('2000-01-01'), executionToken: 'PRIVATE_TOKEN', executionExpiresAt: new Date(mode === 'active' ? '2100-01-01' : '2000-01-01') };
    const article = { id: 'a', status: 'RUNNING', updatedAt: job.updatedAt, jobs: [job] };
    const findFirst = async ({ where }) => { assert.equal((kind === 'jobs' ? where.article : where).userId, 'owner'); if (mode === 'error') throw new Error('private error'); return mode === 'missing' ? null : kind === 'jobs' ? { ...job, article: { id: article.id, status: article.status, updatedAt: article.updatedAt } } : article; };
    const api = load(`src/app/api/seo/${kind}/[id]/route.ts`, {
      '@seo/lib/job-response': load('seo/lib/job-response.ts'), 'next/server': { NextResponse: Response },
      '@/lib/seoArticleOwner': { getSeoArticleOwner: async () => mode === 'anonymous' ? null : { userId: 'owner' } },
      '@seo/lib/bootstrap': { ensureSeoSchema: async () => {} }, '@/lib/seo-image-purge': {},
      '@/lib/prisma': { prisma: { seoArticle: { findFirst }, seoJob: { findFirst }, seoReference: { findMany: async () => [] } } },
    });
    const response = await api.GET({}, { params: Promise.resolve({ id: 'a' }) });
    assert.equal(response.status, mode === 'anonymous' ? 401 : mode === 'missing' ? 404 : mode === 'error' ? 500 : 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.match(response.headers.get('vary'), /Cookie/i);
    const body = await response.text(); assert.equal(body.includes('PRIVATE_TOKEN'), false);
    if (response.ok) assert.equal(JSON.parse(body)[kind === 'jobs' ? 'job' : 'article'].activityState, mode === 'active' ? 'executing' : 'needs-review');
  });
  console.log(JSON.stringify({ passed: results.length, results }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
