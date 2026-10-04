const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

async function invoke(action, mode, active = true) {
  const state = { reserved: 0, completed: 0, released: 0, provider: 0, writes: 0 };
  const quota = {
    reserveSfaAiUsage: async (org, user, kind) => {
      assert.equal(org, 'org'); assert.equal(user, 'member'); assert.equal(kind, action);
      state.reserved++;
      if (mode === 'db-error') throw new Error('database unavailable');
      return mode === 'limit' ? { limit: 20, used: 20 } : { id: 'reservation' };
    },
    completeSfaAiUsage: async (id, tx) => {
      assert.equal(id, 'reservation');
      if (action === 'score') assert.ok(tx && tx.sfaLead, 'score settlement shares the lead transaction');
      if (mode === 'settlement-error') throw new Error('settlement unavailable');
      state.completed++;
    },
    releaseSfaAiUsage: async (id) => { assert.equal(id, 'reservation'); state.released++; },
    sfaAiLimitResponse: (_, canManageBilling) => {
      assert.equal(canManageBilling, false);
      return Response.json({ code: 'SFA_AI_LIMIT_REACHED' }, { status: 402 });
    },
  };
  const prisma = action === 'score' ? {
    sfaLead: { findUnique: async () => ({ id: 'item', organizationId: 'org', isActive: active, name: 'Lead', raw: null }) },
    $transaction: async fn => {
      let pendingWrites = 0;
      const result = await fn({ sfaLead: { updateMany: async () => { pendingWrites++; return { count: mode === 'lead-changed' ? 0 : 1 }; } } });
      state.writes += mode === 'lead-changed' ? 0 : pendingWrites;
      return result;
    },
  } : {
    sfaDeal: { findUnique: async () => ({ id: 'item', organizationId: 'org', isActive: active, name: 'Deal', amount: 100, probability: 50 }) },
    sfaActivity: { findMany: async () => [] },
  };
  const deps = {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/sfa/access': { getSfaContext: async () => ({ organizationId: 'org', userId: 'member', role: 'member' }), orgSlugFrom: () => 'org' },
    '@/lib/sfa/ai': {
      scoreLead: async () => { state.provider++; if (mode === 'provider-error') throw new Error('provider'); return { score: 72 }; },
      suggestNextAction: async () => { state.provider++; if (mode === 'provider-error') throw new Error('provider'); return { action: 'Follow up' }; },
    },
    '@/lib/sfa/ai-limit': quota,
    '@/lib/sfa/limits': { canManageSfaBilling: async (_, org, user) => { assert.equal(org, 'org'); assert.equal(user, 'member'); return false; } },
    '@/lib/sfa/constants': { ACTIVITY_TYPE_LABEL: {} },
  };
  const route = load(`src/app/api/sfa/ai/${action === 'score' ? 'score' : 'next-action'}/route.ts`, deps);
  const response = await route.POST({ json: async () => action === 'score' ? { leadId: 'item' } : { dealId: 'item' } });
  return { status: response.status, ...state };
}

(async () => {
  for (const action of ['score', 'next-action']) {
    assert.deepEqual(await invoke(action, 'ok', false), { status: 404, reserved: 0, completed: 0, released: 0, provider: 0, writes: 0 });
    assert.deepEqual(await invoke(action, 'limit'), { status: 402, reserved: 1, completed: 0, released: 0, provider: 0, writes: 0 });
    assert.deepEqual(await invoke(action, 'db-error'), { status: 503, reserved: 1, completed: 0, released: 0, provider: 0, writes: 0 });
    assert.deepEqual(await invoke(action, 'provider-error'), { status: 500, reserved: 1, completed: 0, released: 1, provider: 1, writes: 0 });
    if (action === 'score') {
      assert.deepEqual(await invoke(action, 'settlement-error'), { status: 500, reserved: 1, completed: 0, released: 1, provider: 1, writes: 0 });
      assert.deepEqual(await invoke(action, 'lead-changed'), { status: 409, reserved: 1, completed: 0, released: 1, provider: 1, writes: 0 });
    }
    assert.deepEqual(await invoke(action, 'ok'), { status: 200, reserved: 1, completed: 1, released: 0, provider: 1, writes: action === 'score' ? 1 : 0 });
  }
  console.log('PASS SFA AI routes: inactive target, quota, DB failure, provider failure, success');
})().catch((error) => { console.error(error); process.exitCode = 1; });
