const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

const { restoreCunningLiveHistory } = load('src/lib/cunning/live-history.ts');
const transcripts = Array.from({ length: 501 }, (_, index) => ({
  id: `t${index}`, speaker: index % 2 ? 'self' : 'remote', text: `Saved transcript ${index}`,
}));
const answers = Array.from({ length: 201 }, (_, index) => ({
  id: `a${index}`, questionText: `Question ${index}`, summary: `Summary ${index}`,
  script: `Script ${index}`, sources: [{ label: 'Source' }, null], model: 'saved-model',
}));
const result = restoreCunningLiveHistory({ transcripts, answers, totals: { transcripts: 501, answers: 201 } });
assert.equal(result.lines.length, 81);
assert.equal(result.lines[0].id, 't420');
assert.equal(result.lines.at(-1).id, 't500');
assert.equal(result.answers[0].id, 'a200', 'newest saved answer is visible first');
assert.deepEqual(Array.from(result.answers[0].sources, source => source.label), ['Source']);
assert.equal(result.hasMore, false);
const partial = restoreCunningLiveHistory({ transcripts: transcripts.slice(0, 500), answers: answers.slice(0, 200), totals: { transcripts: 501, answers: 201 } });
assert.equal(partial.hasMore, true, 'incomplete first page links to full history');
assert.throws(() => restoreCunningLiveHistory({ transcripts: null, answers: [] }), /履歴/);
console.log('PASS Cunning live reload restores saved transcript and answer order, and exposes partial history');
