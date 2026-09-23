const assert = require('node:assert/strict');
const {load, check, results} = require('./load-typescript.cjs');
(async () => {
 for (const service of ['one-on-one', 'employees']) {
  let calls = 0;
  const rows = Array.from({length: 221}, (_, i) => ({id: String(i), managerId: 'm'}));
  const model = {
   findMany: async q => { calls++; assert.equal(q.where.organizationId, 'org'); assert.ok(Array.isArray(q.orderBy)); assert.ok(q.orderBy.some(x => x.id)); return rows.slice(q.skip, q.skip + q.take); },
   count: async () => rows.length,
  };
  const api = load(`src/app/api/hr/${service}/route.ts`, {
   'next/server': {NextResponse: Response}, 'next-auth': {}, '@/lib/auth': {},
   '@/lib/prisma': {prisma: {hrOneOnOne: model, hrEmployee: model}},
   '@/lib/hr/access': {getHrContext: async () => ({role: 'ADMIN', organizationId: 'org'})},
   '@/lib/hr/one-on-one-access': {getOneOnOneViewer: async () => ({employeeId: null}), getOneOnOneReadWhere: async () => ({organizationId: 'org'}), filterOneOnOneFields: x => x},
   '@/lib/hr/constants': {DEFAULT_PAGE_SIZE: 20, MAX_PAGE_SIZE: 100},
   '@/lib/hr/billing': {}, '@/lib/service-usage': {},
  });
  await check(`${service}: all 221 records reachable`, async () => {
   const ids = [];
   for (let page = 1; page <= 3; page++) {
    const res = await api.GET({nextUrl: new URL(`http://offline.invalid/?page=${page}&pageSize=100`)});
    assert.equal(res.status, 200); const body = await res.json();
    assert.equal(body.totalPages, 3); assert.equal(body.page, page); ids.push(...body.items.map(x => x.id));
   }
   assert.deepEqual(ids, rows.map(x => x.id));
  });
  for (const query of ['page=abc', 'page=1.5', 'page=-1', 'page=1000001', 'pageSize=abc', 'pageSize=0']) await check(`${service}: rejects ${query}`, async () => {
   const before = calls;
   const res = await api.GET({nextUrl: new URL(`http://offline.invalid/?${query}`)});
   assert.equal(res.status, 400); assert.equal(calls, before);
  });
 }
 console.log(JSON.stringify({passed: results.length, results}, null, 2));
})().catch(e => {console.error(e); process.exitCode = 1});
