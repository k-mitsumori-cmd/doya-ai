const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { load } = require('../../../scripts/security-regression/load-typescript.cjs');
const file = 'src/app/api/sfa/deals/route.ts';
function fixture() {
  let actorActive = true;
  const writes = [];
  const tx = {
    sfaMember: { findFirst: async () => ({ userId: 'owner' }), count: async () => 1 },
    user: { findUnique: async () => ({ plan: 'FREE' }) },
    sfaAccount: { count: async () => 0 },
    sfaStage: { findFirst: async () => null },
    sfaDeal: {
      count: async () => writes.length,
      create: async ({ data }) => { const row = { id: 'deal-' + (writes.length + 1), ...data }; writes.push({ actorActive, row }); return row; },
    },
  };
  const prisma = { ...tx, $transaction: async fn => fn(tx) };
  const limits = load('src/lib/sfa/limits.ts', {
    'next/server': { NextResponse: Response }, '@/lib/prisma': { prisma },
    '@/lib/plan-utils': { tierFrom: () => 'FREE' },
  });
  const route = load(file, {
    'next/server': { NextResponse: Response }, '@/lib/prisma': { prisma },
    '@/lib/sfa/access': { getSfaContext: async () => { actorActive = false; return { organizationId: 'org', userId: 'actor', memberId: 'member' }; }, orgSlugFrom: () => 'alpha' },
    '@/lib/sfa/format': load('src/lib/sfa/format.ts'), '@/lib/sfa/amount': load('src/lib/sfa/amount.ts'),
    '@/lib/sfa/limits': limits, '@/lib/service-usage': { recordServiceUsage: async () => {} },
  });
  return { writes, post: body => route.POST({ json: async () => body }) };
}
(async () => {
  const results = [];
  { const f = fixture(); const r = await f.post({ name: 'Synthetic deal' }); assert.equal(r.status, 200); assert.equal(f.writes.length, 1); assert.equal(f.writes[0].actorActive, false); results.push({ name: 'Actual deal POST and admission helper create after context actor is revoked', status: r.status, writes: 1 }); }
  { const f = fixture(); const body = { name: 'Synthetic replay', operationId: 'bb63d201-3225-42cc-912e-6b14793aec94' }; const rs = await Promise.all([f.post(body), f.post(body)]); assert.ok(rs.every(r => r.status === 200)); assert.equal(f.writes.length, 2); results.push({ name: 'Deal POST ignores same operationId and commits two creations', statuses: rs.map(r => r.status), writes: 2 }); }
  const report = { checkedAt: new Date().toISOString(), findings: results.length, results, sourceHash: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), scope: 'Actual POST handler, actual amount parser and actual Serializable admission wrapper, synthetic Prisma transaction/auth/usage. Proves missing fresh actor validation and unused operationId; does not prove real PostgreSQL scheduling, provider behavior or production impact. No customer writes or network.' };
  fs.writeFileSync('docs/audits/2026-10-06-all-services-recheck/sfa-deal-create-api-baseline.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ confirmedFindings: results.length }));
})().catch(e => { console.error(e); process.exitCode = 1; });
