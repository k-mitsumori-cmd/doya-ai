const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {PrismaClient}=require('@prisma/client'),{load}=require('../../../scripts/security-regression/load-typescript.cjs');
const base='docs/audits/2026-10-06-all-services-recheck/';
(async()=>{const socket=process.env.DOYA_SFA_AUTHORITY_PG_SOCKET,port=Number(process.env.DOYA_SFA_AUTHORITY_PG_PORT);assert.match(socket||'',/^\/tmp\/doya-sfa-authority-[a-f0-9]{8}\/socket$/);assert(port>1024&&port<65536);const prisma=new PrismaClient({datasources:{db:{url:`postgresql://doya_sfa@localhost:${port}/postgres?host=${encodeURIComponent(socket)}&schema=banner_text_fixture&connection_limit=12`}}});const results=[],deadline=setTimeout(()=>{console.error('Text operation probe incomplete');process.exit(1)},20000);try{
 const endpoint=await prisma.$queryRawUnsafe('SELECT inet_server_addr() AS address,current_user AS role');assert.equal(endpoint[0].address,null);assert.equal(endpoint[0].role,'doya_sfa');await prisma.$executeRawUnsafe('CREATE SCHEMA banner_text_fixture');
 await prisma.$executeRawUnsafe('CREATE TABLE "User" (id TEXT PRIMARY KEY,plan TEXT NOT NULL)');
 await prisma.$executeRawUnsafe('CREATE TABLE "SystemSetting" (id TEXT PRIMARY KEY,key TEXT UNIQUE NOT NULL,value TEXT NOT NULL)');
 await prisma.$executeRawUnsafe('CREATE TABLE "UserServiceSubscription" (id TEXT PRIMARY KEY,"userId" TEXT NOT NULL REFERENCES "User"(id),"serviceId" TEXT NOT NULL,plan TEXT NOT NULL,UNIQUE("userId","serviceId"))');
 const budget=load('src/lib/banner/text-budget.ts',{'node:crypto':crypto,'@/lib/prisma':{prisma},'@/lib/plan-utils':load('src/lib/plan-utils.ts'),'@/lib/pricing':{HIGH_USAGE_CONTACT_URL:''}});
 const helper=load('src/lib/banner/text-operation.ts',{'node:crypto':crypto,'@/lib/prisma':{prisma},'./text-budget':budget});
 const id='10000000-0000-4000-8000-000000000001',hash=helper.bannerTextFingerprint([{role:'user',content:'Synthetic request'}]),payload={reply:'どんな写真を使いますか？',needsMoreInfo:true,spec:null,suggestions:['写真を使います']};
 const reset=async()=>{await prisma.systemSetting.deleteMany();await prisma.$executeRawUnsafe(`INSERT INTO "User" (id,plan) VALUES ('actor','FREE'),('other','FREE') ON CONFLICT(id) DO UPDATE SET plan='FREE'`)};
 const used=async()=>{const row=await prisma.systemSetting.findUnique({where:{key:'banner-text:v1:'+crypto.createHash('sha256').update('actor').digest('hex')}});return row?Number(row.value.split(':').at(-1)):0};
 await reset();{
  const outcomes=await Promise.all(Array.from({length:12},()=>helper.beginBannerTextOperation('actor','chat',id,hash,prisma)));assert.equal(outcomes.filter(r=>r.state==='started').length,1);assert.equal(outcomes.filter(r=>r.state==='pending').length,11);assert.equal(await used(),1);results.push('12 parallel same operation admissions reserve one shared daily budget unit');
  await assert.rejects(helper.beginBannerTextOperation('actor','chat',id,'f'.repeat(64),prisma),e=>e.status===409);assert.equal(await used(),1);results.push('changed payload under same operation refuses without extra quota');
  const completions=await Promise.all(Array.from({length:6},()=>helper.completeBannerTextOperation('actor','chat',id,hash,payload,prisma)));assert(completions.every(r=>r.reply===payload.reply));assert.equal((await helper.recoverBannerTextOperation('actor','chat',id,false,prisma)).result.reply,payload.reply);assert.equal((await helper.beginBannerTextOperation('actor','chat',id,hash,prisma)).state,'completed');assert.equal(await helper.failBannerTextOperation('actor','chat',id,hash,prisma),'completed');assert.equal(await used(),1);results.push('parallel completion/replay/recovery keep one private result without another admission');
  assert.equal((await helper.recoverBannerTextOperation('other','chat',id,false,prisma)).state,'missing');assert.equal((await helper.recoverBannerTextOperation('actor','copy',id,false,prisma)).state,'missing');results.push('actor and chat/copy namespaces isolate private results');
 }
 await reset();{
  await helper.beginBannerTextOperation('actor','chat',id,hash,prisma);const failures=await Promise.all(Array.from({length:6},()=>helper.failBannerTextOperation('actor','chat',id,hash,prisma)));assert(failures.every(state=>state==='failed'));assert.equal((await helper.beginBannerTextOperation('actor','chat',id,hash,prisma)).state,'failed');assert.equal(await used(),1);results.push('parallel terminal failure remains counted once and same UUID cannot restart');
 }
 await reset();{
  assert.equal((await helper.recoverBannerTextOperation('actor','chat',id,true,prisma)).state,'cancelled');assert.equal((await helper.beginBannerTextOperation('actor','chat',id,hash,prisma)).state,'cancelled');assert.equal(await used(),0);results.push('cancel missing operation fences delayed admission without budget charge');
 }
 await reset();{
  await helper.beginBannerTextOperation('actor','chat',id,hash,prisma);assert.equal((await helper.recoverBannerTextOperation('actor','chat',id,true,prisma)).state,'pending');assert.equal(await used(),1);results.push('pending provider operation cannot be speculatively cancelled or refunded');
 }
 await reset();{
  await prisma.$executeRawUnsafe(`ALTER TABLE "SystemSetting" ADD CONSTRAINT reject_receipt CHECK(key NOT LIKE 'banner-text-operation:v1:%')`);await assert.rejects(helper.beginBannerTextOperation('actor','chat',id,hash,prisma));assert.equal(await used(),0);assert.equal(await prisma.systemSetting.count(),0);await prisma.$executeRawUnsafe('ALTER TABLE "SystemSetting" DROP CONSTRAINT reject_receipt');results.push('receipt persistence failure rolls back shared daily quota reservation');
 }
 await reset();{
  await helper.beginBannerTextOperation('actor','chat',id,hash,prisma);await prisma.$executeRawUnsafe(`ALTER TABLE "SystemSetting" ADD CONSTRAINT reject_result CHECK(value NOT LIKE '%completed%')`);await assert.rejects(helper.completeBannerTextOperation('actor','chat',id,hash,payload,prisma));assert.equal((await helper.recoverBannerTextOperation('actor','chat',id,false,prisma)).state,'pending');assert.equal(await used(),1);await prisma.$executeRawUnsafe('ALTER TABLE "SystemSetting" DROP CONSTRAINT reject_result');await helper.completeBannerTextOperation('actor','chat',id,hash,payload,prisma);assert.equal(await used(),1);results.push('failed result save preserves pending receipt; saving same in-memory response requires no provider/quota repeat');
 }
 await reset();{
  const outcomes=await Promise.all(Array.from({length:12},(_,i)=>helper.beginBannerTextOperation('actor',i%2?'copy':'chat','20000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),hash,prisma)));assert.equal(outcomes.filter(r=>r.state==='started').length,10);assert.equal(outcomes.filter(r=>r.state==='limit').length,2);assert.equal(await used(),10);results.push('chat and copy different operations concurrently share the same daily10 limit');
 }
 await reset();{
  await helper.beginBannerTextOperation('actor','chat',id,hash,prisma);await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE id='actor'`);for(const fn of [()=>helper.beginBannerTextOperation('actor','chat',id,hash,prisma),()=>helper.recoverBannerTextOperation('actor','chat',id,false,prisma),()=>helper.completeBannerTextOperation('actor','chat',id,hash,payload,prisma),()=>helper.failBannerTextOperation('actor','chat',id,hash,prisma)])await assert.rejects(fn(),e=>e.status===403);results.push('deleted actor with stale session cannot admit/recover/complete/fail old operation');
 }
 await reset();{
  await helper.beginBannerTextOperation('actor','chat',id,hash,prisma);const row=await prisma.systemSetting.findFirst({where:{key:{startsWith:'banner-text-operation:v1:'}}});await prisma.systemSetting.update({where:{id:row.id},data:{value:'{"version":1,"state":"completed"}'}});await assert.rejects(helper.beginBannerTextOperation('actor','chat',id,hash,prisma),e=>e.status===409);await assert.rejects(helper.recoverBannerTextOperation('actor','chat',id,false,prisma),e=>e.status===409);assert.equal(await used(),1);results.push('corrupt receipt fails closed without resetting usage or recreating operation');
 }
 await reset();{
  await helper.beginBannerTextOperation('actor','copy',id,hash,prisma);await helper.completeBannerTextOperation('actor','copy',id,hash,{suggestions:['有効な提案']},prisma);assert.equal((await helper.recoverBannerTextOperation('actor','copy',id,false,prisma)).result.suggestions[0],'有効な提案');await assert.rejects(helper.completeBannerTextOperation('actor','copy',id,hash,{suggestions:[]},prisma),e=>e.status===503);results.push('copy result contract matches actual suggestions DTO and rejects empty result');
 }

 for (const kind of ['chat','copy']) for (const mode of ['duplicate','network','saveFailure','commitLost','invalidResult']) {
  await reset();let calls=0,actor='actor',lost=false;
  const operation={...helper,completeBannerTextOperation:async(...args)=>{const result=await helper.completeBannerTextOperation(...args);if(mode==='commitLost'&&!lost){lost=true;throw Error('Synthetic lost commit acknowledgement')}return result}};
  const http=load('src/lib/banner/text-http.ts',{'node:crypto':crypto,'next/server':{NextResponse:{json:(value,options)=>Response.json(value,options)}},'./text-budget':budget,'./text-operation':operation},{setTimeout,clearTimeout,TextDecoder,Uint8Array});
  const answer=load('src/lib/banner/text-answer.ts',{'./provider-response':{requestBannerTextProvider:async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,35));if(mode==='network')throw Error('Synthetic uncertainty');const text=JSON.stringify(mode==='invalidResult'?(kind==='chat'?{reply:'x'.repeat(4001)}:{suggestions:['x'.repeat(2001)]}):kind==='chat'?{reply:'どんな写真を使いますか？',spec:{purpose:'sns_ad',category:'other',size:'1080x1080',keyword:'テスト'}}:{suggestions:['有効な提案']});return {ok:true,status:200,text:JSON.stringify({candidates:[{content:{parts:[{text}]}}]})}}}});
  const route=load(`src/app/api/banner/${kind}/route.ts`,{'next/server':{},'next-auth':{getServerSession:async()=>actor?({user:{id:actor}}):null},'@/lib/auth':{authOptions:{}},'@/lib/banner/text-http':http,'@/lib/banner/text-answer':answer},{process:{env:{GOOGLE_AI_API_KEY:'synthetic'}}});
  const body={operationId:id,...(kind==='chat'?{messages:[{role:'user',content:'テスト'}]}:{category:'other',purpose:'sns_ad'})};
  const req=()=>new Request(`https://local.test/api/banner/${kind}`,{method:'POST',body:JSON.stringify(body)});
  const recovery=()=>new Request(`https://local.test/api/banner/${kind}?operationId=${id}`);
  if(mode==='saveFailure')await prisma.$executeRawUnsafe(`ALTER TABLE "SystemSetting" ADD CONSTRAINT reject_api_result CHECK(value NOT LIKE '%completed%')`);
  const responses=await Promise.all(Array.from({length:mode==='duplicate'?9:1},()=>route.POST(req())));
  assert.equal(calls,1);assert.equal(await used(),1);
  for(const response of responses){assert.match(response.headers.get('cache-control'),/private.*no-store/);assert.match(response.headers.get('vary'),/Cookie/)}
  if(mode==='duplicate'){
   assert.equal(responses.filter(r=>r.status===200).length,1);assert.equal(responses.filter(r=>r.status===202).length,8);
   assert.equal((await route.POST(req())).status,200);assert.equal((await route.GET(recovery())).status,200);assert.equal(calls,1);assert.equal(await used(),1);
   const changed=JSON.parse(JSON.stringify(body));if(kind==='chat')changed.messages[0].content='別の入力';else changed.base='別の入力';assert.equal((await route.POST(new Request('https://local.test',{method:'POST',body:JSON.stringify(changed)}))).status,409);
   actor='other';assert.equal((await route.GET(recovery())).status,404);actor=null;assert.equal((await route.GET(recovery())).status,401);
  }else if(mode==='network'||mode==='invalidResult'){
   assert.equal(responses[0].status,mode==='network'?500:502);assert.equal((await route.POST(req())).status,409);assert.equal((await route.GET(recovery())).status,409);assert.equal(calls,1);assert.equal(await used(),1);
  }else if(mode==='saveFailure'){
   assert.equal(responses[0].status,202);assert.equal((await route.POST(req())).status,202);assert.equal((await route.DELETE(recovery())).status,202);assert.equal(calls,1);assert.equal(await used(),1);await prisma.$executeRawUnsafe('ALTER TABLE "SystemSetting" DROP CONSTRAINT reject_api_result');
  }else{
   assert.equal(responses[0].status,200);assert.equal((await route.GET(recovery())).status,200);assert.equal(calls,1);assert.equal(await used(),1);
  }
  results.push(`actual ${kind} API ${mode}: one provider/one quota; durable result/recovery/private response verified`);
 }
 assert.equal(results.length,23);const files=['src/lib/banner/text-operation.ts','src/lib/banner/text-budget.ts','src/lib/plan-utils.ts','src/lib/banner/text-http.ts','src/lib/banner/text-answer.ts','src/app/api/banner/chat/route.ts','src/app/api/banner/copy/route.ts'];fs.writeFileSync(base+'banner-text-operation-postgres-results.json',JSON.stringify({checkedAt:new Date().toISOString(),passed:results.length,cases:results,sourceHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),scope:'Actual text operation/budget helper, Prisma and isolated Unix-socket-only PostgreSQL synthetic schema. Actual chat/copy POST/GET/DELETE and answer orchestration included with synthetic session/provider. UI integration unverified. No customer DB or paid provider calls.'},null,2)+'\n');console.log(JSON.stringify({passed:results.length,cases:results}));
 }finally{clearTimeout(deadline);await prisma.$disconnect()}})().catch(e=>{console.error(e);process.exitCode=1});
