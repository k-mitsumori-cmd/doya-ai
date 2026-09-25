const assert=require('node:assert/strict'),{load,check}=require('./load-typescript.cjs');let logs=[];
const unified=load('src/lib/unified-plan.ts'),services=load('src/lib/services.ts',{'./unified-plan':unified}),ui=load('src/lib/service-limit-ui.ts',{'./services':services});
function fixture(today,month,concepts,at='2026-09-20T02:58:19Z'){const RealDate=Date;class FixedDate extends Date{constructor(...a){super(...(a.length?a:[at]))}static now(){return +new RealDate(at)}};
 let imageReads=0;const access=load('src/lib/adimage/access.ts',{'crypto':require('crypto'),'next-auth':{},'@/lib/auth':{},'@/lib/prisma':{prisma:{adImageCreative:{count:async()=>++imageReads===1?today:month},adImageConcept:{count:async()=>concepts}}}},{Date:FixedDate,console:{info:(...args)=>logs.push(args),error:()=>{throw Error('No incident for quota')}}});return access}
(async()=>{
for(const [name,plan,request,today,month,concepts,code,reset] of [
 ['per request','PRO',11,0,0,0,'REQUEST_IMAGE_LIMIT',null],['daily free','FREE',1,3,3,1,'DAILY_IMAGE_LIMIT','2026-09-20T15:00:00.000Z'],['monthly free','FREE',1,0,15,0,'MONTHLY_IMAGE_LIMIT','2026-09-30T15:00:00.000Z'],['daily paid','PRO',1,50,50,0,'DAILY_IMAGE_LIMIT','2026-09-20T15:00:00.000Z'],['monthly paid','PRO',1,0,300,0,'MONTHLY_IMAGE_LIMIT','2026-09-30T15:00:00.000Z'],['concept free','FREE',1,0,0,5,'DAILY_CONCEPT_LIMIT','2026-09-20T15:00:00.000Z'],['concept paid','PRO',1,0,0,40,'DAILY_CONCEPT_LIMIT','2026-09-20T15:00:00.000Z']])await check(name,async()=>{logs=[];const result=await fixture(today,month,concepts).assertQuota({userId:'private-user-id',guestId:null,plan},request);assert.equal(result.ok,false);assert.equal(result.code,code);assert.equal(result.resetAt,reset);assert.match(result.diagnosticId,/^[a-f0-9]{24}$/);assert.equal(logs.length,1);assert(!JSON.stringify(logs).includes('private-user-id'));assert.equal(logs[0][1].diagnosticId,result.diagnosticId);assert.equal(!!ui.classifyServiceLimit('/api/adimage/concepts',429,{error:result.reason,...result}),code!=='REQUEST_IMAGE_LIMIT');assert(!result.reason.includes('制限なく'));});
for(const kind of ['generate','refine'])await check(kind+' route returns diagnosis before any generation or writes',async()=>{
 const fs=require('fs'),ts=require('typescript');const file=kind==='generate'?'src/app/api/adimage/concepts/route.ts':'src/app/api/adimage/concepts/[id]/refine/route.ts';
 const source=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);const mocks={};for(const n of ast.statements)if(ts.isImportDeclaration(n))mocks[n.moduleSpecifier.text]={};
 const access=fixture(0,0,0),identity={userId:'private-user-id',guestId:null,plan:'FREE'};let generated=0,writes=0,quotaOptions;
 const database={adImageBrand:{findFirst:async()=>({id:'brand'})},adImageConcept:{findFirst:async()=>({id:'c',campaign:{brand:{}},feedbacks:[],creatives:Array.from({length:5},(_,i)=>({placementKey:'p'+i}))})}};
 mocks['next/server']={NextResponse:Response};mocks['@/lib/prisma']={prisma:database};
 mocks['@/lib/adimage/access']={...access,getIdentity:async()=>identity,assertQuota:async(...args)=>{quotaOptions=args[2];return access.assertQuota(...args)}};
 mocks['@/lib/adimage/placements']={findPlacement:key=>({key}),groupByGenSize:()=>[{}],DEFAULT_PLACEMENT_KEYS:[]};
 mocks['@/lib/adimage/copy']={normalizeCopy:x=>x};mocks['@/lib/adimage/feedback']={REFINE_CHIPS:[]};mocks['@/lib/adimage/generate']={generateBaked:async()=>{generated++}};
 for(const model of Object.values(database))model.create=async()=>{writes++;throw Error('write forbidden')};
 const api=load(file,mocks);const response=await api.POST({json:async()=>({brandId:'brand',copy:{headline:'synthetic',cta:'synthetic'},placements:['p0','p1','p2','p3','p4'],note:'synthetic'})},{params:Promise.resolve({id:'c'})});
 const body=await response.json();assert.equal(response.status,429);assert.equal(body.code,'DAILY_IMAGE_LIMIT');assert.equal(body.usage.requested,5);assert.equal(response.headers.get('cache-control'),'no-store');assert.match(body.diagnosticId,/^[a-f0-9]{24}$/);assert.equal(generated,0);assert.equal(writes,0);assert(!JSON.stringify(body).includes('private-user-id'));assert.equal(quotaOptions?.checkConceptLimit,kind==='refine'?false:undefined);
});
for(const kind of ['generate','refine'])await check(kind+' atomic reservation denial blocks image provider',async()=>{
 const fs=require('fs'),ts=require('typescript');const file=kind==='generate'?'src/app/api/adimage/concepts/route.ts':'src/app/api/adimage/concepts/[id]/refine/route.ts';
 const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true),mocks={};for(const n of ast.statements)if(ts.isImportDeclaration(n))mocks[n.moduleSpecifier.text]={};
 const identity={userId:'private-user-id',guestId:null,plan:'FREE'};let generated=0,claimed=0,writes=0;
 mocks['next/server']={NextResponse:Response};mocks['@/lib/prisma']={prisma:{adImageBrand:{findFirst:async()=>({id:'brand',name:'brand'})},adImageConcept:{findFirst:async()=>({id:'c',campaignId:'campaign',campaign:{brand:{name:'brand'}},feedbacks:[],creatives:[{placementKey:'p1'}],copy:{},generation:1})}}};
 mocks['@/lib/adimage/access']={getIdentity:async()=>identity,requireUser:()=>({ok:true}),ensureGuestId:id=>({identity:id,newGuestId:null}),ownerWhere:()=>({userId:identity.userId}),assertQuota:async()=>({ok:true})};
 mocks['@/lib/adimage/image-budget']={claimImageBudget:async()=>{claimed++;return{ok:false,reason:'quota reached',code:'DAILY_IMAGE_LIMIT',usage:{requested:1}}},releaseImageBudget:async()=>{throw Error('no reservation')},settleImageBudget:async()=>{writes++}};
 mocks['@/lib/adimage/placements']={findPlacement:key=>({key}),groupByGenSize:()=>[{placements:[{key:'p1'}]}],DEFAULT_PLACEMENT_KEYS:['p1']};
 mocks['@/lib/adimage/copy']={normalizeCopy:x=>x};mocks['@/lib/adimage/feedback']={REFINE_CHIPS:[]};mocks['@/lib/adimage/generate']={generateBaked:async()=>{generated++}};
 const api=load(file,mocks),res=await api.POST({json:async()=>({brandId:'brand',copy:{headline:'h',cta:'c'},placements:['p1'],note:'revise'})},{params:Promise.resolve({id:'c'})});
 assert.equal(res.status,429);assert.equal((await res.json()).code,'DAILY_IMAGE_LIMIT');assert.equal(res.headers.get('cache-control'),'no-store');assert.equal(claimed,1);assert.equal(generated,0);assert.equal(writes,0);
});
await check('refinement ignores new-concept cap but still consumes image allowance',async()=>{
 const identity={userId:'u',guestId:null,plan:'PRO'};
 assert.equal((await fixture(0,0,40).assertQuota(identity,1)).code,'DAILY_CONCEPT_LIMIT');
 assert.equal((await fixture(0,0,40).assertQuota(identity,1,{checkConceptLimit:false})).ok,true);
 assert.equal((await fixture(50,50,40).assertQuota(identity,1,{checkConceptLimit:false})).code,'DAILY_IMAGE_LIMIT');
});
await check('advertised AdImage allowances include actual image and concept caps',async()=>{
 const svc=services.SERVICES.find(s=>s.id==='adimage');
 const access=fixture(0,0,0);
 for(const [plan,copy] of [['FREE',svc.pricing.free.limit],['PRO',svc.pricing.pro.limit]]){
  assert.ok(copy.includes(`1日${access.DAILY_IMAGE_LIMIT[plan]}枚`));
  assert.ok(copy.includes(`月${access.MONTHLY_IMAGE_LIMIT[plan]}枚`));
  assert.ok(copy.includes(`1日${access.DAILY_CONCEPT_LIMIT[plan]}件`));
  assert.ok(copy.includes('改善含む'));
  assert.ok(!copy.includes('無制限'));
 }
});
for(const [at,expected] of [['2026-12-31T14:59:59Z','2026-12-31T15:00:00.000Z'],['2028-02-28T15:00:00Z','2028-02-29T15:00:00.000Z'],['2026-09-30T15:00:00Z','2026-10-31T15:00:00.000Z']])await check('monthly reset boundary '+at,async()=>{const r=await fixture(0,15,0,at).assertQuota({userId:'u',guestId:null,plan:'FREE'},1);assert.equal(r.resetAt,expected)});
await check('allowed request logs no denial',async()=>{logs=[];const result=await fixture(0,0,0).assertQuota({userId:'u',guestId:null,plan:'FREE'},1);assert.equal(result.ok,true);assert.equal(logs.length,0)});
await check('DB failure is not converted to quota',async()=>{const a=load('src/lib/adimage/access.ts',{'crypto':require('crypto'),'next-auth':{},'@/lib/auth':{},'@/lib/prisma':{prisma:{adImageCreative:{count:async()=>{throw Error('DB unavailable')}}}}});await assert.rejects(()=>a.assertQuota({userId:'u',guestId:null,plan:'FREE'},1),/DB unavailable/)});
})().catch(e=>{console.error(e);process.exitCode=1});
