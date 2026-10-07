const assert = require('node:assert/strict'), fs = require('node:fs'), crypto = require('node:crypto');
const { fixture, deferred, props, makeTask } = require('./sfa-client-fixture.cjs');
const results = [];
async function check(name, page, fn, options) {
  const f = await fixture(page, options);
  try { await fn(f); results.push(name); } finally { await f.close(); }
}
const manual = [
  { page: 'tasks', selector: 'input[placeholder^="やること"]', button: '追加', kind: 'task' },
  { page: 'tasks', selector: 'input[placeholder^="活動内容"]', button: '記録', kind: 'activity' },
  { page: 'activities', selector: 'input[placeholder^="件名"]', button: '記録する', kind: 'activity' },
  { page: 'activities', selector: 'textarea', button: '記録する', kind: 'activity' },
  { page: '', selector: 'input[placeholder^="例: A社"]', button: '追加', kind: 'task' },
  { page: 'deals', selector: 'input[placeholder^="やること"]', button: '追加', kind: 'task' },
  { page: 'deals', selector: 'input[placeholder^="活動内容"]', button: '追加', kind: 'activity' },
];
async function input(f, c, value) { if (c.page === 'deals') await f.openDetail(); await f.edit(c.selector, value); const element = f.container.querySelector(c.selector); return { element, button: f.button(c.button, element.parentElement) || f.button(c.button) }; }
(async () => {
  for (const c of manual) {
    const name = (c.page || 'dashboard') + ' ' + c.selector;
    await check(name + ' same-frame double submission sends one UUID and retains newer draft', c.page, async f => {
      const { element, button } = await input(f, c, 'First draft'); assert.ok(button);
      const hold = deferred(); f.reply(async r => { await hold.promise; return Response.json({ [c.kind]: c.kind === 'task' ? f.taskData(r.body) : f.activityData(r.body) }); });
      let first, second;
      await f.act(() => { const handler = props(button).onClick; first = handler(); second = handler(); });
      assert.equal(f.writes.length, 1); assert.match(f.writes[0].body.operationId, /^[a-f0-9-]{36}$/);
      await f.edit(c.selector, 'Newer draft');
      await f.act(() => { hold.resolve(); }); await f.act(() => Promise.all([first, second]));
      assert.equal(element.value, 'Newer draft'); assert.ok(f.writes[0].url.searchParams.get('org') === 'alpha');
      assert.equal(window.sessionStorage.length, 0);
    });
    await check(name + ' rejection keeps boundary input and shows persistent failure', c.page, async f => {
      const value = 'x'.repeat(c.selector === 'textarea' ? 4001 : 201);
      const { element, button } = await input(f, c, value);
      f.reply(() => Response.json({ error: '入力は上限以内で入力してください' }, { status: 400 }));
      await f.act(() => props(button).onClick()); assert.equal(element.value, value);
      assert.match(f.container.textContent, /上限以内/); assert.ok(!f.notices.some(n => n.kind === 'success')); assert.equal(window.sessionStorage.length, 0);
    });
    await check(name + ' late organization response never clears new draft or reloads old organization', c.page, async f => {
      const { button } = await input(f, c, 'Alpha draft'); const hold = deferred();
      f.reply(async r => { await hold.promise; return Response.json({ [c.kind]: c.kind === 'task' ? f.taskData(r.body) : f.activityData(r.body) }); });
      let operation; await f.act(() => { operation = props(button).onClick(); });
      await f.org('beta'); if (c.page === 'deals') await f.openDetail(); await f.edit(c.selector, 'Beta draft');
      const offset = f.requests.length;
      await f.act(() => { hold.resolve(); }); await f.act(() => operation);
      assert.equal(f.container.querySelector(c.selector).value, 'Beta draft'); assert.equal(f.requests.length, offset); assert.ok(!f.notices.some(n => n.kind === 'success'));
    });
  }
  for (const c of manual.filter(c => c.kind === 'task')) await check((c.page || 'dashboard') + ' IME Enter does not submit a task', c.page, async f => {
    const { element } = await input(f, c, '変換中'); const onKeyDown = props(element).onKeyDown;
    await f.act(() => onKeyDown({ key: 'Enter', keyCode: 13, nativeEvent: { isComposing: true } })); assert.equal(f.writes.length, 0);
    await f.act(() => onKeyDown({ key: 'Enter', keyCode: 229, nativeEvent: { isComposing: false } })); assert.equal(f.writes.length, 0);
  });
  await check('Metadata-only storage fences unknown creation, missing read remains blocked, cancellation releases lane', 'hook', async f => {
    f.reply(() => Response.json({ error: 'temporary' }, { status: 503 }));
    await f.act(() => f.hook().create('activity', 'manual:create', { subject: 'Private customer content' }));
    assert.equal(f.hook().pending.length, 1); const raw = f.storage.getItem(f.storage.key(0)); assert.ok(!raw.includes('Private customer')); assert.ok(!raw.includes('subject'));
    const pending = f.hook().pending[0];
    await f.act(() => f.hook().recover(pending)); assert.equal(f.hook().pending.length, 1); assert.match(f.hook().message, /遅れて保存/);
    const before = f.writes.length; await f.act(() => f.hook().create('activity', 'manual:create', { subject: 'changed' })); assert.equal(f.writes.length, before);
    f.reply(undefined); await f.act(() => f.hook().recover(pending, true)); assert.equal(f.hook().pending.length, 0); assert.match(f.hook().message, /取り消しました/); assert.equal(window.sessionStorage.length, 0);
    await f.act(() => f.hook().create('activity', 'manual:create', { subject: 'changed' })); assert.equal(f.writes.length, before + 2); assert.notEqual(f.writes[0].body.operationId, f.writes.at(-1).body.operationId);
  });
  await check('Unresolved creation fences other form lanes in the same actor and organization', 'hook', async f => {
    f.reply(()=>Response.json({}, {status:503}));await f.act(()=>f.hook().create('task','dashboard:create',{title:'Unknown'}));const before=f.writes.length;
    await f.act(()=>f.hook().create('task','tasks:create',{title:'Unknown again'}));assert.equal(f.writes.length,before);assert.equal(f.hook().creationBlocked('task'),true);assert.equal(f.hook().creationBlocked('activity'),false);
  });
  await check('Unknown committed creation resolves read-only without second POST', 'hook', async f => {
    f.reply(r => { f.receipts.set(r.body.operationId, { kind: 'task', row: f.taskData(r.body) }); throw Error('connection lost after commit'); });
    await f.act(() => f.hook().create('task', 'manual:create', { title: 'Saved' }));
    f.reply(undefined); await f.act(() => f.hook().recover(f.hook().pending[0])); assert.equal(f.hook().pending.length, 0); assert.equal(f.writes.length, 1); assert.equal(f.recovered(), 1);
  });
  await check('Malformed success keeps operation pending and never claims save success', 'hook', async f => {
    f.reply(() => Response.json({ task: { id: 'incomplete' } }));
    await f.act(() => f.hook().create('task', 'manual:create', { title: 'Draft' })); assert.equal(f.hook().pending.length, 1); assert.match(f.hook().message, /確認できません/);
  });
  await check('Wrong title, date, status or deal in full success DTO is rejected', 'hook', async f => {
    for (const patch of [{ title: 'Wrong' }, { dueDate: '2026-10-08T00:00:00.000Z' }, { status: 'done' }, { dealId: 'wrong-deal' }]) {
      const lane = 'mismatch:' + f.writes.length;
      f.reply(r => Response.json({ task: { ...f.taskData(r.body), ...patch } }));
      await f.act(() => f.hook().create('task', lane, { title: 'Expected', dueDate: '2026-10-07', dealId: 'deal-a' }));
      assert.ok(f.hook().pending.some(p => p.lane === lane));
      f.reply(undefined); await f.act(() => f.hook().recover(f.hook().pending[0], true));
    }
  });
  await check('Storage denial stops request before sending', 'hook', async f => {
    f.noStorage(); await f.act(() => f.hook().create('task', 'manual:create', { title: 'Draft' })); assert.equal(f.writes.length, 0); assert.match(f.hook().message, /送信しませんでした/);
  });
  await check('Fetch deadline releases busy lane while retaining unknown operation', 'hook', async f => {
    f.timeout(); f.reply(() => new Promise(() => {})); await f.act(() => f.hook().create('task', 'manual:create', { title: 'Draft' }));
    assert.equal(f.hook().pending.length, 1); assert.equal(f.hook().busy.length, 0);
  });
  await check('Streaming body deadline keeps unknown write recoverable', 'hook', async f => {
    f.timeout(); f.reply(() => new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('{"task":')); } }), { headers: { 'content-type': 'application/json' } }));
    await f.act(() => f.hook().create('task', 'manual:create', { title: 'Draft' })); assert.equal(f.hook().pending.length, 1); assert.equal(f.hook().busy.length, 0);
  });
  await check('Actor alpha beta alpha never exposes another actor metadata and restores original unresolved operation', 'hook', async f => {
    f.reply(() => Response.json({}, { status: 500 })); await f.act(() => f.hook().create('task', 'manual:create', { title: 'Draft' })); const id = f.hook().pending[0].operationId;
    await f.auth('actor-b'); assert.equal(f.hook().pending.length, 0); await f.auth('actor-a'); assert.equal(f.hook().pending[0].operationId, id);
  });
  let persisted;
  await check('Unknown operation retained on unmount', 'hook', async f => {
    f.reply(() => Response.json({}, { status: 500 })); await f.act(() => f.hook().create('task', 'manual:create', { title: 'Draft' })); persisted = f.hook().pending[0].operationId;
  });
  await check('Remount hydrates unresolved operation before any new send', 'hook', async f => { assert.equal(f.hook().pending[0].operationId, persisted); await f.act(() => f.hook().create('task', 'manual:create', { title: 'Draft' })); assert.equal(f.writes.length, 0); }, { keepStorage: true });
  await check('Versioned PATCH sends explicit status and advances validated version; DELETE sends expected version', 'hook', async f => {
    const before = makeTask(); let result;
    await f.act(async () => { result = await f.hook().mutateTask(before, { status: 'done' }); });
    assert.equal(f.writes[0].body.expectedUpdatedAt, before.updatedAt); assert.equal(f.writes[0].body.status, 'done'); assert.equal(result.task.status, 'done');
    await f.act(() => f.hook().mutateTask(result.task, null)); assert.equal(f.writes[1].url.searchParams.get('expectedUpdatedAt'), result.task.updatedAt);
  }, { tasks: [makeTask()] });
  await check('Stale task rejection keeps confirmed state and shows conflict', 'hook', async f => {
    f.reply(() => Response.json({ code: 'VERSION_CONFLICT', error: '他の操作で更新されました' }, { status: 409 }));
    await f.act(() => f.hook().mutateTask(makeTask(), { status: 'done' })); assert.equal(f.hook().pending.length, 0); assert.match(f.hook().message, /他の操作/);
  });
  await check('Task mutation unknown state requires read-only current-state recovery', 'hook', async f => {
    f.reply(() => new Response('<html>bad gateway</html>', { status: 502 })); await f.act(() => f.hook().mutateTask(makeTask(), { status: 'done' }));
    assert.equal(f.hook().pending.length, 1); f.read(r => r.path.endsWith('/task') ? Response.json({ state: 'missing', task: null }) : undefined);
    await f.act(() => f.hook().recover(f.hook().pending[0])); assert.equal(f.hook().pending.length, 0); assert.match(f.hook().message, /削除した利用者や操作は特定できません/);
  });
  for (const page of ['tasks', '', 'deals']) await check((page || 'dashboard') + ' actual task toggle adopts expected version without optimistic status change', page, async f => {
    if (page === 'deals') await f.openDetail();
    const toggle = [...f.container.querySelectorAll('button')].find(b => props(b).onClick && /toggleTask|toggle\(/.test(String(props(b).onClick))); assert.ok(toggle);
    const hold = deferred(); f.reply(async r => { await hold.promise; return Response.json({ task: { ...makeTask({ dealId: page === 'deals' ? 'deal-a' : null }), ...r.body, updatedAt: '2026-10-07T00:00:00.001Z' } }); });
    let pending; await f.act(() => { pending = props(toggle).onClick(); }); assert.equal(f.writes[0].body.expectedUpdatedAt, makeTask().updatedAt); assert.equal(f.writes[0].body.status, 'done');
    await f.act(() => { hold.resolve(); }); await f.act(() => pending);
  }, { tasks: [makeTask({ dealId: page === 'deals' ? 'deal-a' : null })] });
  await check('AI bulk retains failed candidate and reports only confirmed saved count', 'deals', async f => {
    const ai = [...f.container.querySelectorAll('button')].find(b => b.textContent.includes('AI') && props(b).onClick); assert.ok(ai);
    await f.act(() => props(ai).onClick());
    const add = f.button('チェックしたタスクを追加'); assert.ok(add);
    let count = 0;
    f.reply(r => { if (++count === 2) return Response.json({ error: '保存できません' }, { status: 400 }); return Response.json({ task: f.taskData(r.body) }); });
    await f.act(() => props(add).onClick()); assert.ok(f.notices.some(n => n.text === 'タスクを1件追加しました')); assert.ok(!f.container.textContent.includes('First candidate')); assert.ok(f.container.textContent.includes('Second candidate'));
  });
  await check('AI all-failed bulk never claims zero successes or closes candidates', 'deals', async f => {
    const ai = [...f.container.querySelectorAll('button')].find(b => b.textContent.includes('AI') && props(b).onClick); await f.act(() => props(ai).onClick());
    f.reply(() => Response.json({ error: '保存できません' }, { status: 400 })); await f.act(() => props(f.button('チェックしたタスクを追加')).onClick());
    assert.ok(!f.notices.some(n => n.kind === 'success')); assert.ok(f.container.textContent.includes('First candidate')); assert.ok(f.container.textContent.includes('Second candidate'));
  });
  await check('Closing detail while save in flight preserves another deal draft', 'deals', async f => {
    await f.openDetail(); await f.edit('input[placeholder^="やること"]', 'First'); const hold = deferred(); f.reply(async r => { await hold.promise; return Response.json({ task: f.taskData(r.body) }); });
    const input = f.container.querySelector('input[placeholder^="やること"]'); let saving; await f.act(() => { saving = props(f.button('追加', input.parentElement)).onClick(); });
    await f.openDetail(1); await f.edit('input[placeholder^="やること"]', 'Second deal draft'); await f.act(() => { hold.resolve(); }); await f.act(() => saving);
    assert.equal(f.container.querySelector('input[placeholder^="やること"]').value, 'Second deal draft');
  });
  await check('Layout hides same-actor loading without discarding draft and resets child on actor change', 'layout', async f => {
    await f.edit('#scoped-child', 'Private draft'); await f.auth('actor-a', 'loading');
    assert.equal(f.container.querySelector('#scoped-child').value,'Private draft'); assert.ok(f.container.querySelector('#scoped-child').closest('[hidden]'));
    assert.equal(f.container.querySelector('aside').dataset.plan,''); assert.equal(f.container.querySelector('aside').dataset.memberships,'[]');
    await f.auth('actor-a'); assert.equal(f.container.querySelector('#scoped-child').value,'Private draft'); assert.equal(f.container.querySelector('#scoped-child').closest('[hidden]'),null);
    await f.auth('actor-b'); assert.equal(f.container.querySelector('#scoped-child').value,'Initial');
  });
  await check('Layout rejects old actor usage response even after actor round-trip', 'layout', async f => {
    const hold=deferred();f.read(async r=>{if(r.path==='/api/sfa/usage'){await hold.promise;return Response.json({plan:'PRO',memberships:[{slug:'old',name:'Old actor',role:'owner'}]})}});
    await f.auth('actor-b');f.read(undefined);await f.auth('actor-a');
    await f.act(()=>{hold.resolve()});assert.equal(f.container.querySelector('aside').dataset.plan,'FREE');assert.ok(!f.container.querySelector('aside').dataset.memberships.includes('Old actor'));
  });
  await check('AI unknown bulk stops remaining sends; recovery removes only committed candidate', 'deals', async f => {
    const ai=[...f.container.querySelectorAll('button')].find(b=>b.textContent.includes('AI')&&props(b).onClick);await f.act(()=>props(ai).onClick());
    const before=f.writes.length;f.reply(r=>{f.receipts.set(r.body.operationId,{kind:'task',row:f.taskData(r.body)});throw Error('lost after commit')});
    const add=f.button('チェックしたタスクを追加');await f.act(()=>{props(add).onClick();props(add).onClick()});
    assert.equal(f.writes.length,before+1);assert.ok(f.container.textContent.includes('First candidate'));assert.ok(f.container.textContent.includes('Second candidate'));assert.ok(!f.notices.some(n=>n.kind==='success'));
    f.reply(undefined);await f.act(()=>props(f.button('保存結果を確認')).onClick());
    assert.ok(!f.container.textContent.includes('First candidate'));assert.ok(f.container.textContent.includes('Second candidate'));
    await f.act(()=>props(f.button('チェックしたタスクを追加')).onClick());assert.equal(f.writes.length,before+2);assert.equal(f.writes.at(-1).body.title,'Second candidate');
  });
  await check('AI cancelling unknown operation retains candidate for a new explicit attempt', 'deals', async f => {
    const ai=[...f.container.querySelectorAll('button')].find(b=>b.textContent.includes('AI')&&props(b).onClick);await f.act(()=>props(ai).onClick());
    f.reply(()=>Response.json({}, {status:503}));await f.act(()=>props(f.button('チェックしたタスクを追加')).onClick());const original=f.writes.at(-1).body.operationId;
    f.reply(undefined);await f.act(()=>props(f.button('未保存ならこの操作を取り消す')).onClick());assert.ok(f.container.textContent.includes('First candidate'));
    await f.act(()=>props(f.button('チェックしたタスクを追加')).onClick());const posts=f.writes.filter(r=>r.init.method==='POST'&&r.path==='/api/sfa/tasks');assert.equal(posts.length,3);assert.notEqual(posts[1].body.operationId,original);
  });
  await check('Recognized AI quota rejection uses shared quota guide without a second error toast', 'deals', async f => {
    f.reply(()=>Response.json({code:'SFA_AI_LIMIT_REACHED',limitReached:true,canManageBilling:false,error:'組織の契約者にご相談ください。'}, {status:402}));
    const ai=[...f.container.querySelectorAll('button')].find(b=>b.textContent.includes('AI')&&props(b).onClick);await f.act(()=>props(ai).onClick());assert.equal(f.notices.length,0);assert.ok(!f.container.textContent.includes('First candidate'));
  });
  const sources = ['src/lib/use-org-settings-guard.ts','src/lib/org-client-response.ts','src/lib/sfa/client-response.ts','src/lib/sfa/use-client-mutations.ts','src/components/sfa/MutationRecovery.tsx',...['page.tsx','layout.tsx','tasks/page.tsx','activities/page.tsx','deals/page.tsx'].map(p=>'src/app/sfa/[orgSlug]/'+p),'scripts/security-regression/sfa-client-fixture.cjs','scripts/security-regression/verify-sfa-client-lifecycle.cjs'];
  const sourceHashes=Object.fromEntries(sources.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), sourceHashes, passed: results.length, results, scope: 'Actual four pages, shared mutation hook, recovery UI, session guard, bounded transport and DTO validators mounted in React StrictMode. Synthetic Next navigation/auth, API/receipts and DOM; no customer writes/provider/billing/private production. Server cancellation locking separately tested.' }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
