const assert = require('node:assert/strict');

const {fixture,op,stamp}=require('./sfa-score-api-fixture.cjs');
async function run(body, lead) {
 const f=fixture(); f.state().lead=lead?{...lead,updatedAt:new Date(stamp),score:null}:null;
 const request=body&&typeof body==='object'&&!Array.isArray(body)?{...body,operationId:op,expectedUpdatedAt:stamp}:body;
 const response=await f.call('POST',request);
 return {status:response.status,aiCalls:f.calls(),writes:f.state().lead?.score===70?1:0};
}

(async () => {
  const active = { id: 'lead', organizationId: 'org', isActive: true, name: 'Company', raw: null, status: 'new', note: null, source: 'manual' };
  for (const body of [null, [], {}, { leadId: 1 }, { leadId: {} }, { leadId: '  ' }]) {
    assert.deepEqual(await run(body, active), { status: 400, aiCalls: 0, writes: 0 });
  }
  for (const lead of [null, { ...active, isActive: false }, { ...active, organizationId: 'foreign' }]) {
    assert.deepEqual(await run({ leadId: 'lead' }, lead), { status: 404, aiCalls: 0, writes: 0 });
  }
  assert.deepEqual(await run({ leadId: 'lead' }, active), { status: 200, aiCalls: 1, writes: 1 });
  console.log('PASS SFA AI score: malformed, deleted and foreign leads do not invoke AI');
})().catch((error) => { console.error(error); process.exitCode = 1; });
