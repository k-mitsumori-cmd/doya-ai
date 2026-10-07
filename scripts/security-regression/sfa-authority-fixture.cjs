// Adapt legacy route fixtures to the transaction boundary while retaining their
// existing write/relation counters. Security race tests use independent stateful
// fixtures, not this default active-member scaffold.
const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
const authority = load('src/lib/sfa/mutation-authority.ts');
function withSfaAuthority(deps) {
  const prisma = deps['@/lib/prisma'].prisma, access = deps['@/lib/sfa/access'];
  let ctx;
  const enhance = tx => {
    const result = { ...prisma, ...tx, $queryRaw: tx.$queryRaw || (async (_strings, ...values) => [{ id: values[0] }]) };
    result.sfaMember = tx.sfaMember || { findFirst: async ({ where }) => {
      assert.equal(where.id, ctx.memberId); assert.equal(where.userId, ctx.userId);
      assert.equal(where.organizationId, ctx.organizationId); assert.equal(where.status, 'ACTIVE');
      assert.ok(where.role.in.includes('member')); return { id: ctx.memberId };
    } };
    for (const name of ['sfaDeal', 'sfaAccount', 'sfaContact']) {
      if (!tx[name] && !prisma[name]) continue;
      const original = { ...prisma[name], ...tx[name] };
      result[name] = { ...original, findFirst: original.findFirst || (async ({ where }) => {
        const row = await original.findUnique({ where: { id: where.id } });
        return row && row.organizationId === where.organizationId && row.isActive ? { id: where.id } : null;
      }) };
    }
    return result;
  };
  return { ...deps,
    '@/lib/sfa/mutation-authority': authority,
    '@/lib/sfa/access': { ...access, getSfaContext: async (...args) => {
      const result = await access.getSfaContext(...args);
      ctx = result ? { userId: 'synthetic-user', memberId: 'synthetic-member', role: 'member', ...result } : null;
      return ctx;
    } },
    '@/lib/prisma': { prisma: { ...prisma, $transaction: async callback => prisma.$transaction
      ? prisma.$transaction(tx => callback(enhance(tx))) : callback(enhance(prisma)) } },
  };
}
module.exports = { withSfaAuthority };
