const assert = require('node:assert/strict'), fs = require('node:fs'), crypto = require('node:crypto');
const { fixture, deferred, props, makeDeal } = require('./sfa-client-fixture.cjs');
const cases = [];
const selector = 'input[placeholder^="例: 新規SaaS"]';
async function check(name, fn) { const f = await fixture('deals'); try { await fn(f); cases.push(name); console.log('PASS ' + name); } finally { await f.close(); } }
const open = f => f.act(() => props([...f.container.querySelectorAll('button')].find(b => b.textContent.includes('商談を追加'))).onClick());
const submit = f => f.act(() => props(f.button('追加する')).onClick());
const dealReply = (r, overrides = {}) => Response.json({ deal: { ...makeDeal('new-deal'), name: r.body.name.trim(), amount: Number(r.body.amount), startDate: r.body.startDate ? new Date(r.body.startDate).toISOString() : '2026-10-07T00:00:00.000Z', ...overrides } });
const detailInput = f => [...f.container.querySelectorAll('input')].find(i => i.value === 'Synthetic deal-a');
(async () => {
  await check('Same-frame create submits one UUID and never clears a newer draft', async f => {
    await open(f); await f.edit(selector, 'First'); const hold = deferred(); f.reply(async r => { await hold.promise; return dealReply(r); });
    let first, second; await f.act(() => { const click = props(f.button('追加する')).onClick; first = click(); second = click(); });
    assert.equal(f.writes.length, 1); assert.match(f.writes[0].body.operationId, /^[a-f0-9-]{36}$/); await f.edit(selector, 'Newer');
    await f.act(() => { hold.resolve(); }); await f.act(() => Promise.all([first, second])); assert.equal(f.container.querySelector(selector).value, 'Newer'); assert.equal(window.sessionStorage.length, 0);
  });
  await check('Late old-organization success cannot close current form or announce success', async f => {
    await open(f); await f.edit(selector, 'Alpha'); const hold = deferred(); f.reply(async r => { await hold.promise; return dealReply(r); });
    let pending; await f.act(() => { pending = props(f.button('追加する')).onClick(); }); await f.org('beta'); await open(f); await f.edit(selector, 'Beta'); const before = f.notices.length, offset = f.requests.length;
    await f.act(() => { hold.resolve(); }); await f.act(() => pending); assert.equal(f.container.querySelector(selector).value, 'Beta'); assert.equal(f.notices.length, before); assert.ok(f.requests.slice(offset).every(r => r.url.searchParams.get('org') !== 'alpha'));
  });
  await check('Overlong rejected creation preserves draft and persistent failure', async f => {
    await open(f); await f.edit(selector, 'x'.repeat(201)); f.reply(() => Response.json({ error: '商談名は200文字以内です' }, { status: 400 })); await submit(f);
    assert.equal(f.container.querySelector(selector).value.length, 201); assert.match(f.container.textContent, /200文字以内/); assert.equal(window.sessionStorage.length, 0); assert.ok(!f.notices.some(n => n.kind === 'success'));
  });
  await check('Blank amount is explicit zero; invalid amount is preserved and sent for validation', async f => {
    await open(f); await f.edit(selector, 'Amount'); await f.edit('input[placeholder="1000000"]', 'not-a-number'); f.reply(() => Response.json({ error: '金額を確認してください' }, { status: 400 })); await submit(f);
    assert.equal(f.writes[0].body.amount, 'not-a-number'); assert.equal(f.container.querySelector('input[placeholder="1000000"]').value, 'not-a-number');
    await f.edit('input[placeholder="1000000"]', ''); await submit(f); assert.equal(f.writes[1].body.amount, '0');
  });
  await check('Unknown creation fences retry; missing read cannot unlock; cancellation permits new UUID', async f => {
    await open(f); await f.edit(selector, 'Uncertain'); f.reply(() => Promise.reject(Error('synthetic loss'))); await submit(f); const operation = f.writes[0].body.operationId;
    assert.match(f.container.textContent, /保存結果を確認/); const before = f.writes.length; await submit(f); assert.equal(f.writes.length, before); f.reply(null);
    await f.act(() => props(f.button('保存結果を確認')).onClick()); assert.match(f.container.textContent, /遅れて保存される可能性/); await submit(f); assert.equal(f.writes.length, before);
    await f.act(() => props(f.button('未保存ならこの操作を取り消す')).onClick()); assert.equal(window.sessionStorage.length, 0); await submit(f); const posts = f.writes.filter(r => r.init.method === 'POST'); assert.equal(posts.length, 2); assert.notEqual(posts[1].body.operationId, operation);
  });
  for (const mode of ['malformed', 'wrong-fields', 'deadline']) await check('Unknown ' + mode + ' response retains input and recovery metadata', async f => {
    await open(f); await f.edit(selector, 'Preserved');
    if (mode === 'deadline') { f.timeout(); f.reply(() => new Promise(() => {})); }
    else f.reply(r => mode === 'malformed' ? new Response('{', { status: 200 }) : dealReply(r, { name: 'Other' }));
    await submit(f); assert.equal(f.container.querySelector(selector).value, 'Preserved'); assert.equal(window.sessionStorage.length, 1); assert.ok(!f.notices.some(n => n.kind === 'success'));
  });
  await check('Denied browser storage prevents creation send', async f => { await open(f); await f.edit(selector, 'Storage'); f.noStorage(); await submit(f); assert.equal(f.writes.length, 0); assert.match(f.container.textContent, /送信しませんでした/); });
  await check('Same-actor authentication loading preserves create draft and rehydrates unknown operation', async f => {
    await open(f); await f.edit(selector, 'Retain through loading'); f.reply(() => Promise.reject(Error('lost'))); await submit(f); await f.auth('actor-a', 'loading'); await f.auth('actor-a');
    assert.equal(f.container.querySelector(selector).value, 'Retain through loading'); assert.match(f.container.textContent, /保存結果を確認/); assert.equal(window.sessionStorage.length, 1);
  });
  await check('Detail save includes expected version and preserves newer form changes', async f => {
    await f.openDetail(); const input = detailInput(f); assert.ok(input); const hold = deferred();
    f.reply(async r => { await hold.promise; return Response.json({ deal: { ...makeDeal('deal-a'), ...r.body, amount: Number(r.body.amount), accountId: r.body.accountId || null, contactName: r.body.contactName || null, note: r.body.note || null, startDate: null, expectedCloseDate: null, probability: Number(r.body.probability), updatedAt: '2026-10-07T00:00:00.001Z' } }); });
    let pending; await f.act(() => { pending = props(f.button('保存する')).onClick(); }); assert.equal(f.writes[0].body.expectedUpdatedAt, makeDeal('deal-a').updatedAt);
    await f.act(() => props(input).onChange({ target: { value: 'Newer detail' } })); await f.act(() => { hold.resolve(); }); await f.act(() => pending); assert.equal(input.value, 'Newer detail'); assert.ok(f.button('保存する'));
  });
  await check('Stale detail rejection keeps modal and input; no false success', async f => {
    await f.openDetail(); const input = detailInput(f); await f.act(() => props(input).onChange({ target: { value: 'Unsaved detail' } })); f.reply(() => Response.json({ error: '別の操作で変更されました', code: 'VERSION_CONFLICT' }, { status: 409 }));
    await f.act(() => props(f.button('保存する')).onClick()); assert.equal(input.value, 'Unsaved detail'); assert.match(f.container.textContent, /別の操作/); assert.ok(!f.notices.some(n => n.kind === 'success'));
  });
  await check('Stage selection never optimistically changes confirmed board and sends one versioned write', async f => {
    const control = f.container.querySelector('select[data-no-drag]'); assert.ok(control);
    const hold = deferred(); f.reply(async () => { await hold.promise; return Response.json({ error: '別の操作で変更されました', code: 'VERSION_CONFLICT' }, { status: 409 }); });
    let one, two; await f.act(() => { const change = props(control).onChange; one = change({ target: { value: 'other-stage' } }); two = change({ target: { value: 'other-stage' } }); }); assert.equal(f.writes.length, 1); assert.equal(control.value, 'stage'); assert.equal(f.writes[0].body.expectedUpdatedAt, makeDeal('deal-a').updatedAt);
    await f.act(() => { hold.resolve(); }); await f.act(() => Promise.all([one, two])); assert.equal(control.value, 'stage'); assert.ok(!f.notices.some(n => n.kind === 'success'));
  });
  const sources = ['src/app/sfa/[orgSlug]/deals/page.tsx', 'src/lib/sfa/use-client-mutations.ts', 'src/lib/sfa/client-response.ts', 'src/components/sfa/MutationRecovery.tsx', 'scripts/security-regression/sfa-client-fixture.cjs'];
  fs.writeFileSync('docs/audits/2026-10-06-all-services-recheck/sfa-deal-client-results.json', JSON.stringify({ checkedAt: new Date().toISOString(), passed: cases.length, cases, sourceHashes: Object.fromEntries(sources.map(p => [p, crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')])), scope: 'Actual deal page, shared mutation/recovery/session guard and bounded transport mounted in StrictMode. Synthetic browser DOM/navigation/auth/API; not real Next routing/private production/customer writes.' }, null, 2) + '\n');
})().catch(e => { console.error(e); process.exitCode = 1; });
