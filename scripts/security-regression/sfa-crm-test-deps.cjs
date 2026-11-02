// Legacy field/pagination fixtures use actual CRM handlers/helpers with synthetic
// authority and receipt storage. Concurrency/rollback need separate DB tests.
const crypto = require('node:crypto');
const { load } = require('./load-typescript.cjs');
function crmDeps(db, mocks, { quotaInsideCreate = false } = {}) {
  const authority = mocks['@/lib/sfa/mutation-authority'] || load('src/lib/sfa/mutation-authority.ts');
  const amount = load('src/lib/sfa/amount.ts');
  const policy = load('src/lib/sfa/record-policy.ts', { './mutation-authority': authority });
  const relations = load('src/lib/sfa/record-relations.ts', { './mutation-authority': authority, './record-policy': policy });
  const deal = load('src/lib/sfa/deal-mutation.ts', { './amount': amount, './mutation-authority': authority, './record-policy': policy });
  const receipt = load('src/lib/sfa/creation-receipt.ts', { 'node:crypto': crypto, './mutation-authority': authority });
  db.sfaMember ||= { findFirst: async ({ where }) => ({ id: where.id, role: 'member' }) };
  db.$transaction ||= async work => work(db);
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
  const recordAuthority = load('src/lib/sfa/record-authority.ts', { '@/lib/prisma': { prisma: db }, '@/lib/company-roles/access.server': { ceilToolRole: async input => input.toolRole }, './mutation-authority': authority, './record-policy': policy });
  const helper = load('src/lib/sfa/crm-record-mutation.ts', { './mutation-authority': authority, './record-policy': policy, './record-authority': recordAuthority, './deal-mutation': deal, './creation-receipt': receipt, './limits': limits });
  return { '@/lib/sfa/mutation-authority': authority, '@/lib/sfa/record-authority': recordAuthority, '@/lib/sfa/record-policy': policy, '@/lib/sfa/record-relations': relations, '@/lib/sfa/crm-record-http': load('src/lib/sfa/crm-record-http.ts', {
    'next/server': { NextResponse: Response }, '@/lib/prisma': { prisma: db }, './access': mocks['@/lib/sfa/access'],
    './format': mocks['@/lib/sfa/format'], './mutation-authority': authority, './record-authority': recordAuthority, './limits': limits, './crm-record-mutation': helper,
  }) };
}
module.exports = { crmDeps };
