const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('src/app/api/sfa/ai/score/route.ts', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

async function run(body, lead) {
  let aiCalls = 0;
  let writes = 0;
  const prisma = { sfaLead: {
    findUnique: async () => lead,
    update: async () => { writes++; return lead; },
  } };
  const deps = {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/sfa/access': { getSfaContext: async () => ({ organizationId: 'org' }), orgSlugFrom: () => 'org' },
    '@/lib/sfa/ai': { scoreLead: async () => { aiCalls++; return { score: 70 }; } },
  };
  const exported = {};
  vm.runInNewContext(code, { exports: exported, require: (name) => { assert(name in deps, name); return deps[name]; } });
  const response = await exported.POST({ json: async () => body });
  return { status: response.status, aiCalls, writes };
}

(async () => {
  const active = { id: 'lead', organizationId: 'org', isActive: true, name: 'Company', raw: null, status: 'new', note: null, source: 'manual' };
  for (const body of [null, [], {}, { leadId: 1 }, { leadId: {} }, { leadId: '  ' }]) {
    assert.deepEqual(await run(body, active), { status: 400, aiCalls: 0, writes: 0 });
  }
  for (const lead of [null, { ...active, isActive: false }, { ...active, organizationId: 'foreign' }]) {
    assert.deepEqual(await run({ leadId: 'lead' }, lead), { status: 404, aiCalls: 0, writes: 0 });
  }
  assert.deepEqual(await run({ leadId: 'lead' }, active), { status: 200, aiCalls: 1, writes: 1 });
  console.log('PASS SFA AI score: malformed, deleted and foreign leads do not invoke AI');
})().catch((error) => { console.error(error); process.exitCode = 1; });
