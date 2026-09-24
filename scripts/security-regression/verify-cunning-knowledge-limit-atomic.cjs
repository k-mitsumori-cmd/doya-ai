const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

let bases = [];
let transactionCount = 0;
let lockTail = Promise.resolve();
const tx = {
  $queryRaw: async () => [{ id: 'user' }],
  cunningKnowledgeBase: {
    count: async () => bases.length,
    create: async ({ data }) => {
      const base = { id: `base-${bases.length + 1}`, ...data };
      bases.push(base);
      return base;
    },
  },
};
const prisma = {
  cunningKnowledgeBase: tx.cunningKnowledgeBase,
  $transaction: async (operation) => {
    transactionCount++;
    const previous = lockTail;
    let unlock;
    lockTail = new Promise((resolve) => { unlock = resolve; });
    await previous;
    try { return await operation(tx); }
    finally { unlock(); }
  },
};
const route = load('src/app/api/cunning/knowledge/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma },
  '@/lib/cunning/access': { getUserId: async () => 'user' },
  '@/lib/cunning/limits': { getCunningLimits: async () => ({ maxKnowledgeBases: 1 }) },
});
const post = (body) => route.POST({ json: async () => body });

(async () => {
  assert.equal((await post({ name: {} })).status, 400);
  assert.equal(transactionCount, 0, 'invalid input must not acquire a DB lock');
  const responses = await Promise.all([post({ name: 'First' }), post({ name: 'Second' })]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 403]);
  assert.equal(transactionCount, 2);
  assert.equal(bases.length, 1, 'free users must not create two bases concurrently');
  assert.equal((await post({ name: 'Third' })).status, 403);
  assert.equal(bases.length, 1);
  console.log('PASS Cunning knowledge: concurrent creation respects the free-plan limit');
})().catch((error) => { console.error(error); process.exitCode = 1; });
