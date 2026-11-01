const assert = require('node:assert/strict');
const { fixture } = require('./sfa-next-action-api-fixture.cjs');
(async () => {
  { const f = fixture(); f.state().deal.isActive = false; assert.equal((await f.call()).status, 404); assert.equal(f.calls(), 0); assert.equal(f.state().generations.length, 0); }
  { const f = fixture(); for (let i=0;i<20;i++) f.state().generations.push({ id:'old-'+i, serviceId:'sfa', outputType:'SFA_AI_COMPLETE', metadata:{organizationId:'org'}, createdAt:new Date() }); assert.equal((await f.call()).status, 402); assert.equal(f.calls(), 0); }
  { const f = fixture(); f.fail('reservation'); assert.equal((await f.call()).status, 500); assert.equal(f.calls(), 0); }
  { const f = fixture(); f.provider(() => { throw Error('provider'); }); assert.equal((await f.call()).status, 500); assert.equal(f.calls(), 1); assert.equal(f.state().generations.length, 0); }
  { const f = fixture(); assert.equal((await f.call()).status, 200); assert.equal(f.calls(), 1); assert.equal(f.state().generations.length, 1); assert.equal(f.state().generations[0].outputType, 'SFA_AI_COMPLETE'); }
  console.log('PASS durable SFA next-action route: inactive target, quota, reservation outage, provider failure, success; full score/next-action protocols tested separately');
})().catch(error => { console.error(error); process.exitCode = 1; });
