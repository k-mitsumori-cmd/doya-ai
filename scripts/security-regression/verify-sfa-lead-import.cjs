const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('src/app/api/sfa/leads/import/route.ts', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

async function call(body) {
  let created = null;
  const prisma = { sfaLead: { createMany: async ({ data }) => { created = data; return { count: data.length }; } } };
  const deps = {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/sfa/access': { getSfaContext: async () => ({ organizationId: 'org', memberId: 'member' }), orgSlugFrom: () => 'org' },
  };
  const exported = {};
  vm.runInNewContext(code, { exports: exported, require: (name) => { assert(name in deps, name); return deps[name]; } });
  const response = await exported.POST({ json: async () => body });
  return { status: response.status, result: await response.json(), created };
}

(async () => {
  for (const body of [null, [], { rows: null }, { rows: [] }, { rows: [null, 1, [], { name: {} }] }]) {
    const result = await call(body);
    assert.equal(result.status, 400);
    assert.equal(result.created, null);
  }
  const oversized = await call({ rows: Array.from({ length: 501 }, () => ({ name: 'Company' })) });
  assert.equal(oversized.status, 413);
  assert.equal(oversized.created, null);

  const mixed = await call({ source: 'csv', rows: [null, 1, [], { name: {} }, { name: '  Company  ', contactName: ' Person ', email: {} }] });
  assert.equal(mixed.status, 200);
  assert.equal(mixed.result.imported, 1);
  assert.equal(mixed.result.skipped, 4);
  assert.equal(mixed.created.length, 1);
  assert.equal(mixed.created[0].organizationId, 'org');
  assert.equal(mixed.created[0].name, 'Company');
  assert.equal(mixed.created[0].contactName, 'Person');
  assert.equal(mixed.created[0].email, null);
  assert.equal(mixed.created[0].status, 'new');
  console.log('PASS SFA lead import: malformed payloads, invalid rows, and row limit');
})().catch((error) => { console.error(error); process.exitCode = 1; });
