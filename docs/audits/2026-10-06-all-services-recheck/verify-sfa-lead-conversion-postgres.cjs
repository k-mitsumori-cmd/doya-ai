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
  const stage=load('src/lib/sfa/deal-mutation.ts',{'./mutation-authority':authority,'./amount':amount});
  const helper=load('src/lib/sfa/lead-conversion.ts',{'./mutation-authority':authority,'./amount':amount,'./deal-mutation':stage});
  function api(db=prisma){
   const limits=load('src/lib/sfa/limits.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'@/lib/plan-utils':{tierFrom:()=> 'FREE'}});
   const route=load('src/app/api/sfa/leads/[id]/convert/route.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'@/lib/sfa/access':{getSfaContext:async()=>({organizationId:'org',userId:'actor',memberId:'member'}),orgSlugFrom:()=> 'alpha'},'@/lib/sfa/limits':limits,'@/lib/sfa/mutation-authority':authority,'@/lib/sfa/creation-receipt':receipt,'@/lib/sfa/deal-mutation':stage,'@/lib/sfa/lead-conversion':helper,'@/lib/sfa/format':load('src/lib/sfa/format.ts')});
   const call=(method,id='lead',body={},operation=op)=>route[method]({url:'https://example.invalid/api/sfa/leads/'+id+'/convert?operationId='+operation,json:async()=>body},{params:Promise.resolve({id})});
   return{post:(body={},id='lead')=>call('POST',id,body),cancel:(id='lead')=>call('DELETE',id),recover:(id='lead')=>call('GET',id)};
  }
  const routes=api(),reset=async()=>{
   await prisma.$executeRawUnsafe('TRUNCATE sfa_authority_fixture."SystemSetting",sfa_authority_fixture.sfa_deals,sfa_authority_fixture.sfa_accounts,sfa_authority_fixture.sfa_contacts,sfa_authority_fixture.sfa_leads');
   await prisma.$executeRawUnsafe("UPDATE sfa_members SET status='ACTIVE'");
   await prisma.$executeRawUnsafe(`INSERT INTO sfa_leads (id,"organizationId",name,"contactName") VALUES ('lead','org','Synthetic lead','Contact'),('lead2','org','Second lead','Other')`);
   await prisma.$executeRawUnsafe('UPDATE sfa_stages SET "order"=CASE id WHEN \'open\' THEN 0 WHEN \'won\' THEN 1 ELSE 2 END');
  };
  const noPair=async()=>{assert.equal(await prisma.sfaAccount.count(),0);assert.equal(await prisma.sfaDeal.count(),0);assert.equal(await prisma.sfaContact.count(),0);assert.equal((await prisma.sfaLead.findUnique({where:{id:'lead'}})).status,'new');};
  const pauseQuery=(match)=>{const reached=deferred(),release=deferred();let held=false;return{reached,release,db:{$transaction:(fn,options)=>prisma.$transaction(tx=>fn(new Proxy(tx,{get(target,key){if(key==='$queryRaw')return async(strings,...values)=>{if(strings.join('').includes(match)&&!held){held=true;reached.resolve();await release.promise}return target.$queryRaw(strings,...values)};const v=target[key];return typeof v==='function'?v.bind(target):v}})),options)}}};
  await reset();{
   const rs=await Promise.all(Array.from({length:12},()=>routes.post({operationId:op})));assert.ok(rs.every(r=>r.status===200),JSON.stringify(rs.map(r=>r.status)));const bodies=await Promise.all(rs.map(r=>r.json()));assert.equal(new Set(bodies.map(r=>r.deal.id)).size,1);assert.equal(await prisma.sfaAccount.count(),1);assert.equal(await prisma.sfaContact.count(),1);assert.equal(await prisma.sfaDeal.count(),1);assert.equal(await prisma.systemSetting.count(),1);results.push('12 actual concurrent same-operation conversions return exactly one account/contact/deal pair and receipt');
  }
  await reset();{
   const rs=await Promise.all([crypto.randomUUID(),crypto.randomUUID()].map(operationId=>routes.post({operationId})));assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);assert.equal(await prisma.sfaAccount.count(),1);assert.equal(await prisma.sfaDeal.count(),1);assert.equal(await prisma.systemSetting.count(),1);results.push('Different-operation simultaneous conversion of same lead commits only one pair');
  }
  await reset();{
   const held=deferred(),release=deferred();const revoke=prisma.$transaction(async tx=>{await tx.$executeRawUnsafe("UPDATE sfa_members SET status='INACTIVE' WHERE id='member'");held.resolve();await release.promise});await held.promise;const writing=routes.post({operationId:op});try{await waitForLock()}finally{release.resolve()}await revoke;assert.equal((await writing).status,403);await noPair();results.push('Actual membership revocation lock wait rejects conversion with no business writes');
  }
  await reset();{
   const gate=pauseQuery('sfa_leads'),before=await prisma.sfaLead.findUnique({where:{id:'lead'}});const writing=api(gate.db).post({operationId:op,expectedUpdatedAt:before.updatedAt.toISOString()});await gate.reached.promise;await prisma.sfaLead.update({where:{id:'lead'},data:{name:'Changed externally',updatedAt:new Date(before.updatedAt.getTime()+1)}});gate.release.resolve();assert.equal((await writing).status,409);await noPair();results.push('Source change after initial Serializable snapshot retries then rejects reviewed stale version');
  }
  await reset();{
   const gate=pauseQuery('sfa_leads');const writing=api(gate.db).post({operationId:op});await gate.reached.promise;await prisma.sfaLead.update({where:{id:'lead'},data:{name:'Fresh source'}});gate.release.resolve();const r=await writing;assert.equal(r.status,200,await r.clone().text());assert.equal((await r.json()).account.name,'Fresh source');results.push('Legacy unversioned conversion uses fresh source after real Serializable conflict retry');
  }
  await reset();{
   assert.equal((await(await routes.cancel()).json()).state,'cancelled');assert.equal((await routes.post({operationId:op})).status,409);await noPair();results.push('Committed receipt cancellation fences late original conversion');
  }
  await reset();{
   const gate=pauseQuery('sfa_members');const writing=api(gate.db).post({operationId:op});await gate.reached.promise;assert.equal((await(await routes.cancel()).json()).state,'cancelled');gate.release.resolve();assert.equal((await writing).status,409);await noPair();results.push('Cancellation after initial Serializable snapshot still fences delayed conversion');
  }
  await reset();{
   const reached=deferred(),release=deferred();let held=false;
   const db={$transaction:(fn,options)=>prisma.$transaction(tx=>fn(new Proxy(tx,{get(target,key){if(key==='systemSetting')return new Proxy(target.systemSetting,{get(model,method){if(method==='findUnique')return async args=>{if(!held){held=true;reached.resolve();await release.promise}return model.findUnique(args)};const v=model[method];return typeof v==='function'?v.bind(model):v}});const v=target[key];return typeof v==='function'?v.bind(target):v}})),options)};
   const writing=api(db).post({operationId:op});await reached.promise;const cancelling=routes.cancel();try{await waitForLock()}finally{release.resolve()}assert.equal((await writing).status,200);const r=await cancelling;assert.equal((await r.json()).state,'found');assert.equal(await prisma.sfaAccount.count(),1);assert.equal(await prisma.sfaDeal.count(),1);results.push('Cancellation waits behind in-flight conversion receipt and returns committed exact pair');
  }
  await reset();{
   await prisma.$executeRawUnsafe(`INSERT INTO sfa_accounts(id,"organizationId",name) SELECT 'a-'||n,'org','Seed' FROM generate_series(1,49)n`);await prisma.$executeRawUnsafe(`INSERT INTO sfa_deals(id,"organizationId",name) SELECT 'd-'||n,'org','Seed' FROM generate_series(1,49)n`);
   const rs=await Promise.all(['lead','lead2'].map(id=>routes.post({operationId:crypto.randomUUID()},id)));assert.deepEqual(rs.map(r=>r.status).sort(),[200,402]);assert.equal(await prisma.sfaAccount.count(),50);assert.equal(await prisma.sfaDeal.count(),50);assert.equal(await prisma.sfaContact.count(),1);assert.equal(await prisma.systemSetting.count(),1);assert.equal(await prisma.sfaLead.count({where:{status:'converted'}}),1);results.push('Concurrent last-slot conversions admit one pair, preserve rejected source and avoid orphan receipt');
  }
  await reset();{
   await prisma.$executeRawUnsafe(`ALTER TABLE sfa_authority_fixture."SystemSetting" ADD CONSTRAINT reject_receipt CHECK(value='blocked')`);assert.equal((await routes.post({operationId:op})).status,500);await noPair();assert.equal(await prisma.systemSetting.count(),0);await prisma.$executeRawUnsafe('ALTER TABLE sfa_authority_fixture."SystemSetting" DROP CONSTRAINT reject_receipt');assert.equal((await routes.post({operationId:op})).status,200);results.push('Actual receipt constraint failure rolls back lead claim and account/contact/deal creation together');
  }
  await reset();{
   await prisma.$executeRawUnsafe('UPDATE sfa_stages SET "order"=CASE id WHEN \'won\' THEN -1 ELSE 2 END');const r=await routes.post({operationId:op});assert.equal(r.status,200);const b=await r.json();assert.equal(b.deal.status,'won');assert.ok(b.deal.wonAt);assert.equal(b.deal.lostAt,null);const existing=await prisma.sfaDeal.findUnique({where:{id:b.deal.id}});assert.equal(existing.status,'won');assert.ok(existing.wonAt);results.push('Actual conversion persists matching won default stage/status/timestamp');
  }
  await reset();{
   const b=await(await routes.post({operationId:op})).json();await prisma.sfaDeal.update({where:{id:b.deal.id},data:{isActive:false}});assert.equal((await(await routes.recover()).json()).state,'unavailable');assert.equal((await routes.post({operationId:op})).status,409);assert.equal(await prisma.sfaDeal.count(),1);assert.equal(await prisma.sfaAccount.count(),1);results.push('Unavailable exact conversion receipt never resurrects deleted deal');
  }
  const files=['src/app/api/sfa/leads/[id]/convert/route.ts','src/lib/sfa/lead-conversion.ts','src/lib/sfa/creation-receipt.ts','src/lib/sfa/limits.ts'];
  fs.writeFileSync(base+'sfa-lead-conversion-postgres-results.json',JSON.stringify({checkedAt:new Date().toISOString(),passed:results.length,cases:results,lockWaitObservations:waits,sourceHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),scope:'Actual conversion handlers/helpers/generated Prisma and private Unix-socket-only PostgreSQL17 synthetic schema/data. Real Serializable conflicts, receipt/authority row-lock waits and commits; not production schema/FK coverage or private production browser.'},null,2)+'\n');console.log(JSON.stringify({passed:results.length,lockWaitObservations:waits}));
 } finally {await prisma.$disconnect()}
})().catch(e=>{console.error(e);process.exitCode=1});
