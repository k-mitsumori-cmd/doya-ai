const assert=require('node:assert/strict'),{load}=require('./load-typescript.cjs');const {isRecentRegistration}=load('src/lib/registration-classification.ts');const now=2000000000000,iso=offset=>new Date(now+offset).toISOString();let passed=0;
for(const offset of [0,-1,-1799999]){assert.equal(isRecentRegistration(iso(offset),now),true);passed++}
for(const input of [undefined,null,{},[],new Date(now),now,NaN,Infinity,'','not-a-date','2023-02-30T00:00:00.000Z','2033-05-18T03:33:20+00:00','2033-05-18T03:33:20Z',iso(1),iso(60000),iso(-1800000),iso(-1800001),iso(-365*86400000)]){assert.equal(isRecentRegistration(input,now),false);passed++}
for(const invalidNow of [NaN,Infinity,-Infinity]){assert.equal(isRecentRegistration(iso(0),invalidNow),false);passed++}
console.log(JSON.stringify({passed,scope:'Actual strict account creation-date classifier; future, malformed, calendar and30minute boundaries'}));
