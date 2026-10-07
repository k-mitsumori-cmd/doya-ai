const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
async function probe(error, failCount) {
  let attempts = 0, creates = 0;
  const tx = { sfaMember: { findFirst: async () => ({ userId: 'owner' }) }, user: { findUnique: async () => ({ plan: 'FREE' }) } };
  const prisma = { $transaction: async (fn, options) => { attempts++; assert.equal(options.isolationLevel, 'Serializable'); if (attempts <= failCount) throw error; return fn(tx); } };
  const limits = load('src/lib/sfa/limits.ts', { '@/lib/prisma': { prisma }, 'next/server': { NextResponse: Response }, '@/lib/plan-utils': { tierFrom: () => 'FREE' } });
  let failure;
  try { const result = await limits.withSfaAdmission('org', {}, async () => { creates++; return 'created'; }); assert.equal(result.created, 'created'); } catch (e) { failure = e; }
  return { attempts, creates, failure };
}
(async () => {
  for (const [code, state] of [['P2034'], ['P2010', '40001'], ['P2010', '40P01'], ['SFA_RECEIPT_RACE']]) {
    const error = Object.assign(Error('synthetic transaction conflict'), { code, meta: { code: state } });
    const retry = await probe(error, 1); assert.equal(retry.attempts, 2); assert.equal(retry.creates, 1); assert.equal(retry.failure, undefined);
    const exhausted = await probe(error, 100); assert.equal(exhausted.attempts, 5); assert.equal(exhausted.creates, 0); assert.equal(exhausted.failure, error);
  }
  for (const error of [Object.assign(Error('unrelated unique'), { code: 'P2002', meta: { target: ['id'] } }), Object.assign(Error('invalid SQL'), { code: 'P2010', meta: { code: '42P01' } }), Error('other failure')]) {
    const result = await probe(error, 100); assert.equal(result.attempts, 1); assert.equal(result.creates, 0); assert.equal(result.failure, error);
  }
  console.log('PASS SFA admission: 4 known transaction conflicts retry only whole transactions, stop at 5 attempts; unrelated failures never retry');
})().catch(e => { console.error(e); process.exitCode = 1; });
