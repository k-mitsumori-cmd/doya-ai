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
    completeSfaAiUsage: async (id) => { assert.equal(id, 'reservation'); state.completed++; },
    releaseSfaAiUsage: async (id) => { assert.equal(id, 'reservation'); state.released++; },
    sfaAiLimitResponse: () => Response.json({ code: 'SFA_AI_LIMIT_REACHED' }, { status: 402 }),
  };
  const prisma = action === 'score' ? { sfaLead: {
    findUnique: async () => ({ id: 'item', organizationId: 'org', isActive: active, name: 'Lead', raw: null }),
    updateMany: async () => { state.writes++; return { count: 1 }; },
  } } : {
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
    assert.deepEqual(await invoke(action, 'ok'), { status: 200, reserved: 1, completed: 1, released: 0, provider: 1, writes: action === 'score' ? 1 : 0 });
  }
  console.log('PASS SFA AI routes: inactive target, quota, DB failure, provider failure, success');
})().catch((error) => { console.error(error); process.exitCode = 1; });
