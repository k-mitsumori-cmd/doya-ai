const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {PrismaClient}=require('@prisma/client'),{load}=require('../../../scripts/security-regression/load-typescript.cjs');
const base='docs/audits/2026-10-06-all-services-recheck/';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
(async()=>{
 const socket=process.env.DOYA_SFA_AUTHORITY_PG_SOCKET,port=Number(process.env.DOYA_SFA_AUTHORITY_PG_PORT);
 assert.match(socket||'',/^\/tmp\/doya-sfa-authority-[a-f0-9]{8}\/socket$/);assert.ok(port>1024&&port<65536);
 const prisma=new PrismaClient({datasources:{db:{url:`postgresql://doya_sfa@localhost:${port}/postgres?host=${encodeURIComponent(socket)}&schema=sfa_authority_fixture&connection_limit=12`}}});
 const results=[],waits=[],dbErrors=[]; const op='f1536c85-32e5-46f6-919a-8bc55a5a92fb';
 const waitForLock=async()=>{for(let i=0;i<100;i++){const r=await prisma.$queryRawUnsafe("SELECT count(*)::integer AS n FROM pg_stat_activity WHERE usename=current_user AND wait_event_type='Lock'");if(r[0].n){waits.push(r[0].n);return}await new Promise(r=>setTimeout(r,20))}throw Error('No PostgreSQL Lock wait observed')};
 try {
  const endpoint=await prisma.$queryRawUnsafe('SELECT inet_server_addr() AS address,current_user AS role');assert.equal(endpoint[0].address,null);assert.equal(endpoint[0].role,'doya_sfa');
  await prisma.$executeRawUnsafe('CREATE SCHEMA sfa_authority_fixture');
  const sqls=[
   'CREATE TABLE sfa_authority_fixture."SystemSetting" (id TEXT PRIMARY KEY,key TEXT UNIQUE NOT NULL,value TEXT NOT NULL)',
   'CREATE TABLE sfa_authority_fixture."User" (id TEXT PRIMARY KEY,plan TEXT NOT NULL)',
   'CREATE TABLE sfa_authority_fixture.sfa_members (id TEXT PRIMARY KEY,"organizationId" TEXT,"userId" TEXT,role TEXT,status TEXT,"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP)',
   'CREATE TABLE sfa_authority_fixture.sfa_pipelines (id TEXT PRIMARY KEY,"organizationId" TEXT,name TEXT,"isDefault" BOOLEAN,"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP)',
   'CREATE TABLE sfa_authority_fixture.sfa_stages (id TEXT PRIMARY KEY,"pipelineId" TEXT,name TEXT,"order" INT,probability INT,color TEXT,"isWon" BOOLEAN,"isLost" BOOLEAN)',
   'CREATE TABLE sfa_authority_fixture.sfa_accounts (id TEXT PRIMARY KEY,"organizationId" TEXT,name TEXT,"isActive" BOOLEAN DEFAULT TRUE)',
   'CREATE TABLE sfa_authority_fixture.sfa_deals (id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL,"accountId" TEXT,"contactId" TEXT,name TEXT NOT NULL,amount BIGINT DEFAULT 0,currency TEXT DEFAULT \'JPY\',"stageId" TEXT,probability INT DEFAULT 0,"startDate" TIMESTAMP(3),"expectedCloseDate" TIMESTAMP(3),"contactName" TEXT,note TEXT,status TEXT DEFAULT \'open\',"wonAt" TIMESTAMP(3),"lostAt" TIMESTAMP(3),"lostReason" TEXT,"assigneeMemberId" TEXT,"lastActivityAt" TIMESTAMP(3),"isActive" BOOLEAN DEFAULT TRUE,"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP)'
  ];for(const sql of sqls)await prisma.$executeRawUnsafe(sql);
  await prisma.$executeRawUnsafe(`INSERT INTO sfa_authority_fixture."User" VALUES ('owner','FREE')`);
  await prisma.$executeRawUnsafe(`INSERT INTO sfa_members (id,"organizationId","userId",role,status) VALUES ('member','org','actor','member','ACTIVE'),('owner-member','org','owner','owner','ACTIVE')`);
  await prisma.$executeRawUnsafe(`INSERT INTO sfa_pipelines (id,"organizationId",name,"isDefault") VALUES ('pipeline','org','Synthetic',TRUE)`);
  await prisma.$executeRawUnsafe(`INSERT INTO sfa_stages (id,"pipelineId",name,"order",probability,color,"isWon","isLost") VALUES ('open','pipeline','Open',0,50,'#123456',FALSE,FALSE),('won','pipeline','Won',1,100,'#123456',TRUE,FALSE),('lost','pipeline','Lost',2,0,'#123456',FALSE,TRUE)`);
  const authority=load('src/lib/sfa/mutation-authority.ts'),receipt=load('src/lib/sfa/creation-receipt.ts',{'node:crypto':crypto,'./mutation-authority':authority});
  const helper=load('src/lib/sfa/deal-mutation.ts',{'./mutation-authority':authority,'./amount':load('src/lib/sfa/amount.ts')});
  function api(db=prisma){
   db=new Proxy(db,{get(target,key){if(key==='$transaction')return async(...args)=>{try{return await target.$transaction(...args)}catch(e){dbErrors.push({code:e.code,sqlState:e.meta?.code});throw e}};const v=target[key];return typeof v==='function'?v.bind(target):v}});
   const limits=load('src/lib/sfa/limits.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'@/lib/plan-utils':{tierFrom:()=> 'FREE'}});
   const mocks={'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'@/lib/sfa/access':{getSfaContext:async()=>({organizationId:'org',userId:'actor',memberId:'member'}),orgSlugFrom:()=> 'alpha'},'@/lib/sfa/limits':limits,'@/lib/sfa/mutation-authority':authority,'@/lib/sfa/creation-receipt':receipt,'@/lib/sfa/deal-mutation':helper,'@/lib/sfa/format':load('src/lib/sfa/format.ts'),'@/lib/service-usage':{recordServiceUsage:async()=>{}}};
   const collection=load('src/app/api/sfa/deals/route.ts',mocks),detail=load('src/app/api/sfa/deals/[id]/route.ts',mocks);
   const request=(body,query='')=>({url:'https://example.invalid/api/sfa/deals'+query,json:async()=>body});
   return {post:body=>collection.POST(request(body)),cancel:()=>collection.DELETE(request(null,'?operationId='+op)),recover:()=>collection.GET(request(null,'?operationId='+op)),patch:(id,body)=>detail.PATCH(request(body),{params:Promise.resolve({id})})};
  }
  const routes=api(),reset=async()=>{await prisma.$executeRawUnsafe('TRUNCATE sfa_authority_fixture."SystemSetting", sfa_authority_fixture.sfa_deals');await prisma.$executeRawUnsafe("UPDATE sfa_members SET status='ACTIVE'")};
  await reset();{
   const rs=await Promise.all(Array.from({length:12},()=>routes.post({name:'Concurrent receipt',operationId:op})));assert.ok(rs.every(r=>r.status===200),JSON.stringify(rs.map(r=>r.status)));assert.equal(await prisma.sfaDeal.count(),1);assert.equal(await prisma.systemSetting.count(),1);results.push('12 real Serializable concurrent replays return one deal and one receipt');
  }
  await reset();{
   const row=(await(await routes.post({name:'Versions'})).json()).deal;
   const rs=await Promise.all(['A','B'].map(name=>routes.patch(row.id,{name,expectedUpdatedAt:row.updatedAt})));assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);results.push('Concurrent same-version PATCH commits one and rejects one stale update');
  }
  await reset();{
   const locked=deferred(),release=deferred();const revoke=prisma.$transaction(async tx=>{await tx.$executeRawUnsafe("UPDATE sfa_members SET status='INACTIVE' WHERE id='member'");locked.resolve();await release.promise});await locked.promise;
   const write=routes.post({name:'Revoked'});try{await waitForLock()}finally{release.resolve()}await revoke;assert.equal((await write).status,403);assert.equal(await prisma.sfaDeal.count(),0);results.push('Creation observes real membership lock wait and denies committed revocation');
  }
  await reset();{
   const barrier=deferred(),release=deferred();let held=false;
   const wrapped={$transaction:(fn,options)=>prisma.$transaction(tx=>fn(new Proxy(tx,{get(target,key){if(key==='systemSetting')return new Proxy(target.systemSetting,{get(model,method){if(method==='findUnique')return async args=>{if(!held){held=true;barrier.resolve();await release.promise}return model.findUnique(args)};const v=model[method];return typeof v==='function'?v.bind(model):v}});const v=target[key];return typeof v==='function'?v.bind(target):v}})),options)};
   // Creation already holds receipt lock; cancellation must return found and never delete.
   const creation=api(wrapped).post({name:'Create wins',operationId:op});await barrier.promise;const cancellation=routes.cancel();try{await waitForLock()}finally{release.resolve()}assert.equal((await creation).status,200);assert.equal((await(await cancellation).json()).state,'found');assert.equal(await prisma.sfaDeal.count(),1);results.push('Creation holds actual receipt lock; later cancellation returns found without deleting');
  }
  await reset();{
   const keyRows=await routes.cancel();assert.equal((await keyRows.json()).state,'cancelled');assert.equal((await routes.post({name:'Late',operationId:op})).status,409);assert.equal(await prisma.sfaDeal.count(),0);results.push('Committed cancellation fences late original creation');
  }
  await reset();{
   const barrier=deferred(),release=deferred();let held=false;
   const wrapped={$transaction:(fn,options)=>prisma.$transaction(tx=>fn(new Proxy(tx,{get(target,key){if(key==='$queryRaw')return async(strings,...values)=>{if(strings.join('').includes('sfa_members')&&!held){held=true;barrier.resolve();await release.promise}return target.$queryRaw(strings,...values)};const v=target[key];return typeof v==='function'?v.bind(target):v}})),options)};
   // The quota wrapper has read owner/plan and established a Serializable snapshot
   // before actor/receipt locking. A later cancellation must still defeat creation.
   const creation=api(wrapped).post({name:'Snapshot race',operationId:op});await barrier.promise;assert.equal((await(await routes.cancel()).json()).state,'cancelled');release.resolve();
   const r=await creation;assert.equal(r.status,409,await r.text());assert.equal(await prisma.sfaDeal.count(),0);results.push('Cancellation after initial Serializable snapshot still fences original creation');
  }
  await reset();{
   await prisma.$executeRawUnsafe(`INSERT INTO sfa_deals (id,"organizationId",name) SELECT 'seed-' || n,'org','Synthetic' FROM generate_series(1,49) AS n`);
   const rs=await Promise.all(['A','B'].map(name=>routes.post({name,operationId:crypto.randomUUID()})));assert.deepEqual(rs.map(r=>r.status).sort(),[200,402]);assert.equal(await prisma.sfaDeal.count(),50);assert.equal(await prisma.systemSetting.count(),1);results.push('Two real concurrent last-slot creations admit one and reject one without orphan receipt');
  }
  await reset();{
   let row=(await(await routes.post({name:'Dates',stageId:'won'})).json()).deal;const wonAt=row.wonAt;
   row=(await(await routes.patch(row.id,{stageId:'won',expectedUpdatedAt:row.updatedAt})).json()).deal;assert.equal(row.wonAt,wonAt);
   row=(await(await routes.patch(row.id,{stageId:'lost',expectedUpdatedAt:row.updatedAt})).json()).deal;assert.equal(row.wonAt,null);assert.ok(row.lostAt);
   row=(await(await routes.patch(row.id,{stageId:'open',expectedUpdatedAt:row.updatedAt})).json()).deal;assert.equal(row.wonAt,null);assert.equal(row.lostAt,null);results.push('Actual persisted stage outcomes preserve same-result timestamp and clear opposite outcomes');
  }
  await reset();{
   await prisma.$executeRawUnsafe(`ALTER TABLE sfa_authority_fixture."SystemSetting" ADD CONSTRAINT reject_receipt CHECK (value = 'blocked')`);
   assert.equal((await routes.post({name:'Rollback',operationId:op})).status,500);assert.equal(await prisma.sfaDeal.count(),0);assert.equal(await prisma.systemSetting.count(),0);
   await prisma.$executeRawUnsafe('ALTER TABLE sfa_authority_fixture."SystemSetting" DROP CONSTRAINT reject_receipt');assert.equal((await routes.post({name:'Rollback',operationId:op})).status,200);results.push('Actual receipt constraint failure rolls back business creation; same operation may succeed later');
  }
  await reset();{
   const row=(await(await routes.post({name:'Deleted',operationId:op})).json()).deal;await prisma.sfaDeal.update({where:{id:row.id},data:{isActive:false}});
   assert.equal((await routes.post({name:'Deleted',operationId:op})).status,409);assert.equal((await(await routes.recover()).json()).state,'unavailable');assert.equal((await(await routes.cancel()).json()).state,'unavailable');assert.equal(await prisma.sfaDeal.count(),1);results.push('Soft-deleted actual deal keeps receipt and cannot be resurrected by replay/cancellation');
  }
  await reset();{
   const row=(await(await routes.post({name:'Revoked edit'})).json()).deal;const ready=deferred(),release=deferred();
   const revoke=prisma.$transaction(async tx=>{await tx.$executeRawUnsafe("UPDATE sfa_members SET status='INACTIVE' WHERE id='member'");ready.resolve();await release.promise});await ready.promise;
   const writing=routes.patch(row.id,{name:'Denied',expectedUpdatedAt:row.updatedAt});try{await waitForLock()}finally{release.resolve()}await revoke;assert.equal((await writing).status,403);assert.equal((await prisma.sfaDeal.findUnique({where:{id:row.id}})).name,'Revoked edit');results.push('Actual PATCH waits for membership revocation and refuses write');
  }
  const files=['src/app/api/sfa/deals/route.ts','src/app/api/sfa/deals/[id]/route.ts','src/lib/sfa/deal-mutation.ts','src/lib/sfa/creation-receipt.ts','src/lib/sfa/limits.ts'];
  fs.writeFileSync(base+'sfa-deal-postgres-results.json',JSON.stringify({checkedAt:new Date().toISOString(),passed:results.length,cases:results,lockWaitObservations:waits,sourceHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),scope:'Actual handlers/helpers and generated Prisma against private Unix-socket-only PostgreSQL17 synthetic schema/data. Real Serializable snapshots, Lock waits, commits and conflicts; no production DB, provider, complete production schema/FK or private browser proof.'},null,2)+'\n');console.log(JSON.stringify({passed:results.length,lockWaitObservations:waits}));
 } finally {console.log(JSON.stringify({dbErrors}));await prisma.$disconnect()}
})().catch(e=>{console.error(e);process.exitCode=1});
