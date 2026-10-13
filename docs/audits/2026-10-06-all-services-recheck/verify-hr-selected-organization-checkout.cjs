const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {load}=require(path.resolve('scripts/security-regression/load-typescript.cjs'));const overlay=path.resolve(__dirname,'hr-evaluation-period-repair-overlay');process.env.DOYA_TEST_BASELINE=overlay;
const source='src/app/api/stripe/checkout/route.ts',selection=load('src/lib/hr/organization-selection.ts');let query,providerCalls=0,roles,latest;
const {POST}=load(source,{
 'next/server':{NextResponse:Response},'next-auth':{getServerSession:async()=>({user:{id:'actor-A',email:'synthetic@example.invalid'}})},'@/lib/auth':{authOptions:{}},'@/lib/hr/organization-selection':selection,
 '@/lib/prisma':{prisma:{user:{findUnique:async()=>({id:'actor-A',stripeCustomerId:null})},hrOrganizationMember:{findFirst:async q=>{query=q;const role=roles[q.where.organizationId||latest];return role?{role}:null}}}},
 '@/lib/checkout-reservation':{CheckoutReservationError:class extends Error{},createReservedCheckoutSession:async()=>{providerCalls++;throw Error('Provider prohibited')}},
 '@/lib/stripe':{STRIPE_PRICE_IDS:Object.fromEntries(['seo','banner','interview','copy','lp','voice','movie','adsim'].map(k=>[k,{}])),findActiveLikeSubscriptions:async()=>{providerCalls++;throw Error('Provider prohibited')},createCheckoutSession:async()=>{providerCalls++;throw Error('Provider prohibited')}},
 '@/lib/unified-plan':{UNIFIED_TRIAL_DAYS:30},'@/lib/trial':{isTrialEligible:async()=>{providerCalls++;throw Error('Provider prohibited')}}
});const cases=[];
async function check(name,headers,roleMap,expected,expectedOrg,service='hr'){roles=roleMap;latest='org-B';query=null;const response=await POST(new Request('https://synthetic.invalid/api/stripe/checkout',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({planId:'synthetic-invalid-plan',serviceId:service,returnTo:service==='hr'?'/hr/pricing':'/persona/pricing'})}));assert.equal(response.status,expected,name);assert.equal(query?.where.organizationId,expectedOrg,name);assert.equal(providerCalls,0);cases.push({name,passed:true});console.log('PASS '+name)}
(async()=>{const selected={'X-HR-Selected-Organization':'org-A','X-HR-Selected-Actor':'actor-A','X-HR-Organization-Id':'org-A'};
await check('Selected A owner is not denied by latest B admin',selected,{'org-A':'OWNER','org-B':'ADMIN'},400,'org-A');
await check('Selected A admin cannot borrow latest B owner',selected,{'org-A':'ADMIN','org-B':'OWNER'},403,'org-A');
await check('Revoked selected membership cannot fall back',selected,{'org-B':'OWNER'},403,'org-A');
await check('Selected unknown role is denied',selected,{'org-A':'UNKNOWN','org-B':'OWNER'},403,'org-A');
await check('Foreign selected actor is denied before membership query',{...selected,'X-HR-Selected-Actor':'other'}, {'org-A':'OWNER'},403,undefined);
await check('Conflicting expected organization is denied',{...selected,'X-HR-Organization-Id':'org-B'}, {'org-A':'OWNER'},403,undefined);
await check('Partial selected identity is denied',{'X-HR-Selected-Organization':'org-A'}, {'org-A':'OWNER'},403,undefined);
await check('Malformed selected identity is denied',{...selected,'X-HR-Selected-Organization':'bad value'}, {'org-A':'OWNER'},403,undefined);
await check('Legacy no-selection owner guard remains',{}, {'org-B':'OWNER'},400,undefined);
await check('Legacy no-selection admin remains denied',{}, {'org-B':'ADMIN'},403,undefined);
await check('Other service checkout does not interpret HR selection',selected,{'org-A':'ADMIN'},400,undefined,'persona');
const files=[path.join(overlay,source),path.join(overlay,'src/lib/hr/organization-selection.ts'),__filename];const report={checkedAt:new Date().toISOString(),expected:11,passed:cases.length,cases,providerCalls,sourceHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),scope:'Actual candidate route plus actual parser; controlled session/membership ORM. Owner-authorized requests intentionally stop at invalid test plan400 before any Stripe read/create. Proves selected membership gate, not actual checkout creation or production.',rootApplied:false,published:false};fs.writeFileSync(path.join(__dirname,'hr-selected-organization-checkout-results.json'),JSON.stringify(report,null,2)+'\n')})().catch(e=>{console.error(e);process.exitCode=1});
