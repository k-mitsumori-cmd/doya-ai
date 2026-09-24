const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('src/app/api/sfa/leads/[id]/route.ts', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function fixture(overrides = {}) {
  let lead = { id: 'lead', organizationId: 'org', isActive: true, status: 'new', convertedAccountId: null, score: null, note: null, ...overrides };
  let writes = 0;
  let beforeWrite = null;
  const prisma = { sfaLead: {
    findUnique: async () => lead && structuredClone(lead),
    findUniqueOrThrow: async () => structuredClone(lead),
    updateMany: async ({ where, data }) => {
      if (beforeWrite) beforeWrite();
      if (!lead.isActive || lead.organizationId !== where.organizationId ||
          (where.status && lead.status === 'converted') ||
          ('convertedAccountId' in where && lead.convertedAccountId !== null)) return { count: 0 };
      Object.assign(lead, data);
      writes++;
      return { count: 1 };
    },
    update: async ({ data }) => { Object.assign(lead, data); writes++; return lead; },
  } };
  const exported = {};
  const deps = {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/sfa/access': { getSfaContext: async () => ({ organizationId: 'org' }), orgSlugFrom: () => 'org' },
    '@/lib/sfa/format': { bigIntToNumber: (value) => value },
  };
  vm.runInNewContext(code, { exports: exported, require: (name) => { assert(name in deps, name); return deps[name]; } });
  const ctx = { params: Promise.resolve({ id: 'lead' }) };
  return {
    get lead() { return lead; },
    get writes() { return writes; },
    set beforeWrite(callback) { beforeWrite = callback; },
    patch: (body) => exported.PATCH({ json: async () => body }, ctx),
    del: () => exported.DELETE({}, ctx),
  };
}

(async () => {
  for (const body of [{}, [], null, { status: 'bogus' }, { status: 'converted' }, { score: 101 }, { score: -1 }, { score: '' }, { score: 'NaN' }, { note: 17 }, { convertedAccountId: 'other' }]) {
    const f = fixture();
    const response = await f.patch(body);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal(f.writes, 0);
  }

  const valid = fixture();
  assert.equal((await valid.patch({ status: 'qualified', score: '79.6', note: '確認済み' })).status, 200);
  assert.equal(valid.lead.status, 'qualified');
  assert.equal(valid.lead.score, 80);
  assert.equal(valid.lead.note, '確認済み');
  assert.equal((await valid.patch({ score: null })).status, 200);
  assert.equal(valid.lead.score, null);

  for (const overrides of [{ status: 'converted', convertedAccountId: 'account' }, { status: 'working', convertedAccountId: 'account' }]) {
    const f = fixture(overrides);
    assert.equal((await f.patch({ status: 'new' })).status, 409);
    assert.equal(f.writes, 0);
  }

  const race = fixture();
  race.beforeWrite = () => { race.lead.status = 'converted'; race.lead.convertedAccountId = 'account'; };
  assert.equal((await race.patch({ status: 'qualified' })).status, 409);
  assert.equal(race.lead.status, 'converted');
  assert.equal(race.writes, 0);

  for (const overrides of [{ isActive: false }, { organizationId: 'foreign' }]) {
    const f = fixture(overrides);
    assert.equal((await f.patch({ status: 'working' })).status, 404);
    assert.equal((await f.del()).status, 404);
    assert.equal(f.writes, 0);
  }
  console.log('PASS SFA lead update: validation, conversion invariant, race, and ownership');
})().catch((error) => { console.error(error); process.exitCode = 1; });
