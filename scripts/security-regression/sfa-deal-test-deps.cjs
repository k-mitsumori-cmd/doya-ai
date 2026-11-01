// Legacy input/pagination fixtures supply synthetic rows; authority/concurrency is
// covered separately by actual shared-helper and isolated PostgreSQL verifiers.
const crypto = require('node:crypto');
const { load } = require('./load-typescript.cjs');
const { matches, exact } = require('./sfa-query-fixture.cjs');
function dealDeps(db = {}, { authority: suppliedAuthority } = {}) {
  const authority = suppliedAuthority || load('src/lib/sfa/mutation-authority.ts');
  const amount = load('src/lib/sfa/amount.ts');
  const policy = load('src/lib/sfa/record-policy.ts', { './mutation-authority': authority });
  const relations = load('src/lib/sfa/record-relations.ts', { './mutation-authority': authority, './record-policy': policy });
  const helper = load('src/lib/sfa/deal-mutation.ts', { './amount': amount, './mutation-authority': authority, './record-policy': policy });
  db.sfaMember ||= { findFirst: async ({ where }) => ({ id: where.id, role: 'member' }) };
  db.$transaction ||= async fn => fn(db);
  db.$queryRaw ||= async (strings, ...values) => {
    if (strings.join('').includes('sfa_stages')) {
      const stage = values.length > 1 ? await db.sfaStage?.findUnique?.({ where: { id: values[0] }, include: { pipeline: true } }) : await db.sfaStage?.findFirst?.({ include: { pipeline: true } });
      return stage ? [{ id: stage.id }] : [];
    }
    return [{ id: values[0] }];
  };
  if (db.sfaStage && !db.sfaStage.findUnique) db.sfaStage.findUnique = async () => db.sfaStage.findFirst();
  if (db.sfaDeal && !db.sfaDeal.findFirst && db.sfaDeal.findUnique) db.sfaDeal.findFirst = async ({ where }) => {
    const row = await db.sfaDeal.findUnique({ where: { id: exact(where, 'id') } });
    const value = row ? { isActive: true, updatedAt: new Date('2026-10-07T00:00:00.000Z'), ...row } : null;
    return value && matches(value, where) ? value : null;
  };
  const recordAuthority = load('src/lib/sfa/record-authority.ts', { '@/lib/prisma': { prisma: db }, '@/lib/company-roles/access.server': { ceilToolRole: async input => input.toolRole }, './mutation-authority': authority, './record-policy': policy });
  return { '@/lib/sfa/record-authority': recordAuthority, '@/lib/sfa/record-policy': policy, '@/lib/sfa/record-relations': relations, '@/lib/sfa/lead-conversion': load('src/lib/sfa/lead-conversion.ts', { './amount': amount, './deal-mutation': helper, './mutation-authority': authority, './record-policy': policy, './record-relations': relations }), '@/lib/sfa/deal-mutation': helper, '@/lib/sfa/mutation-authority': authority,
    '@/lib/sfa/creation-receipt': load('src/lib/sfa/creation-receipt.ts', { 'node:crypto': crypto, './mutation-authority': authority }) };
}
module.exports = { dealDeps };
