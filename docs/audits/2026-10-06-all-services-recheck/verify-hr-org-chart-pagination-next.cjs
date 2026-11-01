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

  assert.equal(cases.length,38);const files=['src/app/hr/org-chart/page.tsx','src/components/hr/OrgChartView.tsx','src/lib/hr/org-chart-paged-client.ts','src/lib/hr/org-chart-pagination.ts','src/app/api/hr/departments/route.ts','src/app/api/hr/org-chart/route.ts','src/app/api/kintai/departments/route.ts','src/lib/private-api-response.ts','src/lib/hr/access.ts','src/lib/kintai/access.ts','src/lib/auth.ts','prisma/schema.prisma',base+'verify-hr-org-chart-pagination-next.cjs',base+'hr-org-chart-pagination-next-supervise.py'];const report={checkedAt:new Date().toISOString(),expected:38,passed:cases.length,cases,sourceHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),scope:'Actual built Next/auth/Prisma GETs against isolated Unix-only full-schema PostgreSQL. Two synthetic organizations and actors, member versus manager employee visibility, unlinked/inactive/unknown-role membership, revoked session, private response headers, and complete domain-row snapshots before/after every GET; inactive parent/employee department, foreign parent, role-restricted unassigned employees and resigned employee exclusion. Original25 legacy cases retained plus10 paged protocol cases, actual session authentication, real SQL and complete actual client chart larger than1MiB. No production/customer DB, paid provider, real OAuth/browser cache hit.'};fs.writeFileSync(base+'hr-org-chart-pagination-next-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }finally{await db.$disconnect()}
})().catch(e=>{console.error(e);process.exitCode=1});
