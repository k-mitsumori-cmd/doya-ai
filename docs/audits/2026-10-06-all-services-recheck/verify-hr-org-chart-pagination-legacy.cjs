const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const base = __dirname;
const overlay = path.join(base, 'hr-org-chart-pagination-repair-overlay');
const sources = [
  ['verify-hr-org-chart-visibility-followup.cjs', 4],
  ['verify-hr-org-chart-visibility-cache-regression.cjs', 7],
];
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

(async () => {
  assert.equal(process.env.DOYA_TEST_BASELINE, overlay, 'Select the exact paged candidate explicitly');
  const cases = [];
  for (const [name, count] of sources) {
    const filename = path.join(base, name);
    const nativeRequire = createRequire(filename);
    let report;
    let finish;
    const completed = new Promise(resolve => { finish = resolve; });
    const loader = nativeRequire('../../../scripts/security-regression/load-typescript.cjs');
    // The original probes exercise only the legacy GET. Fail if they unexpectedly
    // enter the paged branch, which is covered separately with real SQL/client tests.
    const pagedImport = {
      readHrOrgChartPage() { throw Error('Legacy fixture unexpectedly entered paged GET'); },
      HrOrgChartPageError: class extends Error {},
    };
    const localProcess = { env: process.env, exitCode: 0 };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
      require: id => {
        if (id === '../../../scripts/security-regression/load-typescript.cjs') return {
          ...loader,
          load: (file, mocks, globals) => loader.load(file, { '@/lib/hr/org-chart-pagination': pagedImport, ...mocks }, globals),
        };
        if (id === 'node:fs') return { ...fs, writeFileSync: (_file, data) => { report = JSON.parse(data); finish(); } };
        return nativeRequire(id);
      },
      __dirname: base, process: localProcess, Response, Request, Headers, URL,
      console: { log() {}, error(error) { finish(); console.error(error); } },
    }, { filename });
    await completed;
    assert.equal(localProcess.exitCode, 0, name);
    assert.equal(report?.expected, count, name);
    assert.equal(report?.passed, count, name);
    assert.equal(report?.cases.length, count, name);
    cases.push(...report.cases.map(c => ({ ...c, originalProbe: name })));
  }
  assert.equal(cases.length, 11);
  const files = sources.map(([name]) => path.join(base, name)).concat([
    __filename,
    path.join(overlay, 'src/app/api/hr/org-chart/route.ts'),
    path.join(overlay, 'src/app/api/kintai/departments/route.ts'),
    path.resolve('src/lib/private-api-response.ts'),
    path.resolve('scripts/security-regression/load-typescript.cjs'),
  ]);
  const result = {
    checkedAt: new Date().toISOString(), expected: 11, passed: cases.length, cases,
    sourceHashes: Object.fromEntries(files.map(file => [file, hash(file)])),
    scope: 'Original legacy API4 and cache7 probes executed unchanged against the pagination candidate. Only new unused paged import is adapted with a throwing stub; no original assertion removed. Paged behavior independently requires realDB18, boundary28, mounted14 and native10. No production/customer writes or production verification.',
  };
  fs.writeFileSync(path.join(base, 'hr-org-chart-pagination-legacy-overlay.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
})().catch(error => { console.error(error); process.exitCode = 1; });
