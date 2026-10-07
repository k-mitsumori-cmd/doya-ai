const assert = require('node:assert/strict');
const { fixture, deferred, props, makeTask } = require('./sfa-client-fixture.cjs');
async function verify(operations) {
  const results = [];
  for (const operation of operations) for (const mode of operation === 'delete' ? ['success','403','404','500','network','malformed','duplicate','retry'] : ['success','500','network','malformed','wrong-id','duplicate','retry']) {
    const initial = makeTask({ title: 'Task A', dealName: 'Retained deal' }, 'a'), other = makeTask({ title: 'Task B' }, 'b');
    let rows = [{ ...initial }, { ...other }], calls = 0;
    const f = await fixture('tasks', { tasks: rows });
    try {
      f.read(r => {
        if (r.path === '/api/sfa/tasks') return Response.json({ tasks: rows, page: 1, hasMore: false });
        if (r.path === '/api/sfa/tasks/a') return Response.json({ state: rows.some(t => t.id === 'a') ? 'found' : 'missing', task: rows.find(t => t.id === 'a') || null });
      });
      const title = () => [...f.container.querySelectorAll('p')].find(p => p.textContent === 'Task A');
      const row = () => title()?.parentElement.parentElement;
      const invoke = () => {
        const target = row(); assert.ok(target);
        if (operation === 'delete') return props(target.querySelector('[aria-label="タスクを削除"]')).onClick();
        if (operation === 'toggle') return props(target.querySelector('button')).onClick();
        return props(target.querySelector('input[type=date]')).onChange({ target: { value: '2026-09-22' } });
      };
      const hold = deferred();
      f.reply(async r => {
        calls++;
        if (mode === 'duplicate') await hold.promise;
        if (mode === 'network') throw Error('network lost');
        if (['403','404','500'].includes(mode) || mode === 'retry' && calls === 1) return Response.json({ error: 'blocked' }, { status: mode === 'retry' ? 500 : Number(mode) });
        if (mode === 'malformed') return Response.json({});
        if (operation === 'delete') { rows = rows.filter(t => t.id !== 'a'); return Response.json({ ok: true }); }
        const updated = { ...initial, status: operation === 'toggle' ? 'done' : 'open', dueDate: operation === 'changeDue' ? '2026-09-22T00:00:00.000Z' : null, updatedAt: '2026-10-07T00:00:00.001Z' };
        if (mode === 'wrong-id') return Response.json({ task: { ...updated, id: 'other' } });
        rows = [updated, other]; return Response.json({ task: updated });
      });
      let pending; await f.act(() => { pending = invoke(); });
      if (mode === 'duplicate') {
        assert.ok(title()); assert.equal(title().classList.contains('line-through'), false); assert.equal(row().querySelector('input[type=date]').value, '');
        await f.act(() => { invoke(); props(row().querySelector('[aria-label="タスクを削除"]')).onClick(); }); assert.equal(calls, 1);
        await f.act(() => { hold.resolve(); });
      }
      await f.act(() => pending);
      const good = ['success','duplicate'].includes(mode);
      const unknown = ['500','network','malformed','wrong-id','retry'].includes(mode);
      assert.ok(f.container.textContent.includes('Task B'), 'other task survives every response');
      if (!good) {
        assert.ok(title()); assert.equal(title().classList.contains('line-through'),false); assert.equal(row().querySelector('input[type=date]').value,'');
        assert.ok(f.container.querySelector('[role=status]')); assert.equal(row().querySelector('[aria-label="タスクを削除"]').disabled, unknown);
      }
      if (mode === 'retry') {
        const before = calls; await f.act(() => invoke()); assert.equal(calls,before,'unknown write cannot be blindly replayed');
        await f.act(() => props(f.button('保存結果を確認')).onClick()); assert.equal(calls,before,'recovery is read-only');
        await f.act(() => invoke()); assert.equal(calls,2);
      }
      if (good || mode === 'retry') {
        if (operation === 'delete') assert.equal(title(),undefined);
        else {
          assert.equal(title().classList.contains('line-through'),operation === 'toggle');
          assert.equal(row().querySelector('input[type=date]').value,operation === 'changeDue' ? '2026-09-22' : '');
          assert.ok(row().textContent.includes('Retained deal'));
        }
      }
      const write = f.writes[0];
      if (operation === 'delete') assert.equal(write.url.searchParams.get('expectedUpdatedAt'),initial.updatedAt);
      else assert.deepEqual(write.body, operation === 'toggle' ? { status:'done',expectedUpdatedAt:initial.updatedAt } : { dueDate:'2026-09-22',expectedUpdatedAt:initial.updatedAt });
      results.push({ operation, mode, outcome:'PASS' });
    } finally { await f.close(); }
  }
  return results;
}
module.exports = { verify };
