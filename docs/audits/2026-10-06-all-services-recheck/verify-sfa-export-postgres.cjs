const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {PrismaClient}=require('@prisma/client'),{load}=require('../../../scripts/security-regression/load-typescript.cjs');
const base='docs/audits/2026-10-06-all-services-recheck/';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
(async()=>{
 const socket=process.env.DOYA_SFA_AUTHORITY_PG_SOCKET,port=Number(process.env.DOYA_SFA_AUTHORITY_PG_PORT);
 assert.match(socket||'',/^\/tmp\/doya-sfa-authority-[a-f0-9]{8}\/socket$/);assert.ok(port>1024&&port<65536);
 const prisma=new PrismaClient({datasources:{db:{url:`postgresql://doya_sfa@localhost:${port}/postgres?host=${encodeURIComponent(socket)}&schema=sfa_authority_fixture&connection_limit=12`}}});
 const results=[],waits=[];
 const deadline=setTimeout(()=>{console.error('Export PG probe did not finish all assertions');process.exit(1)},20000);
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

  const authority=load('src/lib/sfa/mutation-authority.ts');
  const route=db=>load('src/app/api/sfa/export/route.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'@/lib/sfa/mutation-authority':authority,'@/lib/sfa/access':{getSfaContext:async()=>({organizationId:'org',userId:'actor',memberId:'member'}),orgSlugFrom:()=> 'org'}},{TextEncoder,ReadableStream});
  const request=()=>new Request('https://local.test/api/sfa/export?type=accounts&org=org');
  const reset=async()=>{await prisma.$executeRawUnsafe("UPDATE sfa_members SET status='ACTIVE'");await prisma.$executeRawUnsafe('TRUNCATE sfa_accounts');await prisma.$executeRawUnsafe(`INSERT INTO sfa_accounts (id,"organizationId",name,"isActive") SELECT lpad(i::text,6,'0'),'org','Synthetic '||i,TRUE FROM generate_series(0,500) i`);};
  console.log('case start',results.length+1);await reset();{
   const held=deferred(),release=deferred();
   const revoke=prisma.$transaction(async tx=>{await tx.$executeRawUnsafe("UPDATE sfa_members SET status='INACTIVE' WHERE id='member'");held.resolve();await release.promise;});console.log('waiting for revoke transaction');await held.promise;console.log('revocation lock held');
   const download=route(prisma).GET(request());try{await waitForLock();}finally{release.resolve();}await revoke;assert.equal((await download).status,403);results.push('initial boundary read waits behind revocation and refuses with403');
  }
  console.log('case start',results.length+1);await reset();{
   let transactions=0,reads=0;const held=deferred(),release=deferred();
   const db={$transaction:async(fn,opts)=>{transactions++;if(transactions===3){held.resolve();await release.promise;}return prisma.$transaction(tx=>fn(new Proxy(tx,{get(t,k){if(k==='sfaAccount')return new Proxy(t.sfaAccount,{get(m,p){if(p==='findMany')return async a=>{reads++;const page=await m.findMany(a);console.log('private page rows',page.length);return page};const v=m[p];return typeof v==='function'?v.bind(m):v}});const v=t[k];return typeof v==='function'?v.bind(t):v}})),opts)}};
   console.log('begin streaming GET');const response=await route(db).GET(request());console.log('stream response',response.status,transactions);if(response.status!==200)throw Error('Expected CSV200, got '+response.status+': '+await response.text());const reading=response.text();reading.catch(()=>{});console.log('waiting for revoke transaction');await held.promise;console.log('revocation lock held');await prisma.$executeRawUnsafe("UPDATE sfa_members SET status='INACTIVE' WHERE id='member'");release.resolve();await assert.rejects(reading,/CSV出力を完了できませんでした/);assert.equal(reads,1);results.push('revocation committed between batches stops before next private page query');
  }
  console.log('case start',results.length+1);await reset();{
   const held=deferred(),release=deferred();let paused=false;
   const db={$transaction:(fn,opts)=>prisma.$transaction(tx=>fn(new Proxy(tx,{get(t,k){if(k==='sfaAccount')return new Proxy(t.sfaAccount,{get(m,p){if(p==='findMany')return async a=>{if(!paused){paused=true;held.resolve();await release.promise;}const page=await m.findMany(a);console.log('private page rows',page.length);return page};const v=m[p];return typeof v==='function'?v.bind(m):v}});const v=t[k];return typeof v==='function'?v.bind(t):v}})),opts)};
   const downloading=route(db).GET(request());await held.promise;let revoked=false;const revoke=prisma.$executeRawUnsafe("UPDATE sfa_members SET status='INACTIVE' WHERE id='member'").then(()=>{revoked=true});try{await waitForLock();assert.equal(revoked,false)}finally{release.resolve();}const response=await downloading;await revoke;await assert.rejects(response.text(),/CSV出力を完了できませんでした/);results.push('authorized page holds shared membership lock; revocation waits until batch transaction ends');
  }
  const files=['src/app/api/sfa/export/route.ts','src/lib/sfa/mutation-authority.ts'];
  fs.writeFileSync(base+'sfa-export-postgres-results.json',JSON.stringify({checkedAt:new Date().toISOString(),passed:results.length,cases:results,lockWaitObservations:waits,sourceHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),scope:'Actual export route/authority helper and Prisma against private Unix-socket-only PostgreSQL synthetic schema. Proves membership lock ordering and per-batch revocation. No customer data, production writes or provider calls. Does not prove full production schema or browser download UI.'},null,2)+'\n');console.log(JSON.stringify({passed:results.length,lockWaitObservations:waits}));
 }finally{clearTimeout(deadline);await prisma.$disconnect()}
})().catch(e=>{console.error(e);process.exitCode=1});
