const crypto = require('node:crypto');
const { load } = require('./load-typescript.cjs');
// Receipt persistence only. Business behavior remains supplied by each regression;
// real rollback, unique-slug races and authority are covered by private PostgreSQL probes.
function workspaceApi({ prisma, limits = {}, actor = 'u', settings = [] }) {
  const receipts = new Map(settings);
  const db = { $transaction: async (work, options) => {
    const before = new Map(receipts);
    try { return await prisma.$transaction(tx => work({ ...tx,
      $executeRaw: async () => 0,
      systemSetting: {
        findUnique: async ({ where }) => receipts.has(where.key) ? { value: receipts.get(where.key) } : null,
        create: async ({ data }) => { receipts.set(data.key, data.value); return data; },
      },
    }), options); }
    catch (error) { receipts.clear(); for (const [key,value] of before) receipts.set(key,value); throw error; }
  } };
  const operation = load('src/lib/promane/workspace-operation.ts', { 'node:crypto': crypto });
  const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': crypto });
  const store = load('src/lib/account-lifecycle/store.ts', { 'node:crypto': crypto, '@prisma/client': { Prisma: require('@prisma/client').Prisma }, './state': state });
  const input = load('src/lib/promane/workspace-input.ts');
  const mutations = load('src/lib/promane/workspace-mutations.ts', {
    'node:crypto': crypto, '@/lib/prisma': { prisma: db }, '@/lib/promane/limits': limits,
    './workspace-input': input, './workspace-operation': operation,
    '@/lib/account-lifecycle/store': store,
  });
  const response = load('src/lib/promane/workspace-response.ts', {
    'next/server': { NextResponse: Response }, './workspace-mutations': mutations, './workspace-operation': operation,
    '@/lib/account-lifecycle/state': state,
  });
  const deps = { 'next/server': { NextResponse: Response }, 'next-auth': { getServerSession: async () => ({ user: { id: actor } }) },
    '@/lib/auth': {}, '@/lib/promane/workspace-mutations': mutations, '@/lib/promane/workspace-response': response,
    '@/lib/service-usage': { recordServiceUsage: async () => {} },
  };
  return { create: load('src/app/api/promane/workspaces/create/route.ts', deps),
    settings: load('src/app/api/promane/workspaces/[id]/route.ts', deps),
    recover: load('src/app/api/promane/workspaces/recover/route.ts', deps),
    receiptSnapshot: () => new Map(receipts),
    intent: () => ({ operationId: crypto.randomUUID(), expectedUserId: actor }),
  };
}
module.exports = { workspaceApi };
