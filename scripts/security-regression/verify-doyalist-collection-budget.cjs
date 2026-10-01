// Offline regression: stop collection before provider calls exceed the wall-clock budget.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const repo = resolve(__dirname, '../..');
const ts = createRequire(repo + '/package.json')('typescript');
const source = fs.readFileSync(repo + '/src/lib/doyalist/collect/index.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
let now = 0;
const calls = [];
const moduleExports = {};
vm.runInNewContext(compiled, {
  exports: moduleExports,
  Date: { now: () => now },
  console: { log() {}, error() {} },
  require(name) {
    if (name === './corporate-number') return { async searchCorporateNumber(params) {
      calls.push(['corporate', params.timeoutMs]);
      now += 60;
      return [{ name: 'Example', corporateNumber: '1234567890123' }];
    } };
    if (name === './gbizinfo') return {
      async searchGbizInfo() { calls.push(['gbiz']); return { companies: [], status: 200 }; },
      async getGbizCompanyDetailsBatch() { calls.push(['details']); return new Map(); },
    };
    if (name === './prefecture-codes') return { AREA_TO_PREFECTURES: {}, PREFECTURE_TO_CODE: {} };
    throw Error(`Unexpected module: ${name}`);
  },
});

(async () => {
  const result = await moduleExports.collectCompaniesDetailed({
    criteria: { keywords: ['first', 'second'] },
    sources: ['corporate_number', 'gbizinfo'],
    maxResults: 10,
    budgetMs: 50,
  });
  assert.equal(result.companies.length, 1);
  assert.equal(result.apiOk, true);
  assert.equal(result.budgetExhausted, true);
  assert.equal(JSON.stringify(calls), JSON.stringify([['corporate', 50]]));
  console.log('PASS Doyalist collection preserves partial results and skips calls after budget');
})().catch(error => { console.error(error); process.exitCode = 1; });
