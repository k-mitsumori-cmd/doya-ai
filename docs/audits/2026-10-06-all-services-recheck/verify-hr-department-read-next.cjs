const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{PrismaClient}=require('@prisma/client');
const base='docs/audits/2026-10-06-all-services-recheck/',routes=['/api/hr/departments','/api/hr/org-chart','/api/kintai/departments'];
(async()=>{
 const origin=process.env.DOYA_E2E_ORIGIN,url=new URL(process.env.DATABASE_URL);assert.match(origin||'',/^http:\/\/127\.0\.0\.1:\d+$/);assert.match(url.searchParams.get('host')||'',/^\/tmp\/doya-sfa-authority-[a-f0-9]{8}\/socket$/);assert.equal(url.port,'56481');
 const db=new PrismaClient({datasources:{db:{url:url.href}}}),tokens={},cases=[],models=['hrOrganization','hrOrganizationMember','hrDepartment','hrEmployee','kintaiOrganization','kintaiMember','kintaiDepartment','kintaiEmployee'];
 const snapshot=()=>Promise.all(models.map(model=>db[model].findMany({orderBy:{id:'asc'}})));
 try{
  const c=await db.$queryRawUnsafe('SELECT inet_server_addr() AS address,current_user AS role');assert.equal(c[0].address,null);assert.equal(c[0].role,'doya_sfa');
  for(const a of ['A','B']){
   const userId='synthetic-additional-cache-'+a;tokens[a]=crypto.randomUUID();await db.user.create({data:{id:userId,email:userId+'@example.invalid',name:'SYNTHETIC_CACHE_'+a,plan:'FREE',role:'USER',firstLoginAt:new Date()}});await db.session.create({data:{sessionToken:tokens[a],userId,expires:new Date(Date.now()+86400000)}});
   await db.hrOrganization.create({data:{id:'hr-'+a,name:'SYNTHETIC_CACHE_'+a,slug:'synthetic-hr-'+a.toLowerCase(),members:{create:{userId,role:'MEMBER',status:'ACTIVE',employeeId:'hr-self-'+a}}}});
   await db.hrDepartment.create({data:{id:'hr-dept-'+a,organizationId:'hr-'+a,name:'SYNTHETIC_CACHE_'+a,parentId:null,sortOrder:0,isActive:true}});
   for(const kind of ['self','hidden'])await db.hrEmployee.create({data:{id:'hr-'+kind+'-'+a,organizationId:'hr-'+a,departmentId:'hr-dept-'+a,firstName:'SYNTHETIC_EMPLOYEE_'+a+'_'+kind.toUpperCase(),lastName:'Synthetic',employeeNumber:kind,status:'ACTIVE'}});
   await db.kintaiOrganization.create({data:{id:'kintai-'+a,name:'SYNTHETIC_CACHE_'+a,slug:'synthetic-kintai-'+a.toLowerCase(),members:{create:{userId,role:'employee',status:'ACTIVE',employee:{create:{organizationId:'kintai-'+a,name:'SYNTHETIC_CACHE_'+a,email:userId+'@example.invalid'}}}}}});
   await db.kintaiDepartment.create({data:{id:'kintai-dept-'+a,organizationId:'kintai-'+a,name:'SYNTHETIC_CACHE_'+a}});
  }
  async function get(path,actor,status,label,{manager=false,noEmployee=false}={}){
   const before=await snapshot(),r=await fetch(origin+path+'?organizationId=synthetic-foreign',{headers:actor?{Cookie:'next-auth.session-token='+tokens[actor]}:{},redirect:'error',signal:AbortSignal.timeout(15000)}),text=await r.text();assert.ok(text.length<32768);assert.equal(r.status,status,label+' '+text.slice(0,200));assert.equal(r.headers.get('cache-control'),'private, no-store');assert.ok((r.headers.get('vary')||'').split(',').some(x=>x.trim().toLowerCase()==='cookie'));const body=JSON.parse(text);
   if(status===200){assert.ok(text.includes('SYNTHETIC_CACHE_'+actor));assert.equal(text.includes('SYNTHETIC_CACHE_'+(actor==='A'?'B':'A')),false);if(path==='/api/hr/org-chart'){assert.equal(text.includes('SYNTHETIC_EMPLOYEE_'+actor+'_HIDDEN'),manager);assert.equal(text.includes('SYNTHETIC_EMPLOYEE_'+actor+'_SELF'),!noEmployee)}else if(path==='/api/hr/departments'){assert.equal(body.flat.length,1);assert.equal(body.departments.length,1);assert.equal(body.flat[0].employeeCount,2)}else assert.equal(body.departments.length,1)}else assert.ok(body.error&&!text.includes('SYNTHETIC_'));
   assert.deepEqual(await snapshot(),before,'GET mutated organization/member/department/employee rows');cases.push({name:label,path,actor:actor||'anonymous',status,privateNoStore:true,varyCookie:true,domainRowsUnchanged:true,passed:true});return body;
  }
  for(const p of routes)await get(p,null,401,'Anonymous '+p);
  for(const a of ['A','B'])for(const p of routes)await get(p,a,200,'Member '+a+' '+p);
  const hrWhere={organizationId_userId:{organizationId:'hr-A',userId:'synthetic-additional-cache-A'}},kiWhere={organizationId_userId:{organizationId:'kintai-A',userId:'synthetic-additional-cache-A'}};
  await db.hrOrganizationMember.update({where:hrWhere,data:{role:'MANAGER'}});await get('/api/hr/org-chart','A',200,'Manager sees same-organization employees only',{manager:true});
  await db.hrOrganizationMember.update({where:hrWhere,data:{role:'MEMBER',employeeId:null}});await get('/api/hr/org-chart','A',200,'Unlinked member sees no employee details',{noEmployee:true});
  await db.hrOrganizationMember.update({where:hrWhere,data:{employeeId:'hr-self-A',status:'INACTIVE'}});for(const p of routes.slice(0,2))await get(p,'A',401,'Inactive HR membership '+p);
  await db.hrOrganizationMember.update({where:hrWhere,data:{status:'ACTIVE',role:'UNRECOGNIZED_ROLE'}});for(const p of routes.slice(0,2))await get(p,'A',401,'Unknown HR membership role '+p);await db.hrOrganizationMember.update({where:hrWhere,data:{role:'MEMBER'}});
  await db.kintaiMember.update({where:kiWhere,data:{status:'INACTIVE'}});await get(routes[2],'A',401,'Inactive attendance membership');await db.kintaiMember.update({where:kiWhere,data:{status:'ACTIVE',role:'UNRECOGNIZED_ROLE'}});await get(routes[2],'A',401,'Unknown attendance membership role');await db.kintaiMember.update({where:kiWhere,data:{role:'employee'}});
  await db.session.delete({where:{sessionToken:tokens.A}});for(const p of routes)await get(p,'A',401,'Revoked session '+p);
  const bMember={organizationId_userId:{organizationId:'hr-B',userId:'synthetic-additional-cache-B'}};
  await db.hrOrganizationMember.update({where:bMember,data:{role:'MANAGER'}});
  await db.hrDepartment.create({data:{id:'hr-inactive-parent-B',organizationId:'hr-B',name:'SYNTHETIC_INACTIVE_PARENT_B',isActive:false}});
  await db.hrDepartment.create({data:{id:'hr-active-child-B',organizationId:'hr-B',name:'SYNTHETIC_ACTIVE_CHILD_B',parentId:'hr-inactive-parent-B',isActive:true}});
  await db.hrEmployee.update({where:{id:'hr-hidden-B'},data:{departmentId:'hr-active-child-B'}});
  const childBody=await get('/api/hr/org-chart','B',200,'Active child remains visible below inactive parent',{manager:true});
  assert.ok(childBody.orgChart.some(node=>node.department.id==='hr-active-child-B'));assert.ok(!JSON.stringify(childBody).includes('SYNTHETIC_INACTIVE_PARENT_B'));
  await db.hrEmployee.update({where:{id:'hr-self-B'},data:{departmentId:'hr-inactive-parent-B'}});
  const inactiveBody=await get('/api/hr/org-chart','B',200,'Employee in inactive department remains represented separately',{manager:true});
  assert.equal(inactiveBody.unassignedEmployees.filter(e=>e.id==='hr-self-B').length,1);
  await db.hrOrganizationMember.update({where:bMember,data:{role:'MEMBER'}});
  const memberBody=await get('/api/hr/org-chart','B',200,'Unassigned member sees own details only');assert.deepEqual(memberBody.unassignedEmployees.map(e=>e.id),['hr-self-B']);
  await db.hrDepartment.update({where:{id:'hr-active-child-B'},data:{parentId:'hr-dept-A'}});
  const foreignParentBody=await get('/api/hr/org-chart','B',200,'Foreign parent identifier cannot hide own child or expose foreign organization');assert.ok(foreignParentBody.orgChart.some(node=>node.department.id==='hr-active-child-B'));
  await db.hrEmployee.update({where:{id:'hr-self-B'},data:{status:'RESIGNED'}});
  const resignedBody=await get('/api/hr/org-chart','B',200,'Inactive employee cannot enter unassigned presentation',{noEmployee:true});assert.deepEqual(resignedBody.unassignedEmployees,[]);

  const originalCaseCount=cases.length;assert.equal(originalCaseCount,25);
  async function paged(actor,status=200,cursor=null){
   const r=await fetch(origin+'/api/hr/org-chart?format=pages'+(cursor===null?'':'&cursor='+encodeURIComponent(cursor)),{headers:actor?{Cookie:'next-auth.session-token='+tokens[actor]}:{},redirect:'error',signal:AbortSignal.timeout(35000)});
   assert.equal(r.status,status);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.ok((r.headers.get('vary')||'').split(',').some(v=>v.trim().toLowerCase()==='cookie'));
   const text=await r.text();assert.ok(Buffer.byteLength(text)<1024*1024);const body=JSON.parse(text);if(status===200){assert.equal(body.format,'hr-org-chart-page-v1');assert.ok(body.employees.length<=50&&body.departments.length<=50);assert.ok(!text.includes('SYNTHETIC_CACHE_'+(actor==='A'?'B':'A')))}else assert.ok(body.error);
   return body;
  }
  const pass=name=>cases.push({name,passed:true});
  await paged(null,401);pass('Paged anonymous read is private401');
  await db.hrEmployee.update({where:{id:'hr-self-B'},data:{status:'ACTIVE'}});
  const own=await paged('B');assert.deepEqual(own.employees.map(e=>e.id),['hr-self-B']);assert.equal(own.nextCursor,null);pass('Paged authenticated member sees own employee only');
  await db.hrOrganizationMember.update({where:bMember,data:{employeeId:null}});const none=await paged('B');assert.equal(none.totals.employees,0);assert.deepEqual(none.employees,[]);pass('Paged unlinked authenticated member sees no employees');
  await db.hrOrganizationMember.update({where:bMember,data:{employeeId:'hr-self-B',role:'MANAGER'}});await db.hrOrganization.update({where:{id:'hr-B'},data:{plan:'ENTERPRISE'}});
  const large=Array.from({length:2000},(_,i)=>({id:'hr-large-'+String(i).padStart(5,'0'),organizationId:'hr-B',departmentId:'hr-dept-B',firstName:'Synthetic',lastName:'Large Employee',employeeNumber:'large-'+i,status:'ACTIVE',photoUrl:'https://assets.example.invalid/'+'x'.repeat(600)}));await db.hrEmployee.createMany({data:large});
  const beforePages=await snapshot();let cursor=null,firstCursor;const ids=new Set();let pages=0;
  do{const p=await paged('B',200,cursor);for(const e of p.employees){assert.ok(!ids.has(e.id));ids.add(e.id)}cursor=p.nextCursor;pages++;if(pages===1)firstCursor=cursor;assert.ok(pages<=41)}while(cursor);
  assert.equal(ids.size,2002);assert.equal(pages,41);assert.deepEqual(await snapshot(),beforePages);pass('Actual Next/auth/SQL delivers all2002 enterprise employees exactly once over41 bounded pages without domain writes');
  await paged('B',400,'%');pass('Actual Next paged endpoint rejects malformed cursor');
  await db.session.create({data:{sessionToken:tokens.A,userId:'synthetic-additional-cache-A',expires:new Date(Date.now()+86400000)}});await paged('A',409,firstCursor);pass('Actual other-organization session cannot reuse cursor');
  await db.hrEmployee.update({where:{id:large[0].id},data:{position:'Synthetic changed'}});await paged('B',409,firstCursor);pass('Actual database edit between HTTP pages invalidates snapshot');
  const {load}=require('../../../scripts/security-regression/load-typescript.cjs');let requestCount=0;const progress=[];
  const client=load('src/lib/hr/org-chart-paged-client.ts',{}, {AbortController,TextDecoder,Uint8Array,setTimeout,clearTimeout,fetch:async(input,options)=>{requestCount++;assert.equal(options.cache,'no-store');return fetch(origin+input,{...options,headers:{Cookie:'next-auth.session-token='+tokens.B}})}});
  const beforeClient=await snapshot(),chart=await client.readHrOrgChart(new AbortController().signal,(loaded,total)=>progress.push([loaded,total]));let count=chart.unassignedEmployees.length;const stack=[...chart.orgChart];while(stack.length){const n=stack.pop();count+=n.employees.length;stack.push(...n.children)}assert.equal(count,2002);assert.equal(requestCount,41);assert.ok(Buffer.byteLength(JSON.stringify(chart))>1024*1024);assert.deepEqual(progress.at(-1),[2004,2004]);assert.deepEqual(await snapshot(),beforeClient);pass('Actual paged client reads complete greater-than1MiB chart through actual Next/session/realDB');
  const longName='長'.repeat(1200),longPhoto='https://assets.example.invalid/'+'x'.repeat(9000);await db.hrDepartment.update({where:{id:'hr-dept-B'},data:{name:longName}});await db.hrEmployee.update({where:{id:large[0].id},data:{lastName:longName,photoUrl:longPhoto}});const longBefore=await snapshot(),longChart=await client.readHrOrgChart(new AbortController().signal);const longDept=longChart.orgChart.find(n=>n.department.id==='hr-dept-B');assert.equal(longDept.department.name,longName);pass('Actual DB/API/client preserves a valid department name exceeding1024 characters');const longEmployee=longDept.employees.find(e=>e.id===large[0].id);assert.equal(longEmployee.lastName,longName);pass('Actual DB/API/client preserves a valid employee name exceeding1024 characters');assert.equal(longEmployee.photoUrl,longPhoto);assert.deepEqual(await snapshot(),longBefore);pass('Actual DB/API/client preserves a valid photo URL exceeding8192 characters without domain writes');
  await db.hrOrganizationMember.update({where:bMember,data:{status:'INACTIVE'}});await paged('B',401);pass('Paged read fails closed after membership revocation');await db.hrOrganizationMember.update({where:bMember,data:{status:'ACTIVE'}});
  await db.session.delete({where:{sessionToken:tokens.B}});await paged('B',401);pass('Paged read fails closed after session revocation');


  await db.session.create({data:{sessionToken:tokens.B,userId:'synthetic-additional-cache-B',expires:new Date(Date.now()+86400000)}});
  await db.hrOrganizationMember.update({where:bMember,data:{role:'ADMIN'}});
  async function mutate(path,method,data,status,label,{unchanged=false}={}){
   const before=await snapshot();const response=await fetch(origin+path,{method,headers:{Cookie:'next-auth.session-token='+tokens.B,'content-type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)}),redirect:'error',signal:AbortSignal.timeout(20000)});
   const text=await response.text();assert.ok(text.length<32768);assert.equal(response.status,status,label+' '+text.slice(0,200));const body=JSON.parse(text);
   assert.ok(!text.includes('SYNTHETIC_CACHE_A')&&!text.includes('SYNTHETIC_EMPLOYEE_A'));
   if(unchanged)assert.deepEqual(await snapshot(),before,'Rejected mutation changed domain rows');
   cases.push({name:label,path,actor:'B',status,domainRowsUnchanged:unchanged,passed:true});return body;
  }
  const created=await mutate('/api/hr/departments','POST',{name:'SYNTHETIC_RUNTIME_CHILD',parentId:'hr-dept-B'},200,'Actual authenticated department POST preserves same-organization parent');
  assert.equal(created.department.parentId,'hr-dept-B');
  for(const id of ['hr-cycle-first-B','hr-cycle-second-B'])await db.hrDepartment.create({data:{id,organizationId:'hr-B',name:id,isActive:true}});
  const opposite=await Promise.all([['hr-cycle-first-B','hr-cycle-second-B'],['hr-cycle-second-B','hr-cycle-first-B']].map(async([id,parentId])=>{
   const r=await fetch(origin+'/api/hr/departments/'+id,{method:'PATCH',headers:{Cookie:'next-auth.session-token='+tokens.B,'content-type':'application/json'},body:JSON.stringify({parentId}),signal:AbortSignal.timeout(20000)});await r.text();return r.status;
  }));assert.deepEqual(opposite.sort(),[200,400]);
  const first=await db.hrDepartment.findUnique({where:{id:'hr-cycle-first-B'}}),second=await db.hrDepartment.findUnique({where:{id:'hr-cycle-second-B'}});assert.ok(!(first.parentId===second.id&&second.parentId===first.id));
  cases.push({name:'Actual authenticated opposite parent PATCH requests cannot persist a cycle',passed:true,statuses:opposite});
  await db.hrOrganizationMember.update({where:bMember,data:{role:'MEMBER'}});
  await mutate('/api/hr/departments/hr-cycle-first-B','PATCH',{name:'SHOULD_NOT_PERSIST'},403,'Actual member cannot edit department',{unchanged:true});
  await db.hrOrganizationMember.update({where:bMember,data:{role:'ADMIN'}});
  await mutate('/api/hr/departments/hr-dept-A','PATCH',{name:'SHOULD_NOT_PERSIST'},404,'Actual administrator cannot edit foreign organization department',{unchanged:true});
  await mutate('/api/hr/departments/'+created.department.id,'DELETE',undefined,200,'Actual administrator can delete empty leaf department');assert.equal(await db.hrDepartment.findUnique({where:{id:created.department.id}}),null);
  await mutate('/api/hr/departments/hr-active-child-B','DELETE',undefined,400,'Actual deletion preserves department containing an employee',{unchanged:true});

  assert.equal(cases.length,44,'Original38 paged/legacy cases and6 mutation cases retained');
  await db.hrDepartment.create({data:{id:'hr-input-code-holder-B',organizationId:'hr-B',name:'Synthetic code holder',code:'SYNTH_INPUT_DUPLICATE'}});
  for(const [label,data] of [['empty department name',{name:''}],['whitespace department name',{name:'   '}],['duplicate department code',{code:'SYNTH_INPUT_DUPLICATE'}],['noninteger department order',{sortOrder:1.5}]])await mutate('/api/hr/departments/hr-dept-B','PATCH',data,400,'Actual authenticated input rejection: '+label,{unchanged:true});
  for(const method of ['PATCH','POST']){
   const before=await snapshot(),r=await fetch(origin+'/api/hr/departments'+(method==='PATCH'?'/hr-dept-B':''),{method,headers:{Cookie:'next-auth.session-token='+tokens.B,'content-type':'application/json'},body:'{',redirect:'error',signal:AbortSignal.timeout(20000)});assert.equal(r.status,400);await r.text();assert.deepEqual(await snapshot(),before);cases.push({name:'Actual authenticated malformed '+method+' JSON yields400 without domain writes',passed:true});
  }
  await mutate('/api/hr/departments','POST',{name:''},400,'Actual authenticated POST rejects empty name',{unchanged:true});
  await mutate('/api/hr/departments/hr-dept-B','PATCH',{parentId:'hr-dept-A'},400,'Actual authenticated PATCH rejects foreign parent',{unchanged:true});
  const validLong=await mutate('/api/hr/departments/hr-dept-B','PATCH',{name:'営'.repeat(1200),sortOrder:0},200,'Actual authenticated PATCH preserves valid long Japanese department name');assert.equal(validLong.department.name,'営'.repeat(1200));assert.equal(validLong.department.sortOrder,0);

  assert.equal(cases.length,53,'Original53 input/cache/paged/auth assertions retained');
  const op=crypto.randomUUID(),intent={name:'SYNTHETIC_DURABLE_OPERATION',code:null,sortOrder:0};
  const operationUrl=id=>'/api/hr/department-operation?operationId='+id+'&organizationId=hr-B';
  async function requestOperation(path,method,status,data,operationId=op,actor='B',organizationId='hr-B'){
   const r=await fetch(origin+path,{method,headers:{...(actor?{Cookie:'next-auth.session-token='+tokens[actor]}:{}),'content-type':'application/json','X-HR-Department-Operation':operationId,'X-HR-Organization-Id':organizationId},...(data===undefined?{}:{body:JSON.stringify(data)}),redirect:'error',signal:AbortSignal.timeout(20000)});
   const text=await r.text();assert.equal(r.status,status,text.slice(0,200));assert.equal(r.headers.get('cache-control'),'private, no-store');assert.ok((r.headers.get('vary')||'').toLowerCase().includes('cookie'));return JSON.parse(text);
  }
  const concurrent=await Promise.all([requestOperation('/api/hr/departments','POST',200,intent),requestOperation('/api/hr/departments','POST',200,intent)]);assert.equal(concurrent[0].department.id,concurrent[1].department.id);assert.equal(await db.hrDepartment.count({where:{organizationId:'hr-B',name:intent.name}}),1);pass('Actual authenticated concurrent operation POSTs return one committed department');
  const deptId=concurrent[0].department.id;
  await requestOperation('/api/hr/departments','POST',409,{...intent,name:'CHANGED_RETRY'});pass('Actual durable POST rejects changed payload409');
  let before=await snapshot(),auditBefore=await db.hrAuditLog.findMany({orderBy:{id:'asc'}});const recovered=await requestOperation(operationUrl(op),'GET',200);assert.equal(recovered.state,'created');assert.equal(recovered.department.id,deptId);assert.deepEqual(await snapshot(),before);assert.deepEqual(await db.hrAuditLog.findMany({orderBy:{id:'asc'}}),auditBefore);pass('Actual GET recovers committed immutable receipt without domain or audit writes');
  const missing=crypto.randomUUID();before=await snapshot();auditBefore=await db.hrAuditLog.findMany({orderBy:{id:'asc'}});assert.equal((await requestOperation(operationUrl(missing),'GET',200)).state,'not_received');assert.deepEqual(await snapshot(),before);assert.deepEqual(await db.hrAuditLog.findMany({orderBy:{id:'asc'}}),auditBefore);pass('Actual unknown operation GET remains read-only not_received');
  assert.equal((await requestOperation(operationUrl(missing),'DELETE',200)).state,'canceled');pass('Actual operation DELETE persists cancellation fence');
  await requestOperation('/api/hr/departments','POST',409,intent,missing);assert.equal(await db.hrDepartment.count({where:{organizationId:'hr-B',name:intent.name}}),1);pass('Actual late POST cannot cross committed cancellation fence');
  assert.equal((await requestOperation(operationUrl(missing),'GET',200)).state,'canceled');pass('Actual GET observes persisted cancellation');
  assert.equal((await requestOperation(operationUrl(op),'DELETE',200)).state,'created');assert.ok(await db.hrDepartment.findUnique({where:{id:deptId}}));pass('Actual cancel after commit reports created and never deletes department');
  await db.hrDepartment.delete({where:{id:deptId}});assert.equal((await requestOperation(operationUrl(op),'GET',200)).state,'deleted');pass('Actual GET reports deleted department without resurrection');
  await requestOperation('/api/hr/departments','POST',410,intent);assert.equal(await db.hrDepartment.findUnique({where:{id:deptId}}),null);pass('Actual POST replay after deletion returns410 without resurrection');
  await requestOperation('/api/hr/departments','POST',403,intent,crypto.randomUUID(),'B','hr-A');pass('Actual POST rejects foreign expected organization');
  await db.hrOrganizationMember.update({where:bMember,data:{role:'MEMBER'}});await requestOperation(operationUrl(op),'GET',403);await db.hrOrganizationMember.update({where:bMember,data:{role:'ADMIN'}});pass('Actual member cannot recover administrator operation');
  await requestOperation(operationUrl(op),'GET',401,undefined,op,null);pass('Actual anonymous operation recovery is private401');
  await requestOperation('/api/hr/departments','GET',403,undefined,op,'B','hr-A');pass('Actual department read rejects mismatched expected organization');
  before=await snapshot();auditBefore=await db.hrAuditLog.findMany({orderBy:{id:'asc'}});await requestOperation('/api/hr/departments','POST',400,intent,'malformed-operation');assert.deepEqual(await snapshot(),before);assert.deepEqual(await db.hrAuditLog.findMany({orderBy:{id:'asc'}}),auditBefore);pass('Actual malformed operation header rejects before any domain or audit writes');

  assert.equal(cases.length,68,'All original operation regression cases retained');
  async function departmentPage(query='format=pages',status=200,actor='B',expected='hr-B') {
   const response=await fetch(origin+'/api/hr/departments?'+query,{headers:{...(actor?{Cookie:'next-auth.session-token='+tokens[actor]}:{}),'X-HR-Organization-Id':expected},signal:AbortSignal.timeout(35000),redirect:'error'});
   const text=await response.text();assert.equal(response.status,status,text.slice(0,200));assert.equal(response.headers.get('cache-control'),'private, no-store');assert.match(response.headers.get('vary')||'',/cookie/i);assert.ok(Buffer.byteLength(text)<1024*1024,'Paged response must remain below1MiB');return JSON.parse(text);
  }
  await departmentPage('format=pages',401,null);pass('Paged department GET rejects anonymous authentication with private401');
  await departmentPage('format=pages',403,'B','hr-A');pass('Paged department GET rejects foreign expected organization');
  for(const q of ['format=pages&format=pages','format=pages&cursor=a&cursor=b','format=pages&unknown=1','format=pages&cursor=invalid'])await departmentPage(q,400);pass('Paged department GET rejects duplicate unknown and malformed query parameters');
  await db.hrOrganizationMember.update({where:bMember,data:{role:'MEMBER'}});
  before=await snapshot();auditBefore=await db.hrAuditLog.findMany({orderBy:{id:'asc'}});const memberPage=await departmentPage();assert.equal(memberPage.organizationId,'hr-B');assert.deepEqual(await snapshot(),before);assert.deepEqual(await db.hrAuditLog.findMany({orderBy:{id:'asc'}}),auditBefore);await db.hrOrganizationMember.update({where:bMember,data:{role:'ADMIN'}});pass('Paged member GET reads own departments without domain or audit writes');
  await db.hrDepartment.createMany({data:Array.from({length:120},(_,i)=>({id:'hr-read-'+String(i).padStart(4,'0'),organizationId:'hr-B',name:'部署'+i,isActive:i%2===0,sortOrder:i}))});
  const {load:loadReadTypescript}=require('../../../scripts/security-regression/load-typescript.cjs');const oldBaseline=process.env.DOYA_TEST_BASELINE;process.env.DOYA_TEST_BASELINE=process.env.DOYA_E2E_APP;
  let pageRequests=0,maxPageBytes=0;
  const departmentClient=loadReadTypescript('src/lib/hr/department-list-client.ts',{}, {AbortController,TextDecoder,Uint8Array,setTimeout,clearTimeout,fetch:async(input,options)=>{
   const headers=new Headers(options?.headers);headers.set('Cookie','next-auth.session-token='+tokens.B);const r=await fetch(origin+input,{...options,headers});const clone=r.clone();const bytes=(await clone.arrayBuffer()).byteLength;maxPageBytes=Math.max(maxPageBytes,bytes);pageRequests++;assert.ok(bytes<1024*1024);return r;
  }});if(oldBaseline===undefined)delete process.env.DOYA_TEST_BASELINE;else process.env.DOYA_TEST_BASELINE=oldBaseline;
  before=await snapshot();let list=await departmentClient.loadHrDepartmentList(undefined,'hr-B');let expectedRows=await db.hrDepartment.findMany({where:{organizationId:'hr-B'}});assert.equal(list.rows.length,expectedRows.length);assert.equal(new Set(list.rows.map(r=>r.id)).size,expectedRows.length);assert.ok(pageRequests>=3);assert.ok(list.rows.some(r=>r.isActive===false));assert.deepEqual(await snapshot(),before);pass('Actual client reconstructs every paged department including inactive rows exactly once');
  let firstPage=await departmentPage();assert.ok(firstPage.nextCursor);await db.hrDepartment.update({where:{id:'hr-read-0000'},data:{name:'変更後'}});await departmentPage('format=pages&cursor='+encodeURIComponent(firstPage.nextCursor),409);pass('Department changes between pages invalidate actual snapshot cursor');
  firstPage=await departmentPage();await db.hrEmployee.update({where:{id:'hr-self-B'},data:{departmentId:'hr-read-0001'}});await departmentPage('format=pages&cursor='+encodeURIComponent(firstPage.nextCursor),409);await db.hrEmployee.update({where:{id:'hr-self-B'},data:{departmentId:'hr-dept-B'}});pass('Employee reassignment invalidates actual department count snapshot cursor');
  firstPage=await departmentPage();await db.hrOrganizationMember.update({where:bMember,data:{status:'INACTIVE'}});await departmentPage('format=pages&cursor='+encodeURIComponent(firstPage.nextCursor),401);await db.hrOrganizationMember.update({where:bMember,data:{status:'ACTIVE'}});pass('Membership revocation prevents continuation of paged department read');
  const sessionB=await db.session.findUnique({where:{sessionToken:tokens.B}});firstPage=await departmentPage();await db.session.update({where:{sessionToken:tokens.B},data:{expires:new Date(0)}});await departmentPage('format=pages&cursor='+encodeURIComponent(firstPage.nextCursor),401);await db.session.upsert({where:{sessionToken:tokens.B},update:{expires:sessionB.expires},create:sessionB});pass('Session expiration prevents continuation of paged department read');
  const countBefore=await db.hrEmployee.count({where:{organizationId:'hr-B',departmentId:'hr-dept-B'}});await db.hrEmployee.create({data:{id:'hr-read-foreign-assignment',organizationId:'hr-A',departmentId:'hr-dept-B',employeeNumber:'read-foreign',firstName:'FOREIGN',lastName:'SYNTHETIC',status:'ACTIVE'}});list=await departmentClient.loadHrDepartmentList(undefined,'hr-B');assert.equal(list.rows.find(r=>r.id==='hr-dept-B').employeeCount,countBefore);const legacyCount=await fetch(origin+'/api/hr/departments',{headers:{Cookie:'next-auth.session-token='+tokens.B}}).then(r=>r.json());assert.equal(legacyCount.flat.find(r=>r.id==='hr-dept-B').employeeCount,countBefore);pass('Legacy and paged employee counts exclude foreign organization assignments');
  const giant='営"\\\n😀'.repeat(600000);assert.ok(Buffer.byteLength(JSON.stringify(giant))>4.5*1024*1024);await db.hrDepartment.create({data:{id:'hr-read-giant',organizationId:'hr-B',name:giant}});const giantStart=pageRequests;list=await departmentClient.loadHrDepartmentList(undefined,'hr-B');assert.equal(list.rows.find(r=>r.id==='hr-read-giant').name,giant);assert.ok(pageRequests-giantStart>50);assert.ok(maxPageBytes<1024*1024);pass('Actual database and client preserve a field larger than4.5MiB through bounded responses');
  await db.hrDepartment.delete({where:{id:'hr-read-giant'}});
  await db.hrDepartment.createMany({data:Array.from({length:5000},(_,i)=>({id:'hr-read-deep-'+String(i).padStart(5,'0'),organizationId:'hr-B',name:'深階層'+i,parentId:i?'hr-read-deep-'+String(i-1).padStart(5,'0'):null,sortOrder:i}))});
  const deepResponse=await fetch(origin+'/api/hr/departments',{headers:{Cookie:'next-auth.session-token='+tokens.B},signal:AbortSignal.timeout(35000)});assert.equal(deepResponse.status,200);assert.equal(deepResponse.headers.get('cache-control'),'private, no-store');const deep=JSON.parse(await deepResponse.text());assert.equal(deep.flat.length,await db.hrDepartment.count({where:{organizationId:'hr-B'}}));let node=deep.departments.find(r=>r.id==='hr-read-deep-00000'),depth=0;while(node){depth++;node=node.children[0]}assert.equal(depth,5000);const deepStack=[...deep.departments],deepIds=new Set();while(deepStack.length){const row=deepStack.pop();assert.ok(!deepIds.has(row.id));deepIds.add(row.id);deepStack.push(...row.children)}assert.equal(deepIds.size,deep.flat.length);pass('Actual Next legacy GET serializes5000-deep hierarchy without loss or stack overflow');
  assert.equal(cases.length,80);
  const files=['src/lib/hr/department-input.ts','src/lib/hr/department-mutation.ts','src/app/api/hr/departments/[id]/route.ts','src/app/hr/org-chart/page.tsx','src/components/hr/OrgChartView.tsx','src/lib/hr/org-chart-paged-client.ts','src/lib/hr/org-chart-pagination.ts','src/app/api/hr/departments/route.ts','src/app/api/hr/org-chart/route.ts','src/app/api/kintai/departments/route.ts','src/lib/private-api-response.ts','src/lib/hr/access.ts','src/lib/kintai/access.ts','src/lib/auth.ts','prisma/schema.prisma','src/lib/hr/department-operation.ts','src/app/api/hr/department-operation/route.ts',base+'verify-hr-department-read-next.cjs',base+'hr-department-read-next-supervise.py'];files.push('src/app/hr/settings/page.tsx','src/app/hr/employees/new/page.tsx','src/app/hr/employees/[id]/edit/page.tsx','src/components/hr/HrAuthenticatedScope.tsx','src/components/hr/DepartmentListState.tsx','src/lib/hr/department-list-client.ts','src/lib/hr/use-department-list.ts','src/lib/hr/department-hierarchy.ts','src/lib/hr/use-page-lifetime.ts','src/lib/hr/department-pagination.ts');assert.equal(files.length,29);const report={checkedAt:new Date().toISOString(),expected:80,passed:cases.length,cases,sourceHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f.startsWith(base)?f:require('node:path').join(process.env.DOYA_E2E_APP,f))).digest('hex')])),scope:'Actual built Next/auth/Prisma GETs against isolated Unix-only full-schema PostgreSQL. Two synthetic organizations and actors, member versus manager employee visibility, unlinked/inactive/unknown-role membership, revoked session, private response headers, and complete domain-row snapshots before/after every GET; inactive parent/employee department, foreign parent, role-restricted unassigned employees and resigned employee exclusion. Original68 cases retained plus12 paged/deep/large-field/authority/count read scenarios. Source hashes use the isolated built candidate source. Actual session authentication, real SQL and complete actual client chart larger than1MiB; controlled concurrency lock interleavings additionally require realPG47. No production/customer DB, paid provider, real OAuth/browser cache hit.'};fs.writeFileSync(base+'hr-department-read-next-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }finally{await db.$disconnect()}
})().catch(e=>{console.error(e);process.exitCode=1});
