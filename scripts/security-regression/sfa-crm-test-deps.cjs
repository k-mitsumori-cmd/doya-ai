// Legacy field/pagination fixtures use actual CRM handlers/helpers with synthetic
// authority and receipt storage. Concurrency/rollback need separate DB tests.
const crypto = require('node:crypto');
const { load } = require('./load-typescript.cjs');
function crmDeps(db, mocks, { quotaInsideCreate = false } = {}) {
  const authority = load('src/lib/sfa/mutation-authority.ts');
  const amount = load('src/lib/sfa/amount.ts');
  const deal = load('src/lib/sfa/deal-mutation.ts', { './amount': amount, './mutation-authority': authority });
  const receipt = load('src/lib/sfa/creation-receipt.ts', { 'node:crypto': crypto, './mutation-authority': authority });
  db.sfaMember ||= { findFirst: async ({ where }) => ({ id: where.id }) };
  db.$queryRaw ||= async (_strings, ...values) => [{ id: values[0] }];
  db.$executeRaw ||= async () => 1;
  const receipts = new Map();
  db.systemSetting ||= {
    findUnique: async ({ where }) => receipts.get(where.key) || null,
    create: async ({ data }) => { receipts.set(data.key, data); return data; },
  };
  const limits = { ...mocks['@/lib/sfa/limits'],
    canManageSfaBilling: mocks['@/lib/sfa/limits'].canManageSfaBilling || (async () => false),
    checkSfaQuota: mocks['@/lib/sfa/limits'].checkSfaQuota || (async () => null),
    withSfaAdmission: quotaInsideCreate ? async (_org, _requested, work) => ({ created: await work(db) }) : mocks['@/lib/sfa/limits'].withSfaAdmission,
  };
  const helper = load('src/lib/sfa/crm-record-mutation.ts', { './mutation-authority': authority, './deal-mutation': deal, './creation-receipt': receipt, './limits': limits });
  return { '@/lib/sfa/crm-record-http': load('src/lib/sfa/crm-record-http.ts', {
    'next/server': { NextResponse: Response }, '@/lib/prisma': { prisma: db }, './access': mocks['@/lib/sfa/access'],
    './format': mocks['@/lib/sfa/format'], './mutation-authority': authority, './limits': limits, './crm-record-mutation': helper,
  }) };
}
module.exports = { crmDeps };
