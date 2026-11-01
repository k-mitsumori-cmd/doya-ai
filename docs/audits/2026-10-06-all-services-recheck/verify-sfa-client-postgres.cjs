const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {PrismaClient}=require('@prisma/client'),{load}=require('../../../scripts/security-regression/load-typescript.cjs');
const base='docs/audits/2026-10-06-all-services-recheck/';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
const pause=()=>new Promise(r=>setTimeout(r,100));
(async()=>{
 const socket=process.env.DOYA_SFA_AUTHORITY_PG_SOCKET,port=Number(process.env.DOYA_SFA_AUTHORITY_PG_PORT);
 assert.match(socket||'',/^\/tmp\/doya-sfa-authority-[a-f0-9]{8}\/socket$/);assert.ok(Number.isSafeInteger(port)&&port>1024&&port<65536);
 const prisma=new PrismaClient({datasources:{db:{url:`postgresql://doya_sfa@localhost:${port}/postgres?host=${encodeURIComponent(socket)}&schema=sfa_authority_fixture&connection_limit=12`}}});
 const lockWaitObservations=[];
 const waitForDatabaseLock=async()=>{
  for(let attempt=0;attempt<80;attempt++){
   const rows=await prisma.$queryRawUnsafe("SELECT count(*)::integer AS waiting FROM pg_stat_activity WHERE datname = current_database() AND usename = current_user AND wait_event_type = 'Lock'");
   if(rows[0].waiting>0){lockWaitObservations.push(rows[0].waiting);return}
   await new Promise(r=>setTimeout(r,25));
  }
  throw Error('Expected real PostgreSQL lock wait was not observed');
 };
 const sourceFiles=['src/lib/sfa/mutation-authority.ts','src/lib/sfa/creation-receipt.ts','src/app/api/sfa/tasks/route.ts','src/app/api/sfa/tasks/[id]/route.ts','src/app/api/sfa/activities/route.ts'];
 const hashes=()=>Object.fromEntries(sourceFiles.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));const initialHashes=hashes();
 try{
 const endpoint=await prisma.$queryRawUnsafe('SELECT inet_server_addr() AS address, current_user AS role');assert.equal(endpoint[0].address,null);assert.equal(endpoint[0].role,'doya_sfa');
 await prisma.$executeRawUnsafe('CREATE SCHEMA sfa_authority_fixture');
 for(const sql of [
  'CREATE TABLE sfa_authority_fixture."SystemSetting" (id TEXT PRIMARY KEY, key TEXT UNIQUE NOT NULL, value TEXT NOT NULL)',
  'CREATE TABLE sfa_authority_fixture.sfa_members (id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "userId" TEXT, role TEXT NOT NULL, status TEXT NOT NULL, name TEXT, "inviteEmail" TEXT, "inviteToken" TEXT, "acceptedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP)',
  'CREATE TABLE sfa_authority_fixture.sfa_tasks (id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, title TEXT NOT NULL, "dueDate" TIMESTAMP(3), status TEXT NOT NULL DEFAULT \'open\', priority TEXT NOT NULL DEFAULT \'normal\', "accountId" TEXT, "dealId" TEXT, "assigneeMemberId" TEXT, "completedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP)',
  'CREATE TABLE sfa_authority_fixture.sfa_activities (id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, type TEXT NOT NULL, "accountId" TEXT, "contactId" TEXT, "dealId" TEXT, subject TEXT, body TEXT, "occurredAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP, "durationMin" INT, "memberId" TEXT, "aiSummary" TEXT, "transcriptId" TEXT, "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP)',
  ...['sfa_accounts','sfa_contacts','sfa_deals'].map(table=>`CREATE TABLE sfa_authority_fixture.${table} (id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT TRUE, "lastActivityAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP)`),
 ])await prisma.$executeRawUnsafe(sql);
 const ctx={userId:'user',memberId:'member',organizationId:'org',organizationSlug:'alpha',role:'member'};
 const authority=load('src/lib/sfa/mutation-authority.ts');
 const receipts=load('src/lib/sfa/creation-receipt.ts',{'node:crypto':crypto,'./mutation-authority':authority});
 const definitions={'task-create':['src/app/api/sfa/tasks/route.ts','POST',{title:'synthetic'}],'task-update':['src/app/api/sfa/tasks/[id]/route.ts','PATCH',{}],'task-delete':['src/app/api/sfa/tasks/[id]/route.ts','DELETE',{}],'activity-create':['src/app/api/sfa/activities/route.ts','POST',{subject:'synthetic',dealId:'deal'}]};
 function api(db=prisma){return Object.fromEntries(Object.entries(definitions).map(([name,[file,method,body]])=>{const route=load(file,{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'@/lib/sfa/mutation-authority':authority,'@/lib/sfa/creation-receipt':receipts,'@/lib/sfa/access':{getSfaContext:async()=>({...ctx}),orgSlugFrom:()=> 'alpha'}});return[name,(input=body)=>route[method]({json:async()=>input,nextUrl:new URL('https://example.test/api')},{params:Promise.resolve({id:'task'})})]}))}
 const routes=api(),results=[];
 const reset=async()=>{
  await prisma.$executeRawUnsafe('TRUNCATE sfa_authority_fixture."SystemSetting", sfa_authority_fixture.sfa_tasks, sfa_authority_fixture.sfa_activities, sfa_authority_fixture.sfa_members, sfa_authority_fixture.sfa_deals, sfa_authority_fixture.sfa_accounts, sfa_authority_fixture.sfa_contacts');
  await prisma.$executeRaw`INSERT INTO sfa_members (id,"organizationId","userId",role,status) VALUES ('member','org','user','member','ACTIVE')`;
  await prisma.$executeRaw`INSERT INTO sfa_tasks (id,"organizationId",title) VALUES ('task','org','synthetic')`;
  await prisma.$executeRaw`INSERT INTO sfa_deals (id,"organizationId") VALUES ('deal','org')`;
 };
 for(const name of Object.keys(definitions)){
  await reset();const locked=deferred(),release=deferred();let settled=false;
  const revoke=prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM sfa_members WHERE id = 'member' FOR UPDATE`;await tx.$executeRaw`UPDATE sfa_members SET status = 'INACTIVE' WHERE id = 'member'`;locked.resolve();await release.promise});
  await locked.promise;const responsePromise=routes[name]().then(r=>{settled=true;return r});
  try{await waitForDatabaseLock();assert.equal(settled,false,'writer waits for membership revocation lock')}finally{release.resolve()}
  await revoke;const response=await responsePromise;assert.equal(response.status,403,name);
  assert.equal(await prisma.sfaTask.count(),1);assert.equal(await prisma.sfaActivity.count(),0);
  results.push({name:name+' waits and denies committed revocation',status:response.status});
 }
 await reset();{
  const ready=deferred(),release=deferred();let revoked=false;
  const wrapped={$transaction:fn=>prisma.$transaction(tx=>fn(new Proxy(tx,{get(target,key){if(key==='sfaTask')return new Proxy(target.sfaTask,{get(model,method){if(method==='create')return async args=>{ready.resolve();await release.promise;return model.create(args)};const value=model[method];return typeof value==='function'?value.bind(model):value}});const value=target[key];return typeof value==='function'?value.bind(target):value}})))};
  const writing=api(wrapped)['task-create']();await ready.promise;
  const revoke=prisma.$executeRaw`UPDATE sfa_members SET status = 'INACTIVE' WHERE id = 'member'`.then(()=>{revoked=true});
  try{await waitForDatabaseLock();assert.equal(revoked,false,'membership update must wait while writer holds share lock')}finally{release.resolve()}
  assert.equal((await writing).status,200);await revoke;assert.equal(await prisma.sfaTask.count(),2);
  results.push({name:'authorized write holds membership until commit; later revocation waits',status:200});
 }
 await reset();{
  const locked=deferred(),release=deferred();let settled=false;
  const deactivate=prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM sfa_deals WHERE id = 'deal' FOR UPDATE`;await tx.$executeRaw`UPDATE sfa_deals SET "isActive" = FALSE WHERE id = 'deal'`;locked.resolve();await release.promise});
  await locked.promise;const responsePromise=routes['activity-create']().then(r=>{settled=true;return r});
  try{await waitForDatabaseLock();assert.equal(settled,false)}finally{release.resolve()}
  await deactivate;assert.equal((await responsePromise).status,400);assert.equal(await prisma.sfaActivity.count(),0);
  results.push({name:'activity waits for deal lock and rejects freshly deactivated relation',status:400});
 }
 await reset();{
  const responses=await Promise.all(Array.from({length:20},()=>routes['task-update']()));
  assert.ok(responses.every(r=>r.status===200));assert.equal((await prisma.sfaTask.findUnique({where:{id:'task'}})).status,'open');
  results.push({name:'20 concurrent legacy toggles serialized without lost updates',requests:20,successes:20});
 }
 await reset();{
  const dates=Array.from({length:12},(_,i)=>new Date(Date.UTC(2026,9,1,0,i)).toISOString());
  const responses=await Promise.all(dates.map(occurredAt=>routes['activity-create']({subject:'synthetic',dealId:'deal',occurredAt})));
  assert.ok(responses.every(r=>r.status===200));assert.equal(await prisma.sfaActivity.count(),12);
  const rows=await prisma.$queryRaw`SELECT "lastActivityAt" FROM sfa_deals WHERE id = 'deal'`;assert.equal(rows[0].lastActivityAt.toISOString(),dates.at(-1));
  results.push({name:'12 concurrent same-deal activities commit without share-lock upgrade deadlocks; latest date retained',requests:12,successes:12});
 }

 const op='9de845c3-90b0-4a67-870c-3750e24fc653';
 const recoverRoute=load('src/app/api/sfa/tasks/route.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma},'@/lib/sfa/mutation-authority':authority,'@/lib/sfa/creation-receipt':receipts,'@/lib/sfa/access':{getSfaContext:async()=>({...ctx}),orgSlugFrom:()=> 'alpha'}});
 const recover=()=>recoverRoute.GET({url:'https://example.test/api?operationId='+op});
 for(const kind of ['task','activity']){
  await reset();const input=kind==='task'?{title:'receipt test',operationId:op}:{subject:'receipt test',dealId:'deal',operationId:op};
  const responses=await Promise.all(Array.from({length:12},()=>routes[kind+'-create'](input)));
  assert.ok(responses.every(r=>r.status===200));const ids=await Promise.all(responses.map(async r=>(await r.json())[kind].id));assert.equal(new Set(ids).size,1);
  assert.equal(await prisma.systemSetting.count(),1);assert.equal(await prisma[kind==='task'?'sfaTask':'sfaActivity'].count(),kind==='task'?2:1);
  results.push({name:kind+' 12 concurrent operation replays create exactly one row and receipt',requests:12});
  const conflict=await routes[kind+'-create']({...input,...(kind==='task'?{title:'changed'}:{subject:'changed'})});assert.equal(conflict.status,409);
  await prisma[kind==='task'?'sfaTask':'sfaActivity'].delete({where:{id:ids[0]}});
  assert.equal((await routes[kind+'-create'](input)).status,409);assert.equal(await prisma.systemSetting.count(),1);
  results.push({name:kind+' changed input conflicts and hard-deleted row cannot be resurrected'});
 }
 await reset();{
  const ready=deferred(),release=deferred();let recovered=false;
  const wrapped={$transaction:fn=>prisma.$transaction(tx=>fn(new Proxy(tx,{get(target,key){if(key==='sfaTask')return new Proxy(target.sfaTask,{get(model,method){if(method==='create')return async args=>{const row=await model.create(args);ready.resolve();await release.promise;return row};const value=model[method];return typeof value==='function'?value.bind(model):value}});const value=target[key];return typeof value==='function'?value.bind(target):value}})))};
  const writing=api(wrapped)['task-create']({title:'receipt test',operationId:op});await ready.promise;
  const recovery=recover().then(r=>{recovered=true;return r});
  try{await waitForDatabaseLock();assert.equal(recovered,false)}finally{release.resolve()}
  assert.equal((await writing).status,200);const r=await recovery;assert.equal(r.status,200);assert.equal((await r.json()).state,'found');
  results.push({name:'read-only recovery waits for in-flight creation receipt commit',lockWaitObserved:true});
 }
 await reset();{
  await prisma.$executeRawUnsafe('ALTER TABLE sfa_authority_fixture."SystemSetting" ADD CONSTRAINT reject_receipt CHECK (FALSE)');
  const r=await routes['task-create']({title:'rollback',operationId:op});assert.equal(r.status,500);assert.equal(await prisma.sfaTask.count(),1);assert.equal(await prisma.systemSetting.count(),0);
  await prisma.$executeRawUnsafe('ALTER TABLE sfa_authority_fixture."SystemSetting" DROP CONSTRAINT reject_receipt');
  results.push({name:'receipt insert failure rolls back actual task insertion'});
 }

 const detail=load('src/app/api/sfa/tasks/[id]/route.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma},'@/lib/sfa/mutation-authority':authority,'@/lib/sfa/access':{getSfaContext:async()=>({...ctx}),orgSlugFrom:()=> 'alpha'}});
 const taskCall=(method,body={},query='')=>detail[method]({json:async()=>body,nextUrl:new URL('https://example.test/api'+query)},{params:Promise.resolve({id:'task'})});
 await reset();{
  const version=(await prisma.sfaTask.findUnique({where:{id:'task'}})).updatedAt.toISOString();
  const responses=await Promise.all(Array.from({length:12},(_,i)=>taskCall('PATCH',{title:'changed-'+i,expectedUpdatedAt:version})));
  assert.equal(responses.filter(r=>r.status===200).length,1);assert.equal(responses.filter(r=>r.status===409).length,11);
  const row=await prisma.sfaTask.findUnique({where:{id:'task'}});assert.ok(row.updatedAt.getTime()>new Date(version).getTime());
  assert.equal((await taskCall('DELETE',{},'?expectedUpdatedAt='+encodeURIComponent(version))).status,409);
  assert.equal((await taskCall('GET')).status,200);assert.equal((await (await taskCall('GET')).json()).task.title,row.title);
  assert.equal((await taskCall('DELETE',{},'?expectedUpdatedAt='+encodeURIComponent(row.updatedAt.toISOString()))).status,200);
  assert.equal((await (await taskCall('GET')).json()).state,'missing');
  results.push({name:'12 actual same-version writes have one winner; stale delete denied; current delete and read recovery confirmed'});
 }
 await reset();{
  await prisma.$executeRaw`UPDATE sfa_tasks SET "updatedAt" = '2099-01-01T00:00:00.000Z'::timestamp WHERE id = 'task'`;
  const one=await taskCall('PATCH',{status:'done',expectedUpdatedAt:'2099-01-01T00:00:00.000Z'});assert.equal(one.status,200);const row=(await one.json()).task;assert.equal(row.updatedAt,'2099-01-01T00:00:00.001Z');
  const two=await taskCall('PATCH',{status:'open',expectedUpdatedAt:row.updatedAt});assert.equal(two.status,200);assert.equal((await two.json()).task.updatedAt,'2099-01-01T00:00:00.002Z');
  results.push({name:'actual timestamp versions increase by millisecond even when prior timestamp is in future'});
 }
 await reset();{
  const locked=deferred(),release=deferred();let recovered=false;
  const update=prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM sfa_tasks WHERE id = 'task' FOR UPDATE`;await tx.$executeRaw`UPDATE sfa_tasks SET title = 'committed newer title' WHERE id = 'task'`;locked.resolve();await release.promise});
  await locked.promise;const reading=taskCall('GET').then(r=>{recovered=true;return r});
  try{await waitForDatabaseLock();assert.equal(recovered,false)}finally{release.resolve()}
  await update;const r=await reading;assert.equal(r.status,200);assert.equal((await r.json()).task.title,'committed newer title');
  results.push({name:'read-only task recovery waits for actual update lock and returns committed value'});
 }

 const collectionRoute=(kind,db=prisma)=>load('src/app/api/sfa/'+(kind==='task'?'tasks':'activities')+'/route.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'@/lib/sfa/mutation-authority':authority,'@/lib/sfa/creation-receipt':receipts,'@/lib/sfa/access':{getSfaContext:async()=>({...ctx}),orgSlugFrom:()=> 'alpha'}});
 const operationRequest=()=>({url:'https://example.test/api?operationId='+op});
 for(const kind of ['task','activity']){
  const body=kind==='task'?{title:'synthetic cancel',operationId:op}:{subject:'synthetic cancel',operationId:op};
  const rowCount=()=>kind==='task'?prisma.sfaTask.count():prisma.sfaActivity.count();
  const initialCount=kind==='task'?1:0;
  await reset();{
   const route=collectionRoute(kind);
   assert.equal((await (await route.GET(operationRequest())).json()).state,'missing');
   const cancelled=await route.DELETE(operationRequest());assert.equal(cancelled.status,200);assert.equal((await cancelled.json()).state,'cancelled');
   assert.equal((await route.POST({json:async()=>body})).status,409);assert.equal(await rowCount(),initialCount);
   assert.equal((await (await route.GET(operationRequest())).json()).state,'cancelled');
   assert.equal((await (await route.DELETE(operationRequest())).json()).state,'cancelled');assert.equal(await prisma.systemSetting.count(),1);
   results.push({name:kind+' missing read then atomic cancellation blocks later original create; repeated cancellation is idempotent'});
  }
  await reset();{
   const locked=deferred(),release=deferred();let settled=false;
   const wrapped={$transaction:fn=>prisma.$transaction(tx=>fn(new Proxy(tx,{get(target,key){if(key==='systemSetting')return new Proxy(target.systemSetting,{get(model,method){if(method==='create')return async args=>{locked.resolve();await release.promise;return model.create(args)};const value=model[method];return typeof value==='function'?value.bind(model):value}});const value=target[key];return typeof value==='function'?value.bind(target):value}})))};
   const cancelling=collectionRoute(kind,wrapped).DELETE(operationRequest());await locked.promise;
   const posting=collectionRoute(kind).POST({json:async()=>body}).then(r=>{settled=true;return r});
   try{await waitForDatabaseLock();assert.equal(settled,false)}finally{release.resolve()}
   assert.equal((await (await cancelling).json()).state,'cancelled');assert.equal((await posting).status,409);assert.equal(await rowCount(),initialCount);
   results.push({name:kind+' real cancellation advisory lock wins; delayed create waits then rejects without business write'});
  }
  await reset();{
   const locked=deferred(),release=deferred();let settled=false;const modelName=kind==='task'?'sfaTask':'sfaActivity';
   const wrapped={$transaction:fn=>prisma.$transaction(tx=>fn(new Proxy(tx,{get(target,key){if(key===modelName)return new Proxy(target[modelName],{get(model,method){if(method==='create')return async args=>{const row=await model.create(args);locked.resolve();await release.promise;return row};const value=model[method];return typeof value==='function'?value.bind(model):value}});const value=target[key];return typeof value==='function'?value.bind(target):value}})))};
   const posting=collectionRoute(kind,wrapped).POST({json:async()=>body});await locked.promise;
   const cancelling=collectionRoute(kind).DELETE(operationRequest()).then(r=>{settled=true;return r});
   try{await waitForDatabaseLock();assert.equal(settled,false)}finally{release.resolve()}
   const created=await posting;assert.equal(created.status,200);const row=(await created.json())[kind];
   const r=await cancelling;assert.equal(r.status,200);const d=await r.json();assert.equal(d.state,'found');assert.equal(d[kind].id,row.id);assert.equal(await rowCount(),initialCount+1);
   results.push({name:kind+' real create advisory lock wins; cancellation waits then returns committed row without deleting it'});
  }
  await reset();{
   const route=collectionRoute(kind);const created=await route.POST({json:async()=>body});const id=(await created.json())[kind].id;
   if(kind==='task')await prisma.sfaTask.delete({where:{id}});else await prisma.sfaActivity.delete({where:{id}});
   assert.equal((await (await route.DELETE(operationRequest())).json()).state,'unavailable');assert.equal((await route.POST({json:async()=>body})).status,409);assert.equal(await rowCount(),initialCount);
   results.push({name:kind+' cancellation preserves unavailable creation receipt; no deleted row resurrection'});
  }
  await reset();{
   const locked=deferred(),release=deferred();let settled=false;
   const revoking=prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM sfa_members WHERE id = 'member' FOR UPDATE`;await tx.$executeRaw`UPDATE sfa_members SET status = 'INACTIVE' WHERE id = 'member'`;locked.resolve();await release.promise});
   await locked.promise;const cancelling=collectionRoute(kind).DELETE(operationRequest()).then(r=>{settled=true;return r});
   try{await waitForDatabaseLock();assert.equal(settled,false)}finally{release.resolve()}
   await revoking;assert.equal((await cancelling).status,403);assert.equal(await prisma.systemSetting.count(),0);
   results.push({name:kind+' cancellation waits for actual actor revocation and denies without receipt write'});
  }
  await reset();{
   await prisma.$executeRawUnsafe('ALTER TABLE sfa_authority_fixture."SystemSetting" ADD CONSTRAINT reject_cancel_fixture CHECK (value NOT LIKE \'%cancelled%\')');
   const route=collectionRoute(kind);assert.equal((await route.DELETE(operationRequest())).status,500);assert.equal(await prisma.systemSetting.count(),0);assert.equal(await rowCount(),initialCount);
   await prisma.$executeRawUnsafe('ALTER TABLE sfa_authority_fixture."SystemSetting" DROP CONSTRAINT reject_cancel_fixture');
   assert.equal((await route.POST({json:async()=>body})).status,200);assert.equal(await rowCount(),initialCount+1);
   results.push({name:kind+' real cancellation receipt failure rolls back and leaves original operation usable'});
  }
 }
 assert.deepEqual(hashes(),initialHashes);
 const report={checkedAt:new Date().toISOString(),passed:results.length,results,lockWaitObservations,sourceHashes:initialHashes,scope:'Actual API handlers, actual helper and generated PrismaClient against a fresh private Unix-socket-only PostgreSQL17 instance with synthetic tables/data. Real lock waits, concurrent execution, commits and rollbacks; schema/FK completeness, production concurrency, external auth/provider and client lifecycle are not proven.'};fs.writeFileSync(base+'sfa-client-postgres-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,results}));
 }finally{await prisma.$disconnect()}
})().catch(e=>{console.error(e);process.exitCode=1});
