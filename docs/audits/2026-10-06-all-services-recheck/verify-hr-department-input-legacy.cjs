const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { createRequire } = require('node:module');
const mode = process.argv[2];
assert.ok(['related', 'access', 'validation', 'cache'].includes(mode));
const filename = {related:'verify-related-records.cjs',access:'verify-hr-department-access.cjs',validation:'verify-hr-department-input.cjs',cache:'verify-hr-department-private-cache.cjs'}[mode];
const original = path.resolve('scripts/security-regression', filename);
const selected = path.join(__dirname, 'hr-department-input-regression-overlay/scripts/security-regression', filename);
process.env.DOYA_TEST_BASELINE = path.join(__dirname, 'hr-department-input-repair-overlay');
const expected = {related:33,access:1,validation:6,cache:3}[mode];
let completed = false;
const deadline = setTimeout(() => { console.error('Legacy fixture deadline exceeded'); process.exitCode = 1; }, 30000);
vm.runInNewContext(fs.readFileSync(selected, 'utf8'), {
  require: createRequire(original), __dirname: path.dirname(original), __filename: original,
  Request, Response, Headers, URL, Buffer, AbortController, TextDecoder, TextEncoder,
  setTimeout, clearTimeout, process,
  console: {
    log(value) {
      let result;
      try { result = JSON.parse(value); } catch { return; }
      if (result.passed === undefined) return;
      clearTimeout(deadline); completed = true;
      assert.equal(result.passed, expected); const checks=result.results||result.cases; assert.equal(checks.length, expected);
      const files = [original, selected, __filename, path.join(process.env.DOYA_TEST_BASELINE, 'src/lib/hr/department-input.ts'), path.join(process.env.DOYA_TEST_BASELINE, 'src/lib/hr/department-mutation.ts'), path.join(process.env.DOYA_TEST_BASELINE, 'src/app/api/hr/departments/route.ts'), path.join(process.env.DOYA_TEST_BASELINE, 'src/app/api/hr/departments/[id]/route.ts')];
      const selectedFiles = files.filter(p=>fs.existsSync(p));
      const report = { checkedAt: new Date().toISOString(), expected, passed: result.passed, cases: checks, sourceHashes: Object.fromEntries(selectedFiles.map(p => [p, crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')])), scope: 'Prepared mandatory fixture against combined input/concurrency overlay. Original assertions retained; actual input and mutation helper loaded with synthetic scoped Prisma/lock rows. Related33, member-access1, validation6 and cache3 are separate proofs. No actual DB/customer/provider writes; realDB47 is verified independently.' };
      fs.writeFileSync(path.join(__dirname, 'hr-department-input-legacy-' + mode + '.json'), JSON.stringify(report, null, 2) + '\n');
      console.log(JSON.stringify(report));
    },
    error(error) { clearTimeout(deadline); completed = true; console.error(error); process.exitCode = 1; },
  },
}, { filename: selected });
