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
  ];
  sqls.push('ALTER TABLE sfa_authority_fixture.sfa_accounts ADD COLUMN "corporateNumber" TEXT, ADD COLUMN industry TEXT, ADD COLUMN prefecture TEXT, ADD COLUMN address TEXT, ADD COLUMN url TEXT, ADD COLUMN "employeeCount" INT, ADD COLUMN capital BIGINT, ADD COLUMN "creditRank" TEXT, ADD COLUMN "ownerMemberId" TEXT, ADD COLUMN tags JSONB, ADD COLUMN note TEXT, ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP, ADD COLUMN "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP');
  sqls.push('CREATE TABLE sfa_authority_fixture.sfa_contacts (id TEXT PRIMARY KEY,"organizationId" TEXT,"accountId" TEXT,name TEXT,"nameKana" TEXT,title TEXT,department TEXT,email TEXT,phone TEXT,"isKeyPerson" BOOLEAN DEFAULT FALSE,note TEXT,"isActive" BOOLEAN DEFAULT TRUE,"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP)');
  sqls.push('CREATE TABLE sfa_authority_fixture.sfa_leads (id TEXT PRIMARY KEY,"organizationId" TEXT,name TEXT,"corporateNumber" TEXT,"contactName" TEXT,email TEXT,phone TEXT,status TEXT DEFAULT \'new\',score INT,source TEXT DEFAULT \'manual\',"assigneeMemberId" TEXT,"convertedAccountId" TEXT,note TEXT,raw JSONB,"isActive" BOOLEAN DEFAULT TRUE,"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP)');
  for(const sql of sqls)await prisma.$executeRawUnsafe(sql);
  await prisma.$executeRawUnsafe(`INSERT INTO sfa_authority_fixture."User" VALUES ('owner','FREE')`);
  await prisma.$executeRawUnsafe(`INSERT INTO sfa_members (id,"organizationId","userId",role,status) VALUES ('member','org','actor','member','ACTIVE'),('owner-member','org','owner','owner','ACTIVE')`);
  await prisma.$executeRawUnsafe(`INSERT INTO sfa_pipelines (id,"organizationId",name,"isDefault") VALUES ('pipeline','org','Synthetic',TRUE)`);
  await prisma.$executeRawUnsafe(`INSERT INTO sfa_stages (id,"pipelineId",name,"order",probability,color,"isWon","isLost") VALUES ('open','pipeline','Open',0,50,'#123456',FALSE,FALSE),('won','pipeline','Won',1,100,'#123456',TRUE,FALSE),('lost','pipeline','Lost',2,0,'#123456',FALSE,TRUE)`);
  const authority=load('src/lib/sfa/mutation-authority.ts'),receipt=load('src/lib/sfa/creation-receipt.ts',{'node:crypto':crypto,'./mutation-authority':authority}),amount=load('src/lib/sfa/amount.ts');
  const version=load('src/lib/sfa/deal-mutation.ts',{'./mutation-authority':authority,'./amount':amount});
  function api(kind,db=prisma,organizationId='org'){
   const limits=load('src/lib/sfa/limits.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'@/lib/plan-utils':{tierFrom:()=> 'FREE'}});
   const helper=load('src/lib/sfa/crm-record-mutation.ts',{'./mutation-authority':authority,'./creation-receipt':receipt,'./limits':limits,'./deal-mutation':version});
   const access={getSfaContext:async()=>({organizationId,userId:'actor',memberId:organizationId==='org'?'member':'other-member'}),orgSlugFrom:()=> 'alpha'};
   const http=load('src/lib/sfa/crm-record-http.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'./access':access,'./format':load('src/lib/sfa/format.ts'),'./mutation-authority':authority,'./limits':limits,'./crm-record-mutation':helper});
   const mocks={'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'@/lib/sfa/access':access,'@/lib/sfa/crm-record-http':http};
   const collection=load('src/app/api/sfa/'+kind+'s/route.ts',mocks),detail=load('src/app/api/sfa/'+kind+'s/[id]/route.ts',mocks);
   const dealRoute=load('src/app/api/sfa/deals/[id]/route.ts',{...mocks,'@/lib/sfa/format':load('src/lib/sfa/format.ts'),'@/lib/sfa/deal-mutation':version,'@/lib/sfa/mutation-authority':authority});
   const req=(method,body,query='')=>new Request('https://local.test/api/sfa/'+kind+'s'+query,{method,...(body!==undefined?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
   const ctx=id=>({params:Promise.resolve({id})});
   return {unlinkDeal:(id,expectedUpdatedAt)=>dealRoute.PATCH(req('PATCH',{contactId:null,expectedUpdatedAt}),ctx(id)),create:body=>collection.POST(req('POST',body)),recover:()=>collection.GET(req('GET',undefined,'?operationId='+op)),cancel:()=>collection.DELETE(req('DELETE',undefined,'?operationId='+op)),get:id=>detail.GET(req('GET'),ctx(id)),patch:(id,body)=>detail.PATCH(req('PATCH',body),ctx(id)),del:(id,stamp)=>detail.DELETE(req('DELETE',undefined,'?expectedUpdatedAt='+encodeURIComponent(stamp)),ctx(id))};
  }
  const reset=async()=>{await prisma.$executeRawUnsafe('TRUNCATE sfa_authority_fixture."SystemSetting",sfa_authority_fixture.sfa_accounts,sfa_authority_fixture.sfa_contacts,sfa_authority_fixture.sfa_deals');await prisma.$executeRawUnsafe("UPDATE sfa_members SET status='ACTIVE'");};
  const pause=(beforeActor)=>{const reached=deferred(),release=deferred();let held=false;const db={$transaction:(fn,opts)=>prisma.$transaction(tx=>fn(new Proxy(tx,{get(target,key){
    if(beforeActor&&key==='$queryRaw')return async(strings,...values)=>{if(strings.join('').includes('sfa_members')&&!held){held=true;reached.resolve();await release.promise;}return target.$queryRaw(strings,...values);};
    if(!beforeActor&&key==='systemSetting')return new Proxy(target.systemSetting,{get(model,method){if(method==='findUnique')return async args=>{if(!held){held=true;reached.resolve();await release.promise;}return model.findUnique(args);};const v=model[method];return typeof v==='function'?v.bind(model):v;}});
    const v=target[key];return typeof v==='function'?v.bind(target):v;}
   })),opts)};return{db,reached,release};};
  for(const kind of ['account','contact']){
   const routes=api(kind),model=kind==='account'?prisma.sfaAccount:prisma.sfaContact;
   await reset();{
    const responses=await Promise.all(Array.from({length:12},()=>routes.create({name:'Created',operationId:op})));assert.ok(responses.every(r=>r.status===200),JSON.stringify(responses.map(r=>r.status)));const bodies=await Promise.all(responses.map(r=>r.json()));assert.equal(new Set(bodies.map(b=>b[kind].id)).size,1);assert.equal(await model.count(),1);assert.equal(await prisma.systemSetting.count(),1);results.push(kind+':12 concurrent same UUID creations commit one row/receipt');
   }
   await reset();{
    const row=(await(await routes.create({name:'Original',operationId:op})).json())[kind];const responses=await Promise.all(['A','B'].map(name=>routes.patch(row.id,{name,expectedUpdatedAt:row.updatedAt})));assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);const saved=await model.findUnique({where:{id:row.id}});assert.ok(saved.updatedAt.toISOString()>row.updatedAt);assert.equal((await routes.del(row.id,row.updatedAt)).status,409);results.push(kind+':same reviewed version admits one PATCH; stale DELETE refuses');
   }
   await reset();{
    const row=(await(await routes.create({name:'Original',operationId:op})).json())[kind];await prisma.systemSetting.deleteMany();const held=deferred(),release=deferred();const revoke=prisma.$transaction(async tx=>{await tx.$executeRawUnsafe("UPDATE sfa_members SET status='INACTIVE' WHERE id='member'");held.resolve();await release.promise;});await held.promise;
    const writes=[routes.create({name:'Denied',operationId:op}),routes.patch(row.id,{name:'Denied',expectedUpdatedAt:row.updatedAt}),routes.del(row.id,row.updatedAt),routes.recover(),routes.cancel()];try{await waitForLock();}finally{release.resolve();}await revoke;const responses=await Promise.all(writes);assert.ok(responses.every(r=>r.status===403),JSON.stringify(responses.map(r=>r.status)));assert.equal(await model.count(),1);assert.equal(await prisma.systemSetting.count(),0);assert.equal((await model.findUnique({where:{id:row.id}})).isActive,true);results.push(kind+':create/PATCH/DELETE/recovery/cancel wait for revoked actor and refuse');
   }
   await reset();{
    const gate=pause(true),writing=api(kind,gate.db).create({name:'Late',operationId:op});await gate.reached.promise;assert.equal((await(await routes.cancel()).json()).state,'cancelled');gate.release.resolve();assert.equal((await writing).status,409);assert.equal(await model.count(),0);assert.equal(await prisma.systemSetting.count(),1);results.push(kind+':cancellation after old Serializable snapshot fences delayed create');
   }
   await reset();{
    const gate=pause(false),writing=api(kind,gate.db).create({name:'Saved',operationId:op});await gate.reached.promise;const cancelling=routes.cancel();try{await waitForLock();}finally{gate.release.resolve();}assert.equal((await writing).status,200);assert.equal((await(await cancelling).json()).state,'found');assert.equal(await model.count(),1);results.push(kind+':cancel waits behind receipt and preserves committed business row');
   }
   await reset();{
    await prisma.$executeRawUnsafe(`ALTER TABLE sfa_authority_fixture."SystemSetting" ADD CONSTRAINT reject_receipt CHECK(key NOT LIKE 'sfa-create:v1:%')`);assert.equal((await routes.create({name:'Rollback',operationId:op})).status,500);assert.equal(await model.count(),0);assert.equal(await prisma.systemSetting.count(),0);await prisma.$executeRawUnsafe('ALTER TABLE sfa_authority_fixture."SystemSetting" DROP CONSTRAINT reject_receipt');results.push(kind+':real receipt constraint failure rolls back business insert');
   }
   await reset();{
    const row=(await(await routes.create({name:'Original',operationId:op})).json())[kind];assert.equal((await routes.del(row.id,row.updatedAt)).status,200);assert.equal((await(await routes.recover()).json()).state,'unavailable');assert.equal((await routes.create({name:'Original',operationId:op})).status,409);assert.equal(await model.count(),1);results.push(kind+':deleted record cannot be recreated by replay');
   }
  }
  await reset();{
   const routes=api('account');for(let i=0;i<49;i++)await prisma.sfaAccount.create({data:{organizationId:'org',name:'Existing '+i}});
   const responses=await Promise.all([op,'10000000-0000-4000-8000-000000000002'].map(operationId=>routes.create({name:'New',operationId})));assert.deepEqual(responses.map(r=>r.status).sort(),[200,402]);assert.equal(await prisma.sfaAccount.count({where:{isActive:true}}),50);const savedIndex=responses.findIndex(r=>r.status===200),saved=(await responses[savedIndex].json()).account;const receiptRow=await prisma.systemSetting.findFirst();const first=JSON.parse(receiptRow.value);assert.equal(first.id,saved.id);
   const winningId=[op,'10000000-0000-4000-8000-000000000002'][savedIndex],replay=await routes.create({name:'New',operationId:winningId});assert.equal(replay.status,200);assert.equal((await replay.json()).account.id,saved.id);assert.equal(await prisma.sfaAccount.count({where:{isActive:true}}),50);assert.equal(await prisma.systemSetting.count(),1);results.push('account:concurrent different UUID at49 admits one, never exceeds50, and winning UUID replays at capacity');
  }
  await reset();{
   const account=await prisma.sfaAccount.create({data:{organizationId:'org',name:'Account'}}),held=deferred(),release=deferred();
   const inactive=prisma.$transaction(async tx=>{await tx.sfaAccount.update({where:{id:account.id},data:{isActive:false}});held.resolve();await release.promise;});await held.promise;
   const writing=api('contact').create({name:'Contact',accountId:account.id,operationId:op});try{await waitForLock();}finally{release.resolve();}await inactive;assert.equal((await writing).status,400);assert.equal(await prisma.sfaContact.count(),0);assert.equal(await prisma.systemSetting.count(),0);results.push('contact:create waits for account deactivation and rejects without receipt');
  }
  await reset();{
   const account=(await(await api('account').create({name:'Account',operationId:op})).json()).account;
   const contact=await prisma.sfaContact.create({data:{organizationId:'org',accountId:account.id,name:'Contact'}});assert.equal((await api('account').del(account.id,account.updatedAt)).status,409);await prisma.sfaContact.update({where:{id:contact.id},data:{isActive:false}});assert.equal((await api('account').del(account.id,account.updatedAt)).status,200);assert.equal(await prisma.sfaContact.count(),1);results.push('account:linked active contact prevents delete; inactive history remains');
  }
  await reset();{
   const contact=(await(await api('contact').create({name:'Contact',operationId:op})).json()).contact;
   const deal=await prisma.sfaDeal.create({data:{organizationId:'org',contactId:contact.id,name:'Deal',contactName:'Keep name',note:'Keep history',amount:123n}});assert.equal((await api('contact').del(contact.id,contact.updatedAt)).status,409);assert.equal((await prisma.sfaContact.findUnique({where:{id:contact.id}})).isActive,true);results.push('contact:linked active deal prevents deletion without changing history');
   const routes=api('contact');assert.equal((await routes.unlinkDeal(deal.id,undefined)).status,400);assert.equal((await routes.unlinkDeal(deal.id,'1999-01-01T00:00:00.000Z')).status,409);assert.equal((await routes.unlinkDeal(deal.id,deal.updatedAt.toISOString())).status,200);const saved=await prisma.sfaDeal.findUnique({where:{id:deal.id}});assert.equal(saved.contactId,null);assert.equal(saved.contactName,'Keep name');assert.equal(saved.note,'Keep history');assert.equal(saved.name,'Deal');assert.equal(saved.amount,123n);assert.equal(saved.isActive,true);assert.ok(saved.updatedAt>deal.updatedAt);assert.equal((await routes.del(contact.id,contact.updatedAt)).status,200);assert.equal(await prisma.sfaDeal.count(),1);results.push('contact:explicit reviewed unlink preserves live deal/name/note/amount and then permits contact soft delete');
  }
  const files=['src/lib/sfa/crm-record-mutation.ts','src/lib/sfa/crm-record-http.ts','src/lib/sfa/creation-receipt.ts','src/lib/sfa/limits.ts','src/lib/sfa/deal-mutation.ts','src/app/api/sfa/deals/[id]/route.ts','src/app/api/sfa/accounts/route.ts','src/app/api/sfa/accounts/[id]/route.ts','src/app/api/sfa/contacts/route.ts','src/app/api/sfa/contacts/[id]/route.ts'];
  fs.writeFileSync(base+'sfa-crm-postgres-results.json',JSON.stringify({checkedAt:new Date().toISOString(),passed:results.length,cases:results,lockWaitObservations:waits,sourceHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),scope:'Actual CRM handlers/helpers and Prisma against Unix-socket-only private PostgreSQL17 synthetic schema/data. Real Serializable snapshots, quota, row/advisory lock scheduling and rollback. Does not prove production FK/schema completeness or authenticated real-browser interactions.'},null,2)+'\n');console.log(JSON.stringify({passed:results.length,lockWaitObservations:waits}));
 }finally{await prisma.$disconnect()}
})().catch(e=>{console.error(e);process.exitCode=1});
