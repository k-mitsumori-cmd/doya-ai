const assert = require('node:assert/strict');
const path = require('node:path');

module.exports = async ({ page, newPage, db, origin, tokens, http, reset, click, has, pass, base }) => {
  await page.setCookie({ name: 'next-auth.session-token', value: tokens.A, url: origin, httpOnly: true, sameSite: 'Lax' });
  await page.setViewport({ width: 320, height: 780, deviceScaleFactor: 1 });
  let sequence = 0;
  const make = () => db.hrEvaluationPeriod.create({ data: {
    id: 'synthetic-native-period-' + (++sequence), organizationId: 'synthetic-org-A', name: 'Synthetic native period',
    startDate: new Date('2099-01-01'), endDate: new Date('2099-12-31'),
  } });
  const read = period => db.hrEvaluationPeriod.findUnique({ where: { id: period.id } });
  const patches = period => http.filter(x => x.method === 'PATCH' && x.url === '/api/hr/evaluations/periods/' + period.id).length;
  const open = async (target, period) => {
    await target.goto(origin + '/hr/evaluations/period/' + period.id, { waitUntil: 'domcontentloaded' });
    await target.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === '評価を開始する' && !b.disabled), { timeout: 12000, polling: 100 });
  };
  const continuePeriod = async target => {
    await click(target, '保存結果を確認する');
    await click(target, '最新状態を確認して続ける');
    // Native click dispatch completes before the async Web Lock acknowledgment.
    await target.waitForFunction(() => !document.querySelector('section[role="alert"]') &&
      [...document.querySelectorAll('button')].some(b => ['評価を開始する', '評価を締める'].includes(b.textContent.trim()) && !b.disabled),
    { timeout: 12000, polling: 100 });
  };
  const disabled = (target, label) => target.evaluate(label => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === label)?.disabled, label);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  await reset();
  let period = await make();
  await open(page, period);
  await page.evaluate(() => { window.__dropSaveAck = true; });
  await click(page, '評価を開始する');
  await has(page, '更新結果を確認できませんでした');
  assert.equal((await read(period)).status, 'OPEN');
  assert.equal(patches(period), 1);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await has(page, '前回の変更結果が未確認');
  assert.equal(await disabled(page, '評価を締める'), true);
  await page.evaluate(() => document.querySelector('section[role="alert"]').scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: path.join(base, 'hr-evaluation-native-mobile-period-pending.png'), fullPage: true });
  await continuePeriod(page);
  assert.equal(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hr-evaluation-period-intent:')).length), 0);
  assert.equal(patches(period), 1);
  assert.equal(await db.hrAuditLog.count({ where: { action: 'EVALUATION_PERIOD_OPERATION', targetId: period.id } }), 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  pass('Actual period lost PATCH acknowledgment survives native reload and GET-only explicit confirmation');

  await reset();
  period = await make();
  await open(page, period);
  let release, entered;
  const lockEntered = new Promise(resolve => { entered = resolve; });
  const hold = new Promise(resolve => { release = resolve; });
  const held = db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM hr_organizations WHERE id = ${'synthetic-org-A'} FOR UPDATE`;
    entered(); await hold;
  }, { timeout: 15000 });
  await lockEntered;
  try {
    await click(page, '評価を開始する');
    let queued = false;
    const until = Date.now() + 5000;
    while (Date.now() < until) {
      const rows = await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE '%hr_organizations%'`;
      if (rows.length) { queued = true; break; }
      await sleep(10);
    }
    assert.equal(queued, true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await has(page, '前回の変更結果が未確認');
    assert.equal(patches(period), 1);
    assert.equal(await disabled(page, '評価を開始する'), true);
  } finally { release(); await held; }
  const until = Date.now() + 10000;
  while (Date.now() < until && (await read(period)).status !== 'OPEN') await sleep(20);
  assert.equal((await read(period)).status, 'OPEN');
  await continuePeriod(page);
  assert.equal(patches(period), 1);
  pass('Native reload while actual period PATCH waits on SQL lock cannot send a second change');

  await reset();
  period = await make();
  await open(page, period);
  const other = await newPage();
  await open(other, period);
  let releaseTabs, enteredTabs;
  const tabsEntered = new Promise(resolve => { enteredTabs = resolve; });
  const tabsHold = new Promise(resolve => { releaseTabs = resolve; });
  const heldTabs = db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM hr_organizations WHERE id = ${'synthetic-org-A'} FOR UPDATE`;
    enteredTabs(); await tabsHold;
  }, { timeout: 15000 });
  await tabsEntered;
  try {
    await Promise.all([page, other].map(target => target.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '評価を開始する').click())));
    await page.waitForFunction(() => Object.keys(localStorage).some(k => k.startsWith('hr-evaluation-period-intent:')), { timeout: 5000, polling: 100 });
    await sleep(200);
    assert.equal(patches(period), 1);
  } finally { releaseTabs(); await heldTabs; }
  await Promise.any([has(page, '評価期間を開始しました'), has(other, '評価期間を開始しました')]);
  assert.equal(patches(period), 1);
  assert.equal(await db.hrAuditLog.count({ where: { action: 'EVALUATION_PERIOD_OPERATION', targetId: period.id } }), 1);
  await other.close();
  pass('Two real tabs competing for period status persist one operation and send one PATCH');

  await reset();
  period = await make();
  await open(page, period);
  await page.evaluate(() => {
    window.__nativePeriodRemove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
      if (key.startsWith('hr-evaluation-period-intent:')) throw Error('Synthetic period operation removal failure');
      return window.__nativePeriodRemove.call(this, key);
    };
  });
  try {
    await click(page, '評価を開始する');
    await has(page, '保存の応答を確認できませんでした');
    assert.equal(patches(period), 1);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === '評価を作成').every(b => b.disabled)), true);
    assert.equal((await read(period)).status, 'OPEN');
  } finally { await page.evaluate(() => { Storage.prototype.removeItem = window.__nativePeriodRemove; }); }
  await continuePeriod(page);
  assert.equal(patches(period), 1);
  pass('Actual period acknowledgment storage-clear failure blocks new status and evaluation creation');

  await reset();
  period = await make();
  await open(page, period);
  await db.hrEvaluationPeriod.update({ where: { id: period.id }, data: { name: 'Synthetic newer period', updatedAt: new Date(period.updatedAt.getTime() + 1000) } });
  await click(page, '評価を開始する');
  await has(page, '評価期間が更新されています');
  assert.equal(await db.hrAuditLog.count({ where: { action: 'EVALUATION_PERIOD_OPERATION' } }), 0);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await has(page, '前回の変更結果が未確認');
  await click(page, '保存結果を確認する');
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === '最新状態を確認して続ける')), false);
  await click(page, 'この変更操作を終了する');
  await continuePeriod(page);
  assert.equal((await read(period)).status, 'DRAFT');
  assert.equal(patches(period), 1);
  pass('Actual stale period PATCH requires an explicit cancellation fence before reopening after reload');
  await reset();
  period = await make();
  await open(page, period);
  await page.evaluate(() => { window.__dropSaveAck = true; });
  await click(page, '評価を開始する');
  await has(page, '更新結果を確認できませんでした');
  const deletedKey = await page.evaluate(() => Object.keys(localStorage).find(k => k.startsWith('hr-evaluation-period-intent:')));
  assert.ok(deletedKey);
  await db.hrEvaluationPeriod.delete({ where: { id: period.id } });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await has(page, '評価期間が見つかりません');
  assert.equal(await disabled(page, 'この変更操作を終了する'), true);
  await click(page, '変更操作の結果を確認する');
  await has(page, '対象の評価期間は削除されています');
  assert.ok(await page.evaluate(key => localStorage.getItem(key), deletedKey));
  await click(page, '削除済みの結果を確認して評価一覧に戻る');
  await page.waitForFunction(() => location.pathname === '/hr/evaluations', { timeout: 12000 });
  assert.equal(await page.evaluate(key => localStorage.getItem(key), deletedKey), null);
  assert.equal(patches(period), 1);
  assert.equal(http.filter(x => x.method === 'DELETE' && x.url.includes(period.id)).length, 0);
  pass('Actual deleted period after lost PATCH and native reload offers authorized receipt confirmation and explicit exit');

  await reset();
  period = await make();
  await open(page, period);
  await page.evaluate(() => { window.__dropSaveAck = true; });
  await click(page, '評価を開始する');
  await has(page, '更新結果を確認できませんでした');
  const deniedKey = await page.evaluate(() => Object.keys(localStorage).find(k => k.startsWith('hr-evaluation-period-intent:')));
  const deniedSaved = await page.evaluate(key => localStorage.getItem(key), deniedKey);
  await db.hrOrganizationMember.update({ where: { id: 'synthetic-member-A' }, data: { role: 'MEMBER' } });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await has(page, '評価期間を表示できません');
  await click(page, '変更操作の結果を確認する');
  await has(page, '組織または権限');
  assert.equal(await disabled(page, 'この変更操作を終了する'), true);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), deniedKey), deniedSaved);
  assert.equal(http.filter(x => x.method === 'DELETE' && x.url.includes(period.id)).length, 0);
  await db.hrOrganizationMember.update({ where: { id: 'synthetic-member-A' }, data: { role: 'OWNER' } });
  await click(page, '再取得する');
  await has(page, '評価を締める');
  assert.equal(await disabled(page, '評価を締める'), true);
  await continuePeriod(page);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), deniedKey), null);
  assert.equal(patches(period), 1);
  pass('Actual membership loss retains period intent across native reload and restoration requires explicit recovery');

  await reset();
  period = await make();
  await open(page, period);
  await page.evaluate(() => { window.__dropSaveAck = true; });
  await click(page, '評価を開始する');
  await has(page, '更新結果を確認できませんでした');
  const switchedKey = await page.evaluate(() => Object.keys(localStorage).find(k => k.startsWith('hr-evaluation-period-intent:')));
  const switchedSaved = await page.evaluate(key => localStorage.getItem(key), switchedKey);
  await db.hrOrganizationMember.create({ data: { id: 'synthetic-context-switch-member', userId: 'synthetic-user-A', organizationId: 'synthetic-org-B', status: 'ACTIVE', role: 'OWNER', createdAt: new Date(Date.now() + 1000) } });
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await has(page, '評価期間を表示できません');
    await has(page, '前回の操作は別の組織で行われました');
    assert.equal(await page.evaluate(key => localStorage.getItem(key), switchedKey), switchedSaved);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].some(b => ['変更操作の結果を確認する', 'この変更操作を終了する'].includes(b.textContent.trim()) && !b.disabled)), false);
    assert.equal(http.filter(x => x.method === 'DELETE' && x.url.includes(period.id)).length, 0);
    assert.equal(await page.evaluate(() => document.body.textContent.includes('Synthetic period B')), false);
    await page.screenshot({ path: path.join(base, 'hr-evaluation-native-mobile-period-forbidden.png'), fullPage: true });
  } finally { await db.hrOrganizationMember.delete({ where: { id: 'synthetic-context-switch-member' } }); }
  page.once('dialog', dialog => dialog.accept());
  await page.select('select[aria-label="表示する組織"]', 'synthetic-org-A');
  await page.waitForFunction(() => location.pathname === '/hr/dashboard', { timeout: 12000 });
  await page.goto(origin + '/hr/evaluations/period/' + period.id, { waitUntil: 'domcontentloaded' });
  await has(page, '前回の変更結果が未確認');
  await has(page, '評価を締める');
  await continuePeriod(page);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), switchedKey), null);
  assert.equal(patches(period), 1);
  pass('Actual active organization context change cannot reroute or erase old period operation on native reload');

  const creationKey = () => page.evaluate(() => Object.keys(localStorage).find(k => k.startsWith('hr-evaluation-create-intent:')));
  const creationPosts = () => http.filter(x => x.method === 'POST' && x.url === '/api/hr/evaluations').length;
  const exitCreation = async () => {
    await click(page, '結果を確認して評価一覧に戻る');
    await page.waitForFunction(() => location.pathname === '/hr/evaluations', { timeout: 12000 });
  };

  await reset();
  period = await make();
  await open(page, period);
  let beforeCreationPosts = creationPosts();
  await page.evaluate(() => { window.__dropCreationAck = true; });
  await click(page, '評価を作成');
  await has(page, '評価の作成結果を確認できませんでした');
  assert.equal(await db.hrEvaluation.count({ where: { periodId: period.id } }), 1);
  let pendingCreationKey = await creationKey();
  await db.hrEvaluationPeriod.delete({ where: { id: period.id } });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await has(page, '評価期間が見つかりません');
  await click(page, '作成結果を確認する');
  await has(page, '作成済みの評価は削除されています');
  assert.ok(await page.evaluate(key => localStorage.getItem(key), pendingCreationKey));
  await exitCreation();
  assert.equal(await page.evaluate(key => localStorage.getItem(key), pendingCreationKey), null);
  assert.equal(creationPosts(), beforeCreationPosts + 1);
  assert.equal(await db.hrAuditLog.count({ where: { action: 'EVALUATION_CREATED' } }), 1);
  pass('Actual creation lost ACK and cascaded period deletion survive native reload and explicitly exit after authorized deleted receipt');

  await reset();
  period = await make();
  await open(page, period);
  beforeCreationPosts = creationPosts();
  await page.evaluate(() => { window.__dropCreationAck = true; });
  await click(page, '評価を作成');
  await has(page, '評価の作成結果を確認できませんでした');
  pendingCreationKey = await creationKey();
  const creationRaw = await page.evaluate(key => localStorage.getItem(key), pendingCreationKey);
  const createdEvaluation = await db.hrEvaluation.findFirst({ where: { periodId: period.id } });
  await db.hrOrganizationMember.update({ where: { id: 'synthetic-member-A' }, data: { role: 'MEMBER' } });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await has(page, '評価期間を表示できません');
  await click(page, '作成結果を確認する');
  await has(page, '組織または権限');
  assert.equal(await page.evaluate(key => localStorage.getItem(key), pendingCreationKey), creationRaw);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === '同じ内容で作成を再開する' && !b.disabled)), false);
  await page.screenshot({ path: path.join(base, 'hr-evaluation-native-mobile-creation-forbidden.png'), fullPage: true });
  await db.hrOrganizationMember.update({ where: { id: 'synthetic-member-A' }, data: { role: 'OWNER' } });
  await click(page, '再取得する');
  // The prior error panel remains briefly until React renders loading. Wait for the new ready period header.
  await has(page, '評価を開始する');
  await click(page, '作成結果を確認する');
  await click(page, '保存済みの評価を開く');
  await page.waitForFunction(id => location.pathname === '/hr/evaluations/' + id, { timeout: 12000 }, createdEvaluation.id);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), pendingCreationKey), null);
  assert.equal(creationPosts(), beforeCreationPosts + 1);
  assert.equal(await db.hrEvaluation.count({ where: { periodId: period.id } }), 1);
  pass('Actual creation permission loss preserves intent after native reload and restored authority opens saved evaluation without POST replay');

  await reset();
  period = await make();
  await open(page, period);
  beforeCreationPosts = creationPosts();
  await page.evaluate(() => { window.__dropCreationAck = true; });
  await click(page, '評価を作成');
  await has(page, '評価の作成結果を確認できませんでした');
  pendingCreationKey = await creationKey();
  const switchedCreationRaw = await page.evaluate(key => localStorage.getItem(key), pendingCreationKey);
  await db.hrOrganizationMember.create({ data: { id: 'synthetic-creation-context-switch', userId: 'synthetic-user-A', organizationId: 'synthetic-org-B', status: 'ACTIVE', role: 'OWNER', createdAt: new Date(Date.now() + 1000) } });
  try {
    // An earlier explicit A choice intentionally survives reload. Refresh newly inserted membership choices, then switch visibly to B.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => { const select = document.querySelector('select[aria-label="表示する組織"]'); return select && !select.disabled && [...select.options].some(option => option.value === 'synthetic-org-B') }, { timeout: 12000 });
    page.once('dialog', dialog => dialog.accept());
    await page.select('select[aria-label="表示する組織"]', 'synthetic-org-B');
    await page.waitForFunction(() => location.pathname === '/hr/dashboard', { timeout: 12000 });
    await page.goto(origin + '/hr/evaluations/period/' + period.id, { waitUntil: 'domcontentloaded' });
    await has(page, '評価期間を表示できません');
    await has(page, '前回の操作は別の組織で行われました');
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].some(b => ['作成結果を確認する', 'この作成操作を終了する'].includes(b.textContent.trim()) && !b.disabled)), false);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), pendingCreationKey), switchedCreationRaw);
    assert.equal(await page.evaluate(() => document.body.textContent.includes('Synthetic period B')), false);
  } finally { await db.hrOrganizationMember.delete({ where: { id: 'synthetic-creation-context-switch' } }); }
  page.once('dialog', dialog => dialog.accept());
  await page.select('select[aria-label="表示する組織"]', 'synthetic-org-A');
  await page.waitForFunction(() => location.pathname === '/hr/dashboard', { timeout: 12000 });
  await page.goto(origin + '/hr/evaluations/period/' + period.id, { waitUntil: 'domcontentloaded' });
  await has(page, '評価を開始する');
  await click(page, '作成結果を確認する');
  await click(page, '結果を確認して一覧を更新する');
  await page.waitForFunction(key => !localStorage.getItem(key) && [...document.querySelectorAll('button')].some(b => b.textContent.trim() === '評価を開始する' && !b.disabled), { timeout: 12000 }, pendingCreationKey);
  assert.equal(creationPosts(), beforeCreationPosts + 1);
  assert.equal(await db.hrEvaluation.count({ where: { periodId: period.id } }), 1);
  pass('Actual active organization change cannot reroute creation receipt; explicit recovery resumes only after context restoration');

  await reset();
  period = await make();
  await open(page, period);
  beforeCreationPosts = creationPosts();
  await page.evaluate(() => { window.__skipCreationSend = true; });
  await click(page, '評価を作成');
  await has(page, '評価の作成結果を確認できませんでした');
  pendingCreationKey = await creationKey();
  const unsent = JSON.parse(await page.evaluate(key => localStorage.getItem(key), pendingCreationKey));
  assert.equal(creationPosts(), beforeCreationPosts);
  await db.hrEvaluationPeriod.delete({ where: { id: period.id } });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await has(page, '評価期間が見つかりません');
  await click(page, '作成結果を確認する');
  await has(page, '受付記録を確認できません');
  assert.equal(await disabled(page, '同じ内容で作成を再開する'), true);
  await click(page, '未受付の操作を終了する');
  await has(page, '未受付の操作を終了しました');
  await exitCreation();
  assert.equal(await page.evaluate(key => localStorage.getItem(key), pendingCreationKey), null);
  assert.equal(await db.hrAuditLog.count({ where: { action: 'EVALUATION_CREATE_CANCELED' } }), 1);
  const lateStatus = await page.evaluate(async intent => {
    const response = await fetch('/api/hr/evaluations', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-HR-Evaluation-Operation': intent.operationId, 'X-HR-Organization-Id': intent.organizationId }, body: JSON.stringify(intent.input) });
    await response.text(); return response.status;
  }, unsent);
  assert.equal(lateStatus, 409);
  assert.equal(await db.hrEvaluation.count({ where: { periodId: period.id } }), 0);
  assert.equal(creationPosts(), beforeCreationPosts + 1);
  pass('Actual unreceived creation after period404 supports explicit DELETE fence and rejects delayed authenticated POST');

  await reset();
  const nativePeriod = await page.evaluate(async () => {
    const response = await fetch('/api/hr/evaluations/periods', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-HR-Organization-Id': 'synthetic-org-A' }, body: JSON.stringify({ name: 'Synthetic native lifecycle', startDate: '2099-01-01', endDate: '2099-12-31' }) });
    if (response.status !== 200) throw Error('Synthetic lifecycle creation failed'); return (await response.json()).period;
  });
  await open(page, nativePeriod);
  await click(page, '評価を作成');
  await click(page, '保存済みの評価を開く');
  await page.waitForSelector('textarea[placeholder^="この評価期間"]');
  await page.$eval('textarea[placeholder^="この評価期間"]', field => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(field, 'Native full lifecycle comment'); field.dispatchEvent(new Event('input', { bubbles: true })); });
  await click(page, '保存する');
  await has(page, '評価を保存しました');
  let lifecycleEvaluation = await db.hrEvaluation.findFirst({ where: { periodId: nativePeriod.id } });
  assert.equal(lifecycleEvaluation.selfComment, 'Native full lifecycle comment');
  for (const [label,expected] of [['自己評価の提出を記録する','SUBMITTED'],['レビュー完了にする','REVIEWED'],['評価を確定する','FINALIZED']]) {
    await click(page,label); await click(page,'保存して操作を確定する');
    await has(page,expected==='SUBMITTED'?'評価を提出しました':expected==='REVIEWED'?'レビューを完了しました':'評価を確定しました');
    lifecycleEvaluation=await db.hrEvaluation.findUnique({where:{id:lifecycleEvaluation.id}});assert.equal(lifecycleEvaluation.status,expected);
    await page.reload({waitUntil:'domcontentloaded'});await has(page,expected==='SUBMITTED'?'提出済み':expected==='REVIEWED'?'評価済み':'確定済み');
  }
  await has(page, '確定済み');
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim().endsWith('保存する') && !b.disabled)), false);
  assert.equal(await db.hrEvaluation.count({ where: { periodId: nativePeriod.id } }), 1);
  const deletedStatus = await page.evaluate(async periodId => { const url = '/api/hr/evaluations/periods/' + periodId; const snapshotResponse = await fetch(url, { headers: { 'X-HR-Organization-Id': 'synthetic-org-A' } }); const snapshot = (await snapshotResponse.json()).period; const response = await fetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'X-HR-Organization-Id': 'synthetic-org-A' }, body: JSON.stringify({ expectedUpdatedAt: snapshot.updatedAt, expectedDeletionRevision: snapshot.deletionRevision }) }); await response.text(); return response.status; }, nativePeriod.id);
  assert.equal(deletedStatus, 200);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await has(page, '評価が見つかりません');
  assert.equal(await db.hrEvaluation.count({ where: { periodId: nativePeriod.id } }), 0);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === '保存する' && !b.disabled)), false);
  pass('Actual native overview creation saved-detail edit and submit/finalize/delete API lifecycle remain consistent');

};
