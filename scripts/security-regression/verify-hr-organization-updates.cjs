const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

function fixture(routePath, method, role = 'ADMIN', failSave = false) {
  const writes = [];
  const prisma = { hrOrganization: {
    update: async ({ where, data }) => {
      if (failSave) throw Error('PRIVATE_DATABASE_DETAIL');
      assert.equal(where.id, 'org');
      writes.push(data);
      return { id: 'org', ...data };
    },
  } };
  const access = {
    getHrContext: async () => role === 'anonymous' ? null : { organizationId: 'org', role },
    hasMinRole: (actual) => actual === 'ADMIN' || actual === 'OWNER',
  };
  const api = load(routePath, {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => null },
    '@prisma/client': { Prisma: { DbNull: 'DB_NULL' } },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma },
    '@/lib/hr/access': access,
    '@/lib/hr/types': { HrMemberRole: { ADMIN: 'ADMIN' } },
  });
  return { request: (body) => api[method]({ json: async () => body }), writes };
}

(async () => {
  const settingsPath = 'src/app/api/hr/settings/route.ts';
  const settings = fixture(settingsPath, 'PUT');
  for (const body of [null, [], {}, { name: {} }, { name: ' ' }, { fiscalYearStart: '13abc' }, { fiscalYearStart: '00' }, { fiscalYearStart: '13' }, { industry: {} }, { employeeScale: [] }]) {
    assert.equal((await settings.request(body)).status, 400, JSON.stringify(body));
    assert.equal(settings.writes.length, 0);
  }
  assert.equal((await settings.request({ name: ' Acme ', industry: '', employeeScale: '1-10', fiscalYearStart: '04' })).status, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(settings.writes[0])), { name: 'Acme', industry: null, size: '1-10', fiscalMonth: 4 });
  assert.equal((await fixture(settingsPath, 'PUT', 'MEMBER').request({ name: 'Acme' })).status, 403);
  assert.equal((await fixture(settingsPath, 'PUT', 'anonymous').request({ name: 'Acme' })).status, 401);
  const settingsError = await fixture(settingsPath, 'PUT', 'ADMIN', true).request({ name: 'Acme' });
  assert.equal(settingsError.status, 500);
  assert.ok(!(await settingsError.text()).includes('PRIVATE_DATABASE_DETAIL'));

  const organizationPath = 'src/app/api/hr/organization/route.ts';
  const organization = fixture(organizationPath, 'PATCH');
  for (const body of [null, [], {}, { name: {} }, { name: ' ' }, { fiscalMonth: 0 }, { fiscalMonth: 13 }, { fiscalMonth: '4' }, { size: {} }, { website: 'javascript:alert(1)' }, { evaluationCycle: 'EVERY_DAY' }, { customFields: 'wrong' }]) {
    assert.equal((await organization.request(body)).status, 400, JSON.stringify(body));
    assert.equal(organization.writes.length, 0);
  }
  assert.equal((await organization.request({ name: ' Acme ', fiscalMonth: 4, customFields: null, website: ' https://example.com ' })).status, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(organization.writes[0])), { name: 'Acme', fiscalMonth: 4, website: 'https://example.com', customFields: 'DB_NULL' });
  assert.equal((await fixture(organizationPath, 'PATCH', 'MEMBER').request({ name: 'Acme' })).status, 403);
  const organizationError = await fixture(organizationPath, 'PATCH', 'ADMIN', true).request({ name: 'Acme' });
  assert.equal(organizationError.status, 500);
  assert.ok(!(await organizationError.text()).includes('PRIVATE_DATABASE_DETAIL'));
  console.log('PASS HR organization updates: input validation, fiscal month bounds, permissions and safe errors');
})().catch((error) => { console.error(error); process.exitCode = 1; });
