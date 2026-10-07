const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{createRequire}=require('node:module')
const {load}=require('../../../scripts/security-regression/load-typescript.cjs')
const base='docs/audits/2026-10-06-all-services-recheck/', fixture=base+'verify-adimage-operation-postgres.cjs'
const {db,setupDb,makeBudget}=new Function('require','__dirname',fs.readFileSync(fixture,'utf8').split(';(async()=>')[0]+'\nreturn {db,setupDb,makeBudget};')(createRequire(path.resolve(fixture)),path.dirname(path.resolve(fixture)))
const globals={setTimeout,clearTimeout,TextDecoder,AbortController}
const client=load('src/lib/adimage/operation-client.ts',{},globals)
const copyModule=load('src/lib/adimage/copy.ts',{'@seo/lib/gemini':{},'./types':load('src/lib/adimage/types.ts')})
const actualAccess=load('src/lib/adimage/access.ts',{'crypto':crypto,'next-auth':{getServerSession:async()=>null},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma:db}})
const timeout=load('src/lib/fetch-timeout.ts',{},globals)
const cases=[];let budget,core,http,routes,generated,signFailure,providerFailure,actor,providerWait,providerStarted
const uuid='20000000-0000-4000-8000-000000000001',uuid2='20000000-0000-4000-8000-000000000002'
const bodies={generate:{operationId:uuid,brandId:'brand',copy:{headline:'Synthetic',cta:'View'},placements:['square'],variations:1},refine:{operationId:uuid,note:'Synthetic instruction'}}
const target=k=>k==='generate'?'brand':'original'
async function reset(){
 budget=await makeBudget();await db.adImageConcept.update({where:{id:'original'},data:{copy:{headline:'Synthetic',sub:'',cta:'View'}}});await db.$executeRawUnsafe(`INSERT INTO "User"(id,plan) VALUES ('budget-user','FREE'),('other','FREE') ON CONFLICT(id) DO UPDATE SET plan='FREE'`)
 generated=0;signFailure=false;providerFailure=false;actor='budget-user';providerWait=null;providerStarted=null
 core=load('src/lib/adimage/image-operation.ts',{'node:crypto':crypto,'@/lib/prisma':{prisma:db},'./access':actualAccess,'./image-budget':budget,'./logo-operation':require('../../../scripts/security-regression/adimage-logo-operation-fixture.cjs').makeAdImageLogoOperationFixture(budget,()=>core)})
 const access={getIdentity:async()=>({userId:actor,guestId:null,plan:'FREE'}),requireUser:i=>({ok:!!i.userId,reason:'Login required'}),ownerWhere:i=>i.userId?{userId:i.userId}:null}
 const storage={downloadBuffer:async()=>null,signedUrl:async p=>{if(signFailure==='null')return null;if(signFailure)throw Error('SENSITIVE synthetic signing error');return 'https://local.test/'+p}}
 const placement={key:'square',name:'Synthetic square',w:1024,h:1024}
 const placements={DEFAULT_PLACEMENT_KEYS:['square'],findPlacement:k=>k==='square'?placement:null,groupByGenSize:()=>[{genKey:'square',composition:'hero-center',placements:[placement]}]}
 http=load('src/lib/adimage/image-operation-http.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'./access':access,'./storage':storage,'./placements':placements,'@/lib/fetch-timeout':timeout,'./image-operation':core},globals)
 const mocks={
  'crypto':crypto,'next/server':{NextResponse:Response},'sharp':()=>{throw Error('Unexpected image processing')},'@/lib/prisma':{prisma:db},'@/lib/adimage/access':access,
  '@/lib/adimage/image-operation':core,'@/lib/adimage/image-operation-http':http,'@/lib/service-usage':{recordServiceUsage:async()=>{}},'@/lib/adimage/placements':placements,
  '@/lib/adimage/ref-palette':{extractRefPalette:async()=>[]},'@/lib/adimage/generate':{generateBaked:async()=>{generated++;providerStarted?.();if(providerWait)await providerWait;if(providerFailure)throw Error('Synthetic provider failure');return{buffer:Buffer.from('synthetic'),genSize:'1024',genPath:'synthetic.png',prompt:'Synthetic',model:'synthetic',verify:{needsReview:false}}},exportToSize:async()=>({imagePath:'synthetic-'+generated+'.png'})},
  '@/lib/adimage/logo':{DEFAULT_LOGO_CONFIG:{}},'@/lib/adimage/copy':copyModule,'@seo/lib/gemini':{},'@/lib/adimage/feedback':{REFINE_CHIPS:[],directivesToPromptLines:()=>['Synthetic']},'@/lib/adimage/storage':storage}
 routes={operations:load('src/app/api/adimage/operations/route.ts',{'next/server':{NextResponse:Response},'@/lib/adimage/image-operation-http':http},globals),generate:load('src/app/api/adimage/concepts/route.ts',mocks,globals),refine:load('src/app/api/adimage/concepts/[id]/refine/route.ts',mocks,globals)}
}
const post=(k,body=bodies[k])=>routes[k].POST(new Request('https://local.test/api/adimage/concepts',{method:'POST',body:JSON.stringify(body)}),{params:Promise.resolve({id:'original'})})
const recover=(k,method='GET',id=uuid)=>{const req=new Request(`https://local.test/api/adimage/operations?operationId=${id}&kind=${k}&targetId=${target(k)}`,{method});req.nextUrl=new URL(req.url);return routes.operations[method](req)}
const usage=async()=>await budget.readImageBudgetUsage('budget-user')
const saved=()=>db.adImageConcept.count({where:{id:{not:'original'}}})
function privateResponse(r){assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('vary'),'Cookie')}
async function record(name,run){await reset();await run();cases.push(name);console.log('PASS',name)}
;(async()=>{
 await setupDb()
 for(const k of ['generate','refine']){
  await record(k+': signing fails after commit; GET and identical POST recover one charged output',async()=>{
   signFailure=true;const first=await post(k);privateResponse(first);assert.equal(first.status,503);assert(!(await first.text()).includes('SENSITIVE'));assert.equal(generated,1);assert.equal(await saved(),1);assert.equal((await usage()).today,1)
   signFailure=false;const get=await recover(k);privateResponse(get);const validated=await client.readAdImageOperationResponse(get.clone(),{version:1,operationId:uuid,kind:k,targetId:target(k),createdAt:new Date().toISOString()},new AbortController().signal);assert.equal(validated.state,'completed');const dto=await get.json();assert.equal(dto.state,'completed');assert.equal(dto.creatives.length,1);assert(!JSON.stringify(dto).includes('reservation'));assert(!JSON.stringify(dto).includes('inputHash'));assert.equal((await (await post(k)).json()).conceptId,dto.conceptId);assert.equal(generated,1);assert.equal(await saved(),1);assert.equal((await usage()).today,1)
   if(k==='refine'){assert.equal(dto.generation,2);assert.equal(dto.previousGeneration,1);assert.equal(dto.previousCreatives.length,1);assert.equal(dto.appliedDirectives[0].instruction,'Synthetic instruction')}
  })
  await record(k+': completed replay at exhausted quota and changed source does not regenerate',async()=>{
   const first=await (await post(k)).json();const claim=await budget.claimImageBudget({userId:'budget-user',guestId:null,plan:'FREE'},2,false);assert(claim.ok)
   await db.adImageBrand.update({where:{id:'brand'},data:{name:'Changed after save'}})
   const replay=await post(k);assert.equal(replay.status,200);assert.equal((await replay.json()).conceptId,first.conceptId);assert.equal(generated,1);assert.equal((await usage()).today,3)
  })
  await record(k+': null signing URL keeps committed result recoverable without another charge',async()=>{signFailure='null';assert.equal((await post(k)).status,503);assert.equal(await saved(),1);signFailure=false;assert.equal((await (await recover(k)).json()).state,'completed');assert.equal(generated,1);assert.equal((await usage()).today,1)})
  await record(k+': deleted completed output remains unavailable and charged',async()=>{const dto=await (await post(k)).json();await db.adImageConcept.delete({where:{id:dto.conceptId}});assert.equal((await (await recover(k)).json()).state,'unavailable');assert.equal((await (await post(k)).json()).state,'unavailable');assert.equal(generated,1);assert.equal((await usage()).today,1)})
  await record(k+': ownership transfer hides saved result without refund or regeneration',async()=>{await post(k);await db.adImageCampaign.updateMany({where:{userId:'budget-user'},data:{userId:'other'}});assert.equal((await (await recover(k)).json()).state,'unavailable');assert.equal((await (await post(k)).json()).state,'unavailable');assert.equal(generated,1);assert.equal((await usage()).today,1)})
  await record(k+': immutable input change is rejected before provider',async()=>{await post(k);const r=await post(k,{...bodies[k],...(k==='generate'?{tone:'Changed'}:{note:'Changed'})});assert.equal(r.status,409);assert.equal((await r.json()).code,'INPUT_CHANGED');assert.equal(generated,1);assert.equal(await saved(),1)})
  await record(k+': simultaneous replay and competing UUID cannot admit another provider',async()=>{
   let release;providerWait=new Promise(r=>release=r);let started;const running=new Promise(r=>started=r);providerStarted=started;const pending=post(k);await running
   try{const same=await post(k),other=await post(k,{...bodies[k],operationId:uuid2});assert.equal(same.status,202);assert.equal((await same.json()).state,'pending');assert.equal(other.status,202);assert.equal((await other.json()).state,'busy');assert.equal(generated,1);assert.equal((await usage()).today,1)}finally{release()}
   assert.equal((await pending).status,200);assert.equal(await saved(),1)
  })
  await record(k+': missing UUID returns reload guidance without spending',async()=>{const body={...bodies[k]};delete body.operationId;const r=await post(k,body);assert.equal(r.status,409);assert.equal((await r.json()).code,'OPERATION_REQUIRED');assert.equal(generated,0);assert.equal(await usage(),null)})
  await record(k+': cancellation fences delayed POST',async()=>{assert.equal((await (await recover(k,'DELETE')).json()).state,'cancelled');assert.equal((await (await post(k)).json()).state,'cancelled');assert.equal(generated,0);assert.equal(await usage(),null)})
  await record(k+': provider failure refunds once and same UUID never retries provider',async()=>{providerFailure=true;assert.equal((await post(k)).status,502);assert.equal((await usage()).today,0);providerFailure=false;assert.equal((await (await post(k)).json()).state,'failed');assert.equal(generated,1);assert.equal(await saved(),0)})
  await record(k+': foreign actor cannot recover saved data',async()=>{await post(k);actor='other';const response=await recover(k);privateResponse(response);const dto=await response.json();assert.equal(dto.state,'missing');assert.equal(dto.creatives,undefined);assert.equal(generated,1)})
 }
 await record('Anonymous POST and recovery reject before state writes',async()=>{actor=null;assert.equal((await post('generate')).status,401);assert.equal((await recover('generate')).status,401);assert.equal(await db.systemSetting.count(),0);assert.equal(generated,0)})
 await record('Oversized streamed JSON rejects without DB state or provider',async()=>{const r=await post('generate',{...bodies.generate,customPrompt:'x'.repeat(33000)});assert.equal(r.status,413);assert.equal(generated,0);assert.equal(await db.systemSetting.count(),0)})
 await record('Malformed UTF-8 and unknown body keys reject before state writes',async()=>{const invalid=new Request('https://local.test',{method:'POST',body:new Uint8Array([123,34,120,34,58,34,255,34,125])});assert.equal((await routes.generate.POST(invalid)).status,400);assert.equal((await post('generate',{...bodies.generate,actor:'other'})).status,400);assert.equal(generated,0);assert.equal(await db.systemSetting.count(),0)})
 await record('Malformed or duplicate recovery query cannot access receipts',async()=>{await post('generate');for(const q of ['operationId='+uuid+'&kind=generate&targetId=brand&targetId=brand','operationId=invalid&kind=generate&targetId=brand','operationId='+uuid+'&kind=generate&targetId=brand&actor=other']){const req=new Request('https://local.test/?'+q);req.nextUrl=new URL(req.url);const r=await routes.operations.GET(req);assert.equal(r.status,400);privateResponse(r);assert.equal((await r.json()).creatives,undefined)}assert.equal(generated,1)})
 await record('Aborted stalled request body terminates without provider or state writes',async()=>{const controller=new AbortController();let cancelled=false;const stream=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{'))},cancel(){cancelled=true}});const req=new Request('https://local.test',{method:'POST',body:stream,duplex:'half',signal:controller.signal});const pending=routes.generate.POST(req);controller.abort();const r=await pending;assert.equal(r.status,408);assert.equal(cancelled,true);assert.equal(generated,0);assert.equal(await db.systemSetting.count(),0)})
 const files=['src/lib/adimage/operation-client.ts','src/app/api/adimage/operations/route.ts','src/app/api/adimage/concepts/route.ts','src/app/api/adimage/concepts/[id]/refine/route.ts','src/lib/adimage/image-operation.ts','src/lib/adimage/image-operation-http.ts','src/lib/adimage/image-budget.ts','src/lib/adimage/access.ts']
 const result={checkedAt:new Date().toISOString(),passed:cases.length,cases,sourceHashes:Object.fromEntries(files.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')])),scope:'Actual full POST handlers, HTTP parser/result/recovery, operation helper, budget and Prisma/private PostgreSQL with foreign keys. Synthetic authenticated identities, provider/export/signing only. Actual client response parser accepts real route recovery DTO for both paths. No browser, production/provider writes.'}
 fs.writeFileSync(base+'adimage-operation-api-postgres-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))
})().finally(()=>db.$disconnect()).catch(e=>{console.error(e);process.exitCode=1})
