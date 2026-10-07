const assert = require('node:assert/strict'), fs = require('node:fs'), crypto = require('node:crypto');
const { load } = require('./load-typescript.cjs');
let output, provider = 0;
const ai = load('src/lib/sfa/ai.ts', {
  './lead-score-result': load('src/lib/sfa/lead-score-result.ts'),
  '@seo/lib/gemini': { GEMINI_TEXT_MODEL_DEFAULT: 'synthetic', geminiGenerateJson: async () => { provider++; return output; } },
});
const valid = () => ({ nextAction: ' 次の一手 ', reason: ' 理由 ', risk: '', tasks: [{ title: ' 確認する ', dueDate: '2026-09-30' }] });
const cases = [];
async function reject(name, value) {
  output = value;
  await assert.rejects(ai.suggestNextAction({ dealName: 'Synthetic' }), /AI提案の形式/);
  cases.push(name);
}
(async () => {
  for (const [name, value] of [['null', null], ['array', []], ['empty', {}], ['error', { ...valid(), error: 'bad' }], ['code', { ...valid(), code: 'bad' }]]) await reject(name, value);
  for (const key of ['nextAction', 'reason', 'risk']) {
    for (const value of [undefined, {}, 7, 'x'.repeat(2001)]) await reject(key + ':' + typeof value + ':' + String(value).length, { ...valid(), [key]: value });
  }
  for (const key of ['nextAction', 'reason']) await reject(key + ':blank', { ...valid(), [key]: '  ' });
  await reject('tasks missing', { ...valid(), tasks: undefined });
  await reject('tasks not array', { ...valid(), tasks: {} });
  await reject('too many tasks', { ...valid(), tasks: Array.from({ length: 5 }, () => valid().tasks[0]) });
  for (const task of [null, [], {}, { title: '', dueDate: null }, { title: 'x'.repeat(201), dueDate: null }, { title: 'Task', dueDate: 7 }]) await reject('invalid task:' + JSON.stringify(task), { ...valid(), tasks: [task] });
  output = { ...valid(), tasks: [{ title: ' 確認する ', dueDate: '2026-09-30' }, { title: '無効日', dueDate: '2026-02-30' }, { title: '未定', dueDate: null }] };
  const result = await ai.suggestNextAction({ dealName: 'Synthetic' }, new Date('2026-09-30T15:00:00Z'));
  assert.equal(result.nextAction, '次の一手'); assert.equal(result.reason, '理由'); assert.equal(result.risk, '');
  assert.equal(result.tasks[0].title, '確認する'); assert.equal(result.tasks[0].dueDate, '2026-10-01'); assert.equal(result.tasks[1].dueDate, null); assert.equal(result.tasks[2].dueDate, null);
  cases.push('valid response trims text and preserves JST/calendar normalization');
  output = { ...valid(), tasks: [] }; assert.equal((await ai.suggestNextAction({ dealName: 'Synthetic' })).tasks.length, 0);
  cases.push('actionable suggestion can have no optional task candidates');
  const { fixture } = require('./sfa-next-action-api-fixture.cjs');
  for (const bad of [{}, { ...valid(), nextAction: {} }, { ...valid(), reason: 'x'.repeat(2001) }]) {
    const f = fixture(); output = bad; f.provider(() => ai.suggestNextAction({ dealName: 'Synthetic' }));
    assert.equal((await f.call()).status, 500); assert.equal(f.state().generations.length, 0);
  }
  cases.push('actual durable route+actual helper reject malformed model and refund pending reservation');
  const f = fixture(); output = valid(); f.provider(() => ai.suggestNextAction({ dealName: 'Synthetic' }));
  assert.equal((await f.call()).status, 200); assert.equal(f.state().generations[0].outputType, 'SFA_AI_COMPLETE');
  cases.push('actual durable route accepts valid suggestion and completes one reservation');
  fs.writeFileSync('docs/audits/2026-10-06-all-services-recheck/sfa-next-action-result-results.json', JSON.stringify({ checkedAt: new Date().toISOString(), passed: cases.length, cases, sourceHash: crypto.createHash('sha256').update(fs.readFileSync('src/lib/sfa/ai.ts')).digest('hex'), scope: 'Actual suggestNextAction/parser and actual route; mocked model/context/quota/Prisma. No real provider, transaction concurrency, browser, production or customer writes. Durable operation concurrency requires separate real PostgreSQL verification.' }, null, 2) + '\n');
  console.log('PASS ' + cases.length + ' next-action validation and quota outcomes');
})().catch(error => { console.error(error); process.exitCode = 1 });
