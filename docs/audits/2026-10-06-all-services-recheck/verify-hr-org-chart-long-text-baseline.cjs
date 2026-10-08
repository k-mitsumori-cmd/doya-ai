const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { load } = require('../../../scripts/security-regression/load-typescript.cjs');
const file = 'src/lib/hr/org-chart-paged-client.ts';
(async () => {
  const cases = [];
  for (const field of ['departmentName', 'employeeName', 'photoUrl']) {
    const department = { id: 'synthetic-dept', name: 'Synthetic', code: null, managerId: null, parentId: null, sortOrder: 0 };
    const employee = { id: 'synthetic-employee', firstName: 'Synthetic', lastName: 'Employee', employeeNumber: null, position: null, photoUrl: null, departmentId: department.id };
    if (field === 'departmentName') department.name = '長'.repeat(1200);
    if (field === 'employeeName') employee.lastName = '長'.repeat(1200);
    if (field === 'photoUrl') employee.photoUrl = 'https://assets.example.invalid/' + 'x'.repeat(9000);
    const page = { success: true, format: 'hr-org-chart-page-v1', orgName: 'Synthetic', revision: 'a'.repeat(64), departments: [department], employees: [employee], totals: { departments: 1, employees: 1 }, nextCursor: null };
    const raw = JSON.stringify(page); assert.ok(Buffer.byteLength(raw) < 1024 * 1024);
    const client = load(file, {}, { AbortController, TextDecoder, Uint8Array, setTimeout, clearTimeout, fetch: async () => new Response(raw) });
    await assert.rejects(client.readHrOrgChart(new AbortController().signal), /page invalid/);
    cases.push({ field, pageBytes: Buffer.byteLength(raw), schemaStringFieldHasNoDeclaredLengthLimit: true, observedClientRejects: true });
  }
  const report = { checkedAt: new Date().toISOString(), defectsReproduced: cases.length, cases, sourceHashes: Object.fromEntries([file, 'prisma/schema.prisma', __filename].map(p => [p, crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')])), scope: 'Actual current root paged client rejects otherwise well-formed bounded pages because department/employee strings exceed1024 or photo URL exceeds8192. Prisma String fields and current department mutation paths impose no matching length constraint. Synthetic transport only, not an actual customer or DB occurrence. This is a defect baseline and blocks release until corrected and reverified.' };
  fs.writeFileSync(__dirname + '/hr-org-chart-long-text-baseline.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
})().catch(error => { console.error(error); process.exitCode = 1; });
