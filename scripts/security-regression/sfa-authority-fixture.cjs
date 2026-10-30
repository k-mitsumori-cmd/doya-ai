// Connect legacy field/pagination fixtures to the real authority and record predicates.
// Fixture records must explicitly declare their organization/owner; no role escalation
// or invented ownership is used. Real PostgreSQL/MVCC verification is separate.
const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
const { matches, exact } = require('./sfa-query-fixture.cjs');
const authority = load('src/lib/sfa/mutation-authority.ts');
const policy = load('src/lib/sfa/record-policy.ts', { './mutation-authority': authority });
const relations = load('src/lib/sfa/record-relations.ts', { './mutation-authority': authority, './record-policy': policy });
const receipts = load('src/lib/sfa/creation-receipt.ts', { 'node:crypto': require('node:crypto'), './mutation-authority': authority });
function idsIn(where) {
  if (typeof where.id === 'string') return [where.id];
  if (Array.isArray(where.id?.in)) return where.id.in;
  return (Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []).flatMap(idsIn);
}
const select = (row, fields) => !fields ? row : Object.fromEntries(Object.keys(fields).filter(key => fields[key]).map(key => [key, row[key]]));
function withSfaAuthority(deps) {
  const prisma = deps['@/lib/prisma'].prisma, access = deps['@/lib/sfa/access'];
  let ctx;
  const enhance = tx => {
    const result = { ...prisma, ...tx, $queryRaw: tx.$queryRaw || (async (_strings, ...values) => [{ id: values[0] }]) };
    result.sfaMember = tx.sfaMember || { findFirst: async ({ where }) => {
      assert.equal(where.id, ctx.memberId); assert.equal(where.userId, ctx.userId);
      assert.equal(where.organizationId, ctx.organizationId); assert.equal(where.status, 'ACTIVE');
      assert.ok(where.role.in.includes('member')); return { id: ctx.memberId, role: 'member' };
    } };
    for (const name of ['sfaDeal', 'sfaAccount', 'sfaContact', 'sfaLead', 'sfaTask', 'sfaActivity']) {
      if (!tx[name] && !prisma[name]) continue;
      const original = { ...prisma[name], ...tx[name] };
      const read = async args => {
        const where = args.where;
        // Exact aliases support old direct-field assertions while retaining the full AND.
        const aliased = { ...where };
        for (const key of ['id', 'organizationId', 'isActive']) { const value = exact(where, key); if (value !== undefined) aliased[key] = value; }
        const row = original.findUnique ? await original.findUnique({ where: { id: exact(where, 'id') } })
          : original.findFirst ? await original.findFirst({ ...args, select: undefined, where: aliased }) : null;
        return row && matches(row, where) ? select(row, args.select) : null;
      };
      result[name] = { ...original, findFirst: read };
      if (!original.findMany) result[name].findMany = async args => {
        const ids = [...new Set(idsIn(args.where))];
        const rows = await Promise.all(ids.map(id => read({ ...args, where: { AND: [args.where, { id }] } })));
        return rows.filter(Boolean);
      };
    }
    return result;
  };
  const db = { ...prisma, $transaction: async callback => prisma.$transaction
    ? prisma.$transaction(tx => callback(enhance(tx))) : callback(enhance(prisma)) };
  const recordAuthority = load('src/lib/sfa/record-authority.ts', { '@/lib/prisma': { prisma: db }, '@/lib/company-roles/access.server': { ceilToolRole: async input => input.toolRole }, './mutation-authority': authority, './record-policy': policy });
  return { ...deps,
    '@/lib/sfa/mutation-authority': authority,
    '@/lib/sfa/record-authority': recordAuthority,
    '@/lib/sfa/record-policy': policy,
    '@/lib/sfa/record-relations': relations,
    '@/lib/sfa/creation-receipt': receipts,
    '@/lib/sfa/access': { ...access, getSfaContext: async (...args) => {
      const result = await access.getSfaContext(...args);
      ctx = result ? { userId: 'synthetic-user', memberId: 'synthetic-member', role: 'member', organizationSlug: 'synthetic-org', ...result } : null;
      return ctx;
    } },
    '@/lib/prisma': { prisma: db },
  };
}
module.exports = { withSfaAuthority };
