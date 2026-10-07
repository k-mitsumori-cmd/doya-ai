const assert = require('node:assert/strict'), fs = require('node:fs'), crypto = require('node:crypto');
const { load } = require('../../../scripts/security-regression/load-typescript.cjs');
const source = 'src/app/api/sfa/ai/score/route.ts';
function fixture(mode) {
  const lead = { id: 'lead', organizationId: 'org', isActive: true, updatedAt: new Date('2026-10-01T00:00:00.000Z'), name: 'Synthetic lead', raw: {}, status: 'new', note: 'Original', source: 'manual', score: null };
  let active = true, calls = 0; const writes = [], settled = [];
  const tx = { sfaLead: { updateMany: async args => { writes.push({ active, ...args }); Object.assign(lead, args.data); return { count: 1 }; } } };
  const prisma = { sfaLead: { findUnique: async () => ({ ...lead }) }, $transaction: async fn => fn(tx) };
  const route = load(source, {
    'next/server': { NextResponse: Response }, '@/lib/prisma': { prisma },
    '@/lib/sfa/access': { orgSlugFrom: () => 'alpha', getSfaContext: async () => { if (mode === 'revoked') active = false; return { userId: 'actor', memberId: 'member', organizationId: 'org' }; } },
    '@/lib/sfa/ai': { scoreLead: async () => { calls++; if (mode === 'changed') { lead.note = 'Newer note'; lead.updatedAt = new Date('2026-10-02T00:00:00.000Z'); } return { score: 80, reason: 'Synthetic', nextAction: 'Synthetic' }; } },
    '@/lib/sfa/ai-limit': { reserveSfaAiUsage: async () => ({ id: 'reservation-' + calls }), completeSfaAiUsage: async id => settled.push(id), releaseSfaAiUsage: async () => {}, sfaAiLimitResponse: () => { throw Error('unexpected quota'); } },
    '@/lib/sfa/limits': { canManageSfaBilling: async () => false },
  });
  return { run: () => route.POST({ json: async () => ({ leadId: 'lead' }) }), lead, writes, settled, calls: () => calls };
}
(async () => {
  const findings = [];
  { const f = fixture('changed'); const r = await f.run(); assert.equal(r.status, 200); assert.equal(f.lead.note, 'Newer note'); assert.equal(f.lead.score, 80); assert.equal(f.writes[0].where.updatedAt, undefined); findings.push('An AI result based on the old note commits after a synthetic intervening note/version edit. Actual handler has no expectedUpdatedAt match at settlement.'); }
  { const f = fixture('revoked'); const r = await f.run(); assert.equal(r.status, 200); assert.equal(f.calls(), 1); assert.equal(f.writes[0].active, false); findings.push('Actual score handler lacks fresh mutation-actor validation before provider call or settlement; synthetic context-revocation scenario still calls the mocked provider and commits. Reservation authority requires separate actual-helper investigation.'); }
  { const f = fixture('normal'); const responses = await Promise.all([f.run(), f.run()]); assert.ok(responses.every(r => r.status === 200)); assert.equal(f.calls(), 2); findings.push('Repeated identical score requests both call the mocked provider and settle. No request operation identity/recovery protocol in this handler; actual reservation and PostgreSQL races remain unproven.'); }
  fs.writeFileSync('docs/audits/2026-10-06-all-services-recheck/sfa-score-lifecycle-baseline.json', JSON.stringify({ checkedAt: new Date().toISOString(), status: 'confirmed-handler-gaps-not-repaired', findings: findings.length, results: findings, sourceHash: crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'), scope: 'Actual score handler; synthetic context, Prisma, reservation and provider. No external provider/network, customer data or actual PostgreSQL schedule.' }, null, 2) + '\n');
  console.log(JSON.stringify({ confirmedHandlerGaps: findings.length }));
})().catch(e => { console.error(e); process.exitCode = 1; });
