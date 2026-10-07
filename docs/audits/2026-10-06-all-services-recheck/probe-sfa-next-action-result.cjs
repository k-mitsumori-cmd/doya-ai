const assert = require('node:assert/strict'), fs = require('node:fs'), crypto = require('node:crypto');
const { load } = require('../../../scripts/security-regression/load-typescript.cjs');
let output;
const ai = load('src/lib/sfa/ai.ts', {
  './lead-score-result': load('src/lib/sfa/lead-score-result.ts'),
  '@seo/lib/gemini': { GEMINI_TEXT_MODEL_DEFAULT: 'synthetic', geminiGenerateJson: async () => output },
});
(async () => {
  const results = [];
  output = {};
  let r = await ai.suggestNextAction({ dealName: 'Synthetic' });
  assert.equal(r.nextAction, ''); assert.equal(r.reason, ''); assert.equal(r.tasks.length, 0);
  results.push('Empty model object becomes an empty apparent success, allowing handler to complete quota.');
  output = { nextAction: { unexpected: true }, reason: 7, risk: ['wrong type'], tasks: [] };
  r = await ai.suggestNextAction({ dealName: 'Synthetic' });
  assert.equal(typeof r.nextAction, 'object'); assert.equal(typeof r.reason, 'number');
  results.push('Non-string model fields pass server helper; mounted client rejects them only after handler completes quota.');
  output = { nextAction: 'x'.repeat(100000), reason: 'Reason', risk: '', tasks: [] };
  r = await ai.suggestNextAction({ dealName: 'Synthetic' });
  assert.equal(r.nextAction.length, 100000);
  results.push('Model text has no server length bound.');
  const path = 'src/lib/sfa/ai.ts';
  fs.writeFileSync('docs/audits/2026-10-06-all-services-recheck/sfa-next-action-result-baseline.json', JSON.stringify({ checkedAt: new Date().toISOString(), status: 'confirmed-gaps-not-repaired', results, sourceHash: crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex'), scope: 'Actual suggestNextAction with synthetic model output. Quota consequence traced in actual route; no live provider or customer writes.' }, null, 2) + '\n');
  console.log('Confirmed next-action result validation gaps: ' + results.length);
})().catch(error => { console.error(error); process.exitCode = 1 });
