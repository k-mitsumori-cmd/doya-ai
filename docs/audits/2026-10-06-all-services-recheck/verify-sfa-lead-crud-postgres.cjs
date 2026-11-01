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
  const mutation=load('src/lib/sfa/lead-mutation.ts',{'./mutation-authority':authority,'./deal-mutation':stage});
  const batch=load('src/lib/sfa/lead-import.ts',{'node:crypto':crypto,'./mutation-authority':authority,'./creation-receipt':receipt});
  function api(db=prisma){
   const limits=load('src/lib/sfa/limits.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'@/lib/plan-utils':{tierFrom:()=> 'FREE'}});
   const mocks={'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'@/lib/sfa/access':{getSfaContext:async()=>({organizationId:'org',userId:'actor',memberId:'member'}),orgSlugFrom:()=> 'alpha'},'@/lib/sfa/limits':limits,'@/lib/sfa/mutation-authority':authority,'@/lib/sfa/creation-receipt':receipt,'@/lib/sfa/deal-mutation':stage,'@/lib/sfa/lead-mutation':mutation,'@/lib/sfa/lead-import':batch,'@/lib/sfa/format':load('src/lib/sfa/format.ts')};
   const list=load('src/app/api/sfa/leads/route.ts',mocks),detail=load('src/app/api/sfa/leads/[id]/route.ts',mocks),imports=load('src/app/api/sfa/leads/import/route.ts',mocks);
   const req=(body,query='')=>({url:'https://example.invalid/api/sfa/leads'+query,json:async()=>body}),ctx={params:Promise.resolve({id:'lead'})};
   return {post:body=>list.POST(req(body)),patch:body=>detail.PATCH(req(body),ctx),del:version=>detail.DELETE(req(null,'?expectedUpdatedAt='+encodeURIComponent(version)),ctx),import:body=>imports.POST(req(body)),cancelImport:()=>imports.DELETE(req(null,'?operationId='+op)),recoverImport:()=>imports.GET(req(null,'?operationId='+op))};
  }
  const routes=api(),reset=async()=>{await prisma.$executeRawUnsafe('TRUNCATE sfa_authority_fixture."SystemSetting",sfa_authority_fixture.sfa_leads');await prisma.$executeRawUnsafe("UPDATE sfa_members SET status='ACTIVE'");await prisma.$executeRawUnsafe(`INSERT INTO sfa_leads(id,"organizationId",name,"contactName") VALUES ('lead','org','Synthetic lead','Contact')`);};
  const pause=(onQuery)=>{const reached=deferred(),release=deferred();let held=false;const db={$transaction:(fn,options)=>prisma.$transaction(tx=>fn(new Proxy(tx,{get(target,key){if(onQuery&&key==='$queryRaw')return async(strings,...values)=>{if(strings.join('').includes('sfa_members')&&!held){held=true;reached.resolve();await release.promise}return target.$queryRaw(strings,...values)};if(!onQuery&&key==='systemSetting')return new Proxy(target.systemSetting,{get(model,method){if(method==='findUnique')return async args=>{if(!held&&args.where.key.startsWith('sfa-create:')){held=true;reached.resolve();await release.promise}return model.findUnique(args)};const v=model[method];return typeof v==='function'?v.bind(model):v}});const v=target[key];return typeof v==='function'?v.bind(target):v}})),options)};return{db,reached,release};};
  await reset();{
   const rs=await Promise.all(Array.from({length:12},()=>routes.post({name:'Created',operationId:op})));assert.ok(rs.every(r=>r.status===200),JSON.stringify(rs.map(r=>r.status)));const bodies=await Promise.all(rs.map(r=>r.json()));assert.equal(new Set(bodies.map(r=>r.lead.id)).size,1);assert.equal(await prisma.sfaLead.count(),2);assert.equal(await prisma.systemSetting.count(),1);results.push('12 actual Serializable concurrent manual creations replay one exact lead and receipt');
  }
  await reset();{
   const body={operationId:op,source:'csv',rows:[{name:'A'},{name:'B'}]};const rs=await Promise.all(Array.from({length:10},()=>routes.import(body)));assert.ok(rs.every(r=>r.status===200),JSON.stringify(rs.map(r=>r.status)));assert.equal(await prisma.sfaLead.count(),3);assert.equal(await prisma.systemSetting.count(),2);const recovered=await(await routes.recoverImport()).json();assert.equal(recovered.state,'found');assert.equal(recovered.import.imported,2);results.push('10 real concurrent batch imports create one row set, one result marker and one receipt');
  }
  await reset();{
   const before=await prisma.sfaLead.findUnique({where:{id:'lead'}}),version=before.updatedAt.toISOString();const rs=await Promise.all(['A','B'].map(note=>routes.patch({note,expectedUpdatedAt:version})));assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);const row=await prisma.sfaLead.findUnique({where:{id:'lead'}});assert.ok(row.updatedAt.getTime()>before.updatedAt.getTime());assert.ok(['A','B'].includes(row.note));results.push('Concurrent same-version PATCH admits one and persists monotonically newer version');
  }
  await reset();{
   const before=await prisma.sfaLead.findUnique({where:{id:'lead'}});await routes.patch({note:'Newer',expectedUpdatedAt:before.updatedAt.toISOString()});assert.equal((await routes.del(before.updatedAt.toISOString())).status,409);assert.equal((await prisma.sfaLead.findUnique({where:{id:'lead'}})).isActive,true);results.push('Stale DELETE cannot remove a lead edited after review');
  }
  await reset();{
   const before=await prisma.sfaLead.findUnique({where:{id:'lead'}});const held=deferred(),release=deferred();const revoke=prisma.$transaction(async tx=>{await tx.$executeRawUnsafe("UPDATE sfa_members SET status='INACTIVE' WHERE id='member'");held.resolve();await release.promise});await held.promise;
   const writes=[routes.post({name:'Denied',operationId:op}),routes.patch({note:'Denied',expectedUpdatedAt:before.updatedAt.toISOString()}),routes.del(before.updatedAt.toISOString()),routes.import({operationId:op,rows:[{name:'Denied'}]})];try{await waitForLock()}finally{release.resolve()}await revoke;const rs=await Promise.all(writes);assert.ok(rs.every(r=>r.status===403),JSON.stringify(rs.map(r=>r.status)));assert.equal(await prisma.sfaLead.count(),1);assert.equal(await prisma.systemSetting.count(),0);const lead=await prisma.sfaLead.findUnique({where:{id:'lead'}});assert.equal(lead.isActive,true);assert.equal(lead.note,null);results.push('All four actual writes wait behind actor revocation then reject without mutation');
  }
  await reset();{
   const gate=pause(true);const writing=api(gate.db).import({operationId:op,rows:[{name:'Late'}]});await gate.reached.promise;assert.equal((await(await routes.cancelImport()).json()).state,'cancelled');gate.release.resolve();assert.equal((await writing).status,409);assert.equal(await prisma.sfaLead.count(),1);assert.equal(await prisma.systemSetting.count(),1);results.push('Cancellation after initial Serializable snapshot fences batch and rolls back result marker plus rows');
  }
  await reset();{
   const gate=pause(false);const writing=api(gate.db).import({operationId:op,rows:[{name:'A'},{name:'B'}]});await gate.reached.promise;const cancellation=routes.cancelImport();try{await waitForLock()}finally{gate.release.resolve()}assert.equal((await writing).status,200);const result=await(await cancellation).json();assert.equal(result.state,'found');assert.equal(result.import.imported,2);assert.equal(await prisma.sfaLead.count(),3);results.push('Cancellation waits behind committed batch and returns result without deleting rows');
  }
  await reset();{
   await prisma.$executeRawUnsafe(`ALTER TABLE sfa_authority_fixture."SystemSetting" ADD CONSTRAINT reject_receipt CHECK(key NOT LIKE 'sfa-create:v1:%')`);assert.equal((await routes.import({operationId:op,rows:[{name:'Rollback'}]})).status,500);assert.equal(await prisma.sfaLead.count(),1);assert.equal(await prisma.systemSetting.count(),0);await prisma.$executeRawUnsafe('ALTER TABLE sfa_authority_fixture."SystemSetting" DROP CONSTRAINT reject_receipt');assert.equal((await routes.import({operationId:op,rows:[{name:'Rollback'}]})).status,200);results.push('Real receipt constraint failure rolls back earlier batch result marker and inserted row set');
  }
  await reset();{
   const r=await routes.import({operationId:op,rows:[{name:'Good'},{name:'x'.repeat(201)}]});assert.equal(r.status,400);assert.equal(await prisma.sfaLead.count(),1);assert.equal(await prisma.systemSetting.count(),0);results.push('Overlong second CSV row prevents entire actual import with no silent truncation');
  }
  await reset();{
   await routes.import({operationId:op,rows:[{name:'Imported'}]});await prisma.sfaLead.updateMany({where:{name:'Imported'},data:{isActive:false}});assert.equal((await(await routes.recoverImport()).json()).state,'unavailable');assert.equal((await routes.import({operationId:op,rows:[{name:'Imported'}]})).status,409);assert.equal(await prisma.sfaLead.count(),2);results.push('Batch recovery cannot resurrect soft-deleted imported rows');
  }
  const files=['src/app/api/sfa/leads/route.ts','src/app/api/sfa/leads/[id]/route.ts','src/app/api/sfa/leads/import/route.ts','src/lib/sfa/lead-mutation.ts','src/lib/sfa/lead-import.ts','src/lib/sfa/creation-receipt.ts','src/lib/sfa/limits.ts'];
  fs.writeFileSync(base+'sfa-lead-crud-postgres-results.json',JSON.stringify({checkedAt:new Date().toISOString(),passed:results.length,cases:results,lockWaitObservations:waits,sourceHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),scope:'Actual handlers/helpers and generated Prisma against private Unix-socket-only PostgreSQL17 synthetic schema/data. Real Serializable snapshots, row/advisory locks, conflicts and rollback. No production schema/FK completeness, customer/provider writes or mounted browser proof.'},null,2)+'\n');console.log(JSON.stringify({passed:results.length,lockWaitObservations:waits}));
 }finally{await prisma.$disconnect()}
})().catch(e=>{console.error(e);process.exitCode=1});
