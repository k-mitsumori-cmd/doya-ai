const fs = require('node:fs'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { load } = require('../../../scripts/security-regression/load-typescript.cjs');
const base = 'docs/audits/2026-10-06-all-services-recheck/';
(async () => {
  const socket = process.env.DOYA_SFA_AUTHORITY_PG_SOCKET, port = process.env.DOYA_SFA_AUTHORITY_PG_PORT;
  assert.match(socket || '', /^\/tmp\/doya-sfa-authority-[a-f0-9]{8}\/socket$/); assert.equal(port, '56481');
  const url = 'postgresql://doya_sfa@localhost:' + port + '/postgres?host=' + socket + '&sslmode=disable&pgbouncer=false';
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    const host = await db.$queryRawUnsafe('SELECT inet_server_addr() AS address,current_user AS role'); assert.equal(host[0].address, null); assert.equal(host[0].role, 'doya_sfa');
    await db.user.create({ data: { id: 'synthetic-hr-admin', email: 'synthetic-hr-admin@example.invalid', plan: 'FREE', role: 'USER', firstLoginAt: new Date() } });
    await db.hrOrganization.create({ data: { id: 'synthetic-org', name: 'Synthetic', slug: 'synthetic-concurrent-departments', members: { create: { userId: 'synthetic-hr-admin', role: 'ADMIN', status: 'ACTIVE' } } } });
    for (const id of ['synthetic-a', 'synthetic-b']) await db.hrDepartment.create({ data: { id, organizationId: 'synthetic-org', name: id, isActive: true } });
    await db.hrEmployee.create({ data: { id: 'synthetic-employee', organizationId: 'synthetic-org', departmentId: 'synthetic-a', firstName: 'SYNTHETIC_EMPLOYEE_MARKER', lastName: 'Synthetic', status: 'ACTIVE' } });
    let startedTransactions=0, enteredBoth; const transactionsEntered=new Promise(resolve=>{enteredBoth=resolve});
    const proxy={ $transaction:(action,options)=>db.$transaction(async tx=>{if(++startedTransactions===2)enteredBoth();return action(tx)},options) };
    const member=await db.hrOrganizationMember.findFirst({where:{organizationId:'synthetic-org',userId:'synthetic-hr-admin'}});
    const context={userId:'synthetic-hr-admin',organizationId:'synthetic-org',role:'ADMIN',memberId:member.id};
    const helper=load('src/lib/hr/department-mutation.ts',{'@/lib/prisma':{prisma:proxy}});
    const mocks={
      'next/server':{NextResponse:Response},'next-auth':{getServerSession:async()=>({user:{id:context.userId}})},'@/lib/auth':{},
      '@/lib/hr/access':{getHrContext:async()=>context,hasMinRole:()=>true},'@/lib/hr/types':{},
      '@/lib/department-integrity':load('src/lib/department-integrity.ts'),
      '@/lib/private-api-response':load('src/lib/private-api-response.ts',{'next/server':{NextResponse:Response}}),
      '@/lib/hr/department-input':load('src/lib/hr/department-input.ts'),
      '@/lib/hr/department-operation':load('src/lib/hr/department-operation.ts',{'node:crypto':crypto}),
      '@/lib/hr/org-chart-pagination':{readHrOrgChartPage(){throw Error('Unexpected paged path in legacy read fixture')},HrOrgChartPageError:class extends Error{}},
      '@/lib/hr/department-mutation':helper,'@/lib/prisma':{prisma:db},
    };
    const api=load('src/app/api/hr/departments/[id]/route.ts',mocks),cases=[];
    let locked,releaseBlocker; const organizationLocked=new Promise(resolve=>{locked=resolve}),hold=new Promise(resolve=>{releaseBlocker=resolve});
    const blocker=db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "hr_organizations" WHERE id = ${context.organizationId} FOR UPDATE`;locked();await hold},{timeout:15000});
    await organizationLocked;
    const patch = (id, parentId) => api.PATCH(new Request('https://example.invalid/api/hr/departments/' + id, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ parentId }) }), { params: Promise.resolve({ id }) });
    const pending=[patch('synthetic-a','synthetic-b'),patch('synthetic-b','synthetic-a')];
    await transactionsEntered;releaseBlocker();const responses=await Promise.all(pending);await blocker;
    assert.deepEqual(responses.map(r=>r.status).sort(),[200,400]);
    const a=await db.hrDepartment.findUnique({where:{id:'synthetic-a'}}),b=await db.hrDepartment.findUnique({where:{id:'synthetic-b'}});
    assert.ok(!(a.parentId===b.id&&b.parentId===a.id));cases.push({name:'Concurrent opposite parent changes serialize and reject the cycle',passed:true,statuses:responses.map(r=>r.status)});
    mocks['@/lib/prisma'] = { prisma: db };
    const chart = load('src/app/api/hr/org-chart/route.ts', mocks), r = await chart.GET(); assert.equal(r.status, 200); const body = await r.json();
    assert.equal((JSON.stringify(body).match(/SYNTHETIC_EMPLOYEE_MARKER/g)||[]).length,1);cases.push({name:'Authorized active employee remains in actual org-chart response',passed:true});
    await db.hrOrganizationMember.update({where:{id:member.id},data:{role:'MEMBER'}});
    assert.equal((await patch('synthetic-a','synthetic-b')).status,403);assert.deepEqual(await db.hrDepartment.findUnique({where:{id:'synthetic-a'}}),a);cases.push({name:'Stale administrator context cannot write after role downgrade',passed:true});
    await db.hrOrganizationMember.update({where:{id:member.id},data:{role:'ADMIN'}});
    const collection=load('src/app/api/hr/departments/route.ts',mocks);
    const post=data=>collection.POST(new Request('https://example.invalid/api/hr/departments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)}));
    const childResponse=await post({name:'Synthetic child',parentId:'synthetic-a'});assert.equal(childResponse.status,200);const child=(await childResponse.json()).department;assert.equal(child.parentId,'synthetic-a');cases.push({name:'Creation retains valid same-organization parent',passed:true});
    const remove=id=>api.DELETE(new Request('https://example.invalid/api/hr/departments/'+id,{method:'DELETE'}),{params:Promise.resolve({id})});
    assert.equal((await remove('synthetic-a')).status,400);assert.equal((await db.hrEmployee.findUnique({where:{id:'synthetic-employee'}})).departmentId,'synthetic-a');cases.push({name:'Delete cannot detach an employee from its department',passed:true});
    assert.equal((await remove(child.id)).status,200);assert.equal(await db.hrDepartment.findUnique({where:{id:child.id}}),null);cases.push({name:'Empty leaf department can still be deleted',passed:true});
    const duplicates=await Promise.all([post({name:'Code one',code:'SYNTHETIC_DUPLICATE'}),post({name:'Code two',code:'SYNTHETIC_DUPLICATE'})]);assert.deepEqual(duplicates.map(r=>r.status).sort(),[200,400]);assert.equal(await db.hrDepartment.count({where:{organizationId:'synthetic-org',code:'SYNTHETIC_DUPLICATE'}}),1);cases.push({name:'Concurrent duplicate code creation gives one success and one known rejection',passed:true});
    await db.hrOrganization.create({data:{id:'synthetic-foreign-org',name:'Synthetic foreign',slug:'synthetic-foreign-org'}});await db.hrDepartment.create({data:{id:'synthetic-foreign-dept',organizationId:'synthetic-foreign-org',name:'Synthetic foreign department'}});
    const foreign=await db.hrDepartment.findUnique({where:{id:'synthetic-foreign-dept'}});assert.equal((await patch(foreign.id,'synthetic-a')).status,404);assert.deepEqual(await db.hrDepartment.findUnique({where:{id:foreign.id}}),foreign);cases.push({name:'Foreign organization department cannot be mutated',passed:true});
    await db.hrOrganizationMember.update({where:{id:member.id},data:{status:'INACTIVE'}});assert.equal((await patch('synthetic-a','synthetic-b')).status,403);cases.push({name:'Inactive membership is rejected after context was obtained',passed:true});
    await db.hrOrganizationMember.update({where:{id:member.id},data:{status:'ACTIVE',role:'UNKNOWN_ROLE'}});assert.equal((await patch('synthetic-a','synthetic-b')).status,403);cases.push({name:'Unknown stored role fails closed despite stale admin context',passed:true});
    await db.hrOrganizationMember.update({where:{id:member.id},data:{status:'ACTIVE',role:'ADMIN'}});
    const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}};
    const bounded=async promise=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Synthetic concurrency barrier timed out')),5000)})])}finally{clearTimeout(timer)}};
    const waitForLock=async pid=>{
      const deadline=Date.now()+5000;
      while(Date.now()<deadline){
        const rows=await db.$queryRaw`SELECT wait_event_type, cardinality(pg_blocking_pids(pid)) AS blockers FROM pg_stat_activity WHERE pid = ${pid}`;
        if(rows[0]?.wait_event_type==='Lock'&&rows[0].blockers>0)return;
        await new Promise(resolve=>setTimeout(resolve,20));
      }
      throw new Error('Expected actual PostgreSQL row-lock contention was not observed');
    };
    await db.hrDepartment.create({data:{id:'synthetic-delete-first',organizationId:context.organizationId,name:'Delete first'}});
    const deleteLocked=deferred(),releaseDelete=deferred(),assignmentStarted=deferred();let assignmentPid;
    const deleteFirstDb={$transaction:(action,options)=>db.$transaction(async tx=>{
      const wrapped=new Proxy(tx,{get(target,key){
        if(key==='hrDepartment')return new Proxy(target.hrDepartment,{get(departments,method){
          if(method==='findFirst')return async args=>{if(args.where.id==='synthetic-delete-first'&&args.include?._count){deleteLocked.resolve();await bounded(releaseDelete.promise)}return departments.findFirst(args)};
          const value=departments[method];return typeof value==='function'?value.bind(departments):value;
        }});
        const value=target[key];return typeof value==='function'?value.bind(target):value;
      }});return action(wrapped);
    },options)};
    const deleteFirstHelper=load('src/lib/hr/department-mutation.ts',{'@/lib/prisma':{prisma:deleteFirstDb}});
    const deleteFirstApi=load('src/app/api/hr/departments/[id]/route.ts',{...mocks,'@/lib/hr/department-mutation':deleteFirstHelper});
    const deletion=deleteFirstApi.DELETE(new Request('https://example.invalid/api/hr/departments/synthetic-delete-first',{method:'DELETE'}),{params:Promise.resolve({id:'synthetic-delete-first'})});
    await bounded(deleteLocked.promise);
    const assignment=db.$transaction(async tx=>{
      assignmentPid=(await tx.$queryRaw`SELECT pg_backend_pid() AS pid`)[0].pid;assignmentStarted.resolve();
      return tx.hrEmployee.update({where:{id:'synthetic-employee'},data:{departmentId:'synthetic-delete-first'}});
    },{timeout:15000}).then(value=>({value}),error=>({error}));
    try{await bounded(assignmentStarted.promise);await waitForLock(assignmentPid)}finally{releaseDelete.resolve()}
    assert.equal((await deletion).status,200);const assignmentResult=await assignment;assert.equal(assignmentResult.error?.code,'P2003');
    assert.equal((await db.hrEmployee.findUnique({where:{id:'synthetic-employee'}})).departmentId,'synthetic-a');
    assert.equal(await db.hrDepartment.findUnique({where:{id:'synthetic-delete-first'}}),null);
    cases.push({name:'Delete-first row lock makes concurrent employee assignment fail atomically without detaching the employee',passed:true,actualRowLockObserved:true});

    await db.hrDepartment.create({data:{id:'synthetic-assign-first',organizationId:context.organizationId,name:'Assign first'}});
    const assignmentHeld=deferred(),releaseAssignment=deferred(),deleteStarted=deferred();let deletePid;
    const assignmentFirst=db.$transaction(async tx=>{
      await tx.hrEmployee.update({where:{id:'synthetic-employee'},data:{departmentId:'synthetic-assign-first'}});
      assignmentHeld.resolve();await bounded(releaseAssignment.promise);
    },{timeout:15000});
    await bounded(assignmentHeld.promise);
    const assignmentFirstDb={$transaction:(action,options)=>db.$transaction(async tx=>{deletePid=(await tx.$queryRaw`SELECT pg_backend_pid() AS pid`)[0].pid;deleteStarted.resolve();return action(tx)},options)};
    const assignmentFirstHelper=load('src/lib/hr/department-mutation.ts',{'@/lib/prisma':{prisma:assignmentFirstDb}});
    const assignmentFirstApi=load('src/app/api/hr/departments/[id]/route.ts',{...mocks,'@/lib/hr/department-mutation':assignmentFirstHelper});
    const deletionSecond=assignmentFirstApi.DELETE(new Request('https://example.invalid/api/hr/departments/synthetic-assign-first',{method:'DELETE'}),{params:Promise.resolve({id:'synthetic-assign-first'})});
    try{await bounded(deleteStarted.promise);await waitForLock(deletePid)}finally{releaseAssignment.resolve()}
    await assignmentFirst;assert.equal((await deletionSecond).status,400);
    assert.equal((await db.hrEmployee.findUnique({where:{id:'synthetic-employee'}})).departmentId,'synthetic-assign-first');
    assert.ok(await db.hrDepartment.findUnique({where:{id:'synthetic-assign-first'}}));
    cases.push({name:'Assignment-first foreign-key lock makes delete wait and then reject a department containing the employee',passed:true,actualRowLockObserved:true});

    assert.equal(cases.length,12,'Retain all original concurrency and lock interleavings');
    const snapshots=async()=>JSON.stringify(await Promise.all(['hrOrganization','hrOrganizationMember','hrDepartment','hrEmployee'].map(m=>db[m].findMany({orderBy:{id:'asc'}}))));
    const inputPatch=value=>api.PATCH(new Request('https://example.invalid/api/hr/departments/synthetic-a',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(value)}),{params:Promise.resolve({id:'synthetic-a'})});
    const invalid=[{name:''},{name:'   '},{name:0},{name:null},{code:{}},{parentId:3},{managerId:false},{sortOrder:1.5},{sortOrder:2147483648},{sortOrder:-2147483649},{isActive:'false'},null,[]];assert.equal(invalid.length,13);
    for(let i=0;i<invalid.length;i++)for(const method of ['PATCH','POST']){
      const value=invalid[i],payload=method==='POST'&&value&&typeof value==='object'&&!Array.isArray(value)?{name:'Synthetic invalid',...value}:value;
      const before=await snapshots(),r=await(method==='PATCH'?inputPatch(payload):post(payload));assert.equal(r.status,400,method+' invalid '+i);assert.equal(await snapshots(),before,'Invalid input must not change any domain row');cases.push({name:method+' rejects invalid input '+i+' before domain writes',passed:true,domainRowsUnchanged:true});
    }
    for(const method of ['PATCH','POST']){
      const before=await snapshots(),request=new Request('https://example.invalid/api/hr/departments/synthetic-a',{method,headers:{'content-type':'application/json'},body:'{'}),r=await(method==='PATCH'?api.PATCH(request,{params:Promise.resolve({id:'synthetic-a'})}):collection.POST(request));assert.equal(r.status,400);assert.equal(await snapshots(),before);cases.push({name:method+' malformed JSON is a safe400 rather than500',passed:true});
    }
    const beforeDuplicate=await snapshots(),duplicate=await inputPatch({code:'SYNTHETIC_DUPLICATE'});assert.equal(duplicate.status,400);assert.match((await duplicate.json()).error,/部署コード/);assert.equal(await snapshots(),beforeDuplicate);cases.push({name:'Actual unique constraint on duplicate PATCH code becomes useful400 without writes',passed:true});
    const longName='長'.repeat(1200),valid=await post({name:longName,code:null,parentId:null,managerId:null,sortOrder:0});assert.equal(valid.status,200);const created=(await valid.json()).department;assert.equal(created.name,longName);assert.equal(created.sortOrder,0);cases.push({name:'Valid long Unicode name and zero order remain accepted by actual POST/DB',passed:true});
    const min=await inputPatch({name:longName,code:null,parentId:null,managerId:null,sortOrder:-2147483648,isActive:false});assert.equal(min.status,200);const minRow=await db.hrDepartment.findUnique({where:{id:'synthetic-a'}});assert.equal(minRow.name,longName);assert.equal(minRow.sortOrder,-2147483648);assert.equal(minRow.isActive,false);assert.equal(minRow.parentId,null);assert.equal(minRow.managerId,null);cases.push({name:'Valid PATCH preserves nullable links, false and minimum Int order without arbitrary name cap',passed:true});
    assert.equal((await inputPatch({name:'営業部',sortOrder:2147483647,isActive:true})).status,200);assert.equal((await db.hrDepartment.findUnique({where:{id:'synthetic-a'}})).sortOrder,2147483647);cases.push({name:'Maximum Prisma Int order and Japanese name remain valid',passed:true});
    assert.equal((await inputPatch({})).status,200);cases.push({name:'Existing empty PATCH compatibility is retained',passed:true});
    for(const method of ['PATCH','POST']){
      const before=await snapshots(),anonymous=load(method==='PATCH'?'src/app/api/hr/departments/[id]/route.ts':'src/app/api/hr/departments/route.ts',{...mocks,'next-auth':{getServerSession:async()=>null}}),request={json(){throw Error('Anonymous request body must not be read')}};
      const r=await(method==='PATCH'?anonymous.PATCH(request,{params:Promise.resolve({id:'synthetic-a'})}):anonymous.POST(request));assert.equal(r.status,401);assert.equal(await snapshots(),before);cases.push({name:'Anonymous '+method+' is rejected before parsing or mutation',passed:true});
    }
    assert.equal(cases.length,47);
    const operationApi=load('src/app/api/hr/department-operation/route.ts',mocks);
    const uuid=n=>'11111111-1111-4111-8111-'+String(n).padStart(12,'0');
    const operationPost=(operationId,input={name:'Synthetic operation',code:null,sortOrder:0},org=context.organizationId,api=collection)=>api.POST(new Request('https://example.invalid/api/hr/departments',{method:'POST',headers:{'content-type':'application/json','x-hr-department-operation':operationId,'x-hr-organization-id':org},body:JSON.stringify(input)}));
    const operationRequest=(operationId,method='GET',org=context.organizationId,api=operationApi)=>api[method](new Request('https://example.invalid/api/hr/department-operation?operationId='+operationId+'&organizationId='+org,{method}));
    const auditSnapshot=async()=>JSON.stringify(await Promise.all(['hrOrganization','hrOrganizationMember','hrDepartment','hrEmployee','hrAuditLog'].map(m=>db[m].findMany({orderBy:{id:'asc'}}))));
    const opCase=async(name,fn)=>{await fn();cases.push({name,passed:true})};
    let firstDepartment;
    await opCase('Concurrent identical operation creates one department and one durable receipt',async()=>{
      const before=await db.hrDepartment.count(),auditBefore=await db.hrAuditLog.count();
      const replies=await Promise.all([operationPost(uuid(1)),operationPost(uuid(1))]);assert.deepEqual(replies.map(r=>r.status),[200,200]);
      const bodies=await Promise.all(replies.map(r=>r.json()));assert.equal(bodies[0].department.id,bodies[1].department.id);firstDepartment=bodies[0].department;
      assert.equal(await db.hrDepartment.count(),before+1);assert.equal(await db.hrAuditLog.count(),auditBefore+1);
    });
    await opCase('Discarded first acknowledgment and replay return the exact existing department without another write',async()=>{const before=await auditSnapshot();const r=await operationPost(uuid(1));assert.equal(r.status,200);assert.equal((await r.json()).department.id,firstDepartment.id);assert.equal(await auditSnapshot(),before)});
    await opCase('Read-only recovery resolves exact operation with private headers and no domain or receipt writes',async()=>{const before=await auditSnapshot(),r=await operationRequest(uuid(1));assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.match(r.headers.get('vary'),/Cookie/);const d=await r.json();assert.equal(d.operationId,uuid(1));assert.equal(d.organizationId,context.organizationId);assert.equal(d.department.id,firstDepartment.id);assert.equal(await auditSnapshot(),before)});
    await opCase('Payload changes under the same operation fail409 without writes',async()=>{const before=await auditSnapshot();assert.equal((await operationPost(uuid(1),{name:'Changed',code:null,sortOrder:0})).status,409);assert.equal(await auditSnapshot(),before)});
    await remove(firstDepartment.id);
    await opCase('Replay after department deletion fails410 and cannot resurrect it',async()=>{const before=await auditSnapshot();assert.equal((await operationPost(uuid(1))).status,410);assert.equal(await auditSnapshot(),before)});
    await opCase('Recovery preserves durable deleted state without recreating the department',async()=>{const before=await auditSnapshot(),r=await operationRequest(uuid(1));assert.equal((await r.json()).state,'deleted');assert.equal(await auditSnapshot(),before)});
    await opCase('Cancellation of an unreceived operation persists a fence without creating a department',async()=>{const before=await db.hrDepartment.count(),r=await operationRequest(uuid(2),'DELETE');assert.equal(r.status,200);assert.equal((await r.json()).state,'canceled');assert.equal(await db.hrDepartment.count(),before)});
    await opCase('A delayed POST arriving after cancellation cannot create a department',async()=>{const before=await auditSnapshot();assert.equal((await operationPost(uuid(2))).status,409);assert.equal(await auditSnapshot(),before)});
    const r3=await operationPost(uuid(3));assert.equal(r3.status,200);const third=(await r3.json()).department;
    await opCase('Cancellation after creation returns the saved result and does not delete it',async()=>{const before=await auditSnapshot(),r=await operationRequest(uuid(3),'DELETE');assert.equal(r.status,200);assert.equal((await r.json()).department.id,third.id);assert.equal(await auditSnapshot(),before)});
    await opCase('Create-first actual PostgreSQL waitLock contention commits one result then cancellation observes it',async()=>{
      const entered=deferred(),release=deferred();let readEntered=false;
      const intercepted={$transaction:(fn,options)=>db.$transaction(tx=>fn(new Proxy(tx,{get(target,k){if(k==='hrAuditLog')return new Proxy(target.hrAuditLog,{get(a,m){if(m==='findUnique')return async args=>{if(!readEntered){readEntered=true;entered.resolve();await bounded(release.promise)}return a.findUnique(args)};const v=a[m];return typeof v==='function'?v.bind(a):v}});const v=target[k];return typeof v==='function'?v.bind(target):v}})),options)};
      const h=load('src/lib/hr/department-mutation.ts',{'@/lib/prisma':{prisma:intercepted}}),c=load('src/app/api/hr/departments/route.ts',{...mocks,'@/lib/hr/department-mutation':h});
      const before=await db.hrDepartment.count(),creating=operationPost(uuid(4),undefined,context.organizationId,c);await bounded(entered.promise);
      const waiting=deferred();let waitingPid;
      const waitingDb={$transaction:(fn,options)=>db.$transaction(async tx=>{waitingPid=(await tx.$queryRaw`SELECT pg_backend_pid() AS pid`)[0].pid;waiting.resolve();return fn(tx)},options)};
      const waitingHelper=load('src/lib/hr/department-mutation.ts',{'@/lib/prisma':{prisma:waitingDb}}),waitingApi=load('src/app/api/hr/department-operation/route.ts',{...mocks,'@/lib/hr/department-mutation':waitingHelper});
      const cancel=operationRequest(uuid(4),'DELETE',context.organizationId,waitingApi);try{await bounded(waiting.promise);await waitForLock(waitingPid)}finally{release.resolve()}const [a,b]=await Promise.all([creating,cancel]);assert.equal(a.status,200);assert.equal((await b.json()).state,'created');assert.equal(await db.hrDepartment.count(),before+1);
    });
    await opCase('Cancel-first actual PostgreSQL waitLock contention persists a fence before delayed creation acquires the lock',async()=>{
      const entered=deferred(),release=deferred();let canceledEntered=false;
      const intercepted={$transaction:(fn,options)=>db.$transaction(tx=>fn(new Proxy(tx,{get(target,k){if(k==='hrAuditLog')return new Proxy(target.hrAuditLog,{get(a,m){if(m==='create')return async args=>{if(!canceledEntered){canceledEntered=true;entered.resolve();await bounded(release.promise)}return a.create(args)};const v=a[m];return typeof v==='function'?v.bind(a):v}});const v=target[k];return typeof v==='function'?v.bind(target):v}})),options)};
      const h=load('src/lib/hr/department-mutation.ts',{'@/lib/prisma':{prisma:intercepted}}),a=load('src/app/api/hr/department-operation/route.ts',{...mocks,'@/lib/hr/department-mutation':h});
      const before=await db.hrDepartment.count(),cancel=operationRequest(uuid(5),'DELETE',context.organizationId,a);await bounded(entered.promise);const waiting=deferred();let waitingPid;
      const waitingDb={$transaction:(fn,options)=>db.$transaction(async tx=>{waitingPid=(await tx.$queryRaw`SELECT pg_backend_pid() AS pid`)[0].pid;waiting.resolve();return fn(tx)},options)};
      const waitingHelper=load('src/lib/hr/department-mutation.ts',{'@/lib/prisma':{prisma:waitingDb}}),waitingApi=load('src/app/api/hr/departments/route.ts',{...mocks,'@/lib/hr/department-mutation':waitingHelper});
      const creating=operationPost(uuid(5),undefined,context.organizationId,waitingApi);try{await bounded(waiting.promise);await waitForLock(waitingPid)}finally{release.resolve()}const [c,p]=await Promise.all([cancel,creating]);assert.equal((await c.json()).state,'canceled');assert.equal(p.status,409);assert.equal(await db.hrDepartment.count(),before);
    });
    const originalUser=context.userId,originalMember=context.memberId;
    await db.user.create({data:{id:'synthetic-other-admin',email:'synthetic-other-admin@example.invalid'}});
    const other=await db.hrOrganizationMember.create({data:{organizationId:context.organizationId,userId:'synthetic-other-admin',role:'ADMIN',status:'ACTIVE'}});context.userId=other.userId;context.memberId=other.id;
    await opCase('Another administrator cannot read the first actor receipt using the same UUID',async()=>{const before=await auditSnapshot(),r=await operationRequest(uuid(3));assert.equal((await r.json()).state,'not_received');assert.equal(await auditSnapshot(),before)});
    await opCase('The same UUID from another actor has its own operation and result',async()=>{const r=await operationPost(uuid(3));assert.equal(r.status,200);assert.notEqual((await r.json()).department.id,third.id)});
    context.userId=originalUser;context.memberId=originalMember;
    await opCase('Mismatched expected organization rejects POST before mutation',async()=>{const before=await auditSnapshot();assert.equal((await operationPost(uuid(6),undefined,'synthetic-foreign-org')).status,403);assert.equal(await auditSnapshot(),before)});
    await opCase('Mismatched expected organization rejects recovery without exposing any result',async()=>{const before=await auditSnapshot();assert.equal((await operationRequest(uuid(3),'GET','synthetic-foreign-org')).status,403);assert.equal(await auditSnapshot(),before)});
    await db.hrOrganizationMember.update({where:{id:context.memberId},data:{role:'MEMBER'}});
    await opCase('Recovery rechecks stored membership after stale admin context',async()=>{const before=await auditSnapshot();assert.equal((await operationRequest(uuid(3))).status,403);assert.equal(await auditSnapshot(),before)});
    await opCase('Cancellation rechecks stored membership and cannot persist a fence after downgrade',async()=>{const before=await auditSnapshot();assert.equal((await operationRequest(uuid(7),'DELETE')).status,403);assert.equal(await auditSnapshot(),before)});
    await opCase('Operation replay cannot bypass stored membership downgrade',async()=>{const before=await auditSnapshot();assert.equal((await operationPost(uuid(3))).status,403);assert.equal(await auditSnapshot(),before)});
    await db.hrOrganizationMember.update({where:{id:context.memberId},data:{role:'ADMIN'}});
    await opCase('Anonymous recovery rejects before query parsing',async()=>{const a=load('src/app/api/hr/department-operation/route.ts',{...mocks,'@/lib/hr/access':{getHrContext:async()=>null}});assert.equal((await a.GET({get url(){throw Error('must not parse')}})).status,401)});
    await opCase('Malformed operation header pair cannot fall back to an untracked create',async()=>{const before=await auditSnapshot();const r=await collection.POST(new Request('https://example.invalid/api/hr/departments',{method:'POST',headers:{'content-type':'application/json','x-hr-department-operation':'bad'},body:JSON.stringify({name:'Bad header'})}));assert.equal(r.status,400);assert.equal(await auditSnapshot(),before)});
    await opCase('Ambiguous repeated operation query is rejected before receipt reads or writes',async()=>{const before=await auditSnapshot();const r=await operationApi.GET(new Request('https://example.invalid/api/hr/department-operation?operationId='+uuid(3)+'&operationId='+uuid(4)+'&organizationId='+context.organizationId));assert.equal(r.status,400);assert.equal(await auditSnapshot(),before)});
    await opCase('Corrupt receipt fails closed with generic500 and cannot create again',async()=>{const row=await db.hrAuditLog.findFirst({where:{userId:context.userId,details:{path:['operationId'],equals:uuid(3)}}});await db.hrAuditLog.update({where:{id:row.id},data:{details:{PRIVATE_MARKER:true}}});const before=await auditSnapshot(),r=await operationPost(uuid(3));assert.equal(r.status,500);assert.ok(!JSON.stringify(await r.json()).includes('PRIVATE_MARKER'));assert.equal(await auditSnapshot(),before)});
    await opCase('Receipt persistence failure rolls back its department creation atomically',async()=>{
      const failing={$transaction:(fn,options)=>db.$transaction(tx=>fn(new Proxy(tx,{get(target,k){if(k==='hrAuditLog')return new Proxy(target.hrAuditLog,{get(a,m){if(m==='create')return async()=>{throw Error('synthetic receipt storage failure')};const v=a[m];return typeof v==='function'?v.bind(a):v}});const v=target[k];return typeof v==='function'?v.bind(target):v}})),options)};
      const h=load('src/lib/hr/department-mutation.ts',{'@/lib/prisma':{prisma:failing}}),c=load('src/app/api/hr/departments/route.ts',{...mocks,'@/lib/hr/department-mutation':h});const before=await auditSnapshot();assert.equal((await operationPost(uuid(8),undefined,context.organizationId,c)).status,500);assert.equal(await auditSnapshot(),before);
    });
    await opCase('Later department edits do not change immutable creation acknowledgment or overwrite the edit',async()=>{const r=await operationPost(uuid(9));assert.equal(r.status,200);const d=(await r.json()).department;await db.hrDepartment.update({where:{id:d.id},data:{name:'Later edited name'}});const before=await auditSnapshot(),replay=await operationPost(uuid(9));assert.equal(replay.status,200);assert.equal((await replay.json()).department.name,'Synthetic operation');assert.equal(await auditSnapshot(),before)});
    assert.equal(cases.length,71,'Original47 plus24 durable operation cases');
    await opCase('Department list includes exact organization metadata with unchanged domain rows',async()=>{const before=await auditSnapshot(),r=await collection.GET(new Request('https://example.invalid/api/hr/departments'));assert.equal(r.status,200);assert.equal((await r.json()).organizationId,context.organizationId);assert.equal(await auditSnapshot(),before)});
    await opCase('Matching expected-organization header retains scoped department listing',async()=>{const before=await auditSnapshot(),r=await collection.GET(new Request('https://example.invalid/api/hr/departments',{headers:{'x-hr-organization-id':context.organizationId}}));assert.equal(r.status,200);assert.equal((await r.json()).organizationId,context.organizationId);assert.equal(await auditSnapshot(),before)});
    await opCase('Foreign expected-organization header rejects department read without returning any department',async()=>{const before=await auditSnapshot(),r=await collection.GET(new Request('https://example.invalid/api/hr/departments',{headers:{'x-hr-organization-id':'synthetic-foreign-org'}}));assert.equal(r.status,403);assert.deepEqual(Object.keys(await r.json()),['error']);assert.equal(await auditSnapshot(),before)});
    assert.equal(cases.length,74,'Original71 plus3 organization-bound read cases');


    const files = ['src/lib/hr/department-operation.ts','src/app/api/hr/department-operation/route.ts','src/lib/hr/department-input.ts','src/lib/private-api-response.ts','scripts/security-regression/load-typescript.cjs',base+'hr-department-operation-postgres-supervise.py','src/app/api/hr/departments/[id]/route.ts', 'src/lib/department-integrity.ts', 'src/app/api/hr/org-chart/route.ts', 'prisma/schema.prisma', base + 'verify-hr-department-operation-postgres.cjs', 'src/lib/hr/department-mutation.ts', 'src/app/api/hr/departments/route.ts'];
    const selected=f=>process.env.DOYA_TEST_BASELINE&&fs.existsSync(require('node:path').join(process.env.DOYA_TEST_BASELINE,f))?require('node:path').join(process.env.DOYA_TEST_BASELINE,f):f;
    const report={checkedAt:new Date().toISOString(),expected:74,passed:cases.length,cases,sourceHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(selected(f))).digest('hex')])),scope:'Actual HR department PATCH/POST/DELETE/GET and transaction helper against isolated full-schema Unix-only PostgreSQL. Synthetic authenticated context; real organization-row blocker makes both parent mutations contend before validation. Checks cycle exclusion, employee visibility, stale/inactive/unknown role, duplicate-code concurrency, foreign organization scope and delete integrity including both concurrent employee-assignment/delete interleavings with actual pg_stat_activity lock-wait evidence. Original71 cases retained plus3 organization-bound read cases; original47 input/concurrency plus24 durable operation cases. Original12 cases retained plus35 input/compatibility/authorization cases including real unique constraint rejection and valid1200-character name. No production/customer/provider writes. Root not integrated; full frozen build/Next/browser/release remains required.'};
    fs.writeFileSync(base + 'hr-department-operation-postgres.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
  } finally { await db.$disconnect(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
