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

    const files = ['src/lib/hr/department-input.ts','src/lib/private-api-response.ts','scripts/security-regression/load-typescript.cjs',base+'hr-department-input-postgres-supervise.py','src/app/api/hr/departments/[id]/route.ts', 'src/lib/department-integrity.ts', 'src/app/api/hr/org-chart/route.ts', 'prisma/schema.prisma', base + 'verify-hr-department-input-postgres.cjs', 'src/lib/hr/department-mutation.ts', 'src/app/api/hr/departments/route.ts'];
    const selected=f=>process.env.DOYA_TEST_BASELINE&&fs.existsSync(require('node:path').join(process.env.DOYA_TEST_BASELINE,f))?require('node:path').join(process.env.DOYA_TEST_BASELINE,f):f;
    const report={checkedAt:new Date().toISOString(),expected:47,passed:cases.length,cases,sourceHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(selected(f))).digest('hex')])),scope:'Actual HR department PATCH/POST/DELETE/GET and transaction helper against isolated full-schema Unix-only PostgreSQL. Synthetic authenticated context; real organization-row blocker makes both parent mutations contend before validation. Checks cycle exclusion, employee visibility, stale/inactive/unknown role, duplicate-code concurrency, foreign organization scope and delete integrity including both concurrent employee-assignment/delete interleavings with actual pg_stat_activity lock-wait evidence. Original12 cases retained plus35 input/compatibility/authorization cases including real unique constraint rejection and valid1200-character name. No production/customer/provider writes. Root not integrated; full frozen build/Next/browser/release remains required.'};
    fs.writeFileSync(base + 'hr-department-input-postgres.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
  } finally { await db.$disconnect(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
