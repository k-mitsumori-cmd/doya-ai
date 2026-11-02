const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')
const {load,check,results}=require('./load-typescript.cjs')
const csv=load('src/lib/hr/employee-export.ts')
const employee={employeeNumber:'001',lastName:'合成,"姓"',firstName:'改行\n名',lastNameKana:null,firstNameKana:null,email:'test@example.invalid',phone:'09000123456',department:{code:'DEV'},position:'=1+1',grade:null,employmentType:'FULL_TIME',hireDate:new Date('2026-01-02T00:00:00Z'),birthDate:null,gender:null,status:'ACTIVE'}
let context={organizationId:'org-a',role:'OWNER'},read=0,records=[employee],outage=false
const api=load('src/app/api/hr/employees/export/route.ts',{
 'next/server':{NextResponse:Response},'@/lib/hr/access':{getHrContext:async()=>context,hasMinRole:role=>['OWNER','ADMIN'].includes(role)},
 '@/lib/hr/employee-export':csv,'@/lib/prisma':{prisma:{hrEmployee:{findMany:async query=>{
  read++;assert.deepEqual(JSON.parse(JSON.stringify(query.where)),{organizationId:context.organizationId});assert.equal(query.take,10001)
  assert(!('customFields' in query.select));assert(!('photoUrl' in query.select));if(outage)throw Error('private DB detail');return records
 }}}},
})
function privateHeaders(response){assert.equal(response.headers.get('cache-control'),'private, no-store');assert.match(response.headers.get('vary'),/Cookie/i)}
;(async()=>{
 for(const role of [null,'MEMBER','MANAGER','UNKNOWN'])await check('export denies '+role+' before database reads',async()=>{
  context=role?{organizationId:'org-a',role}:null;const before=read,r=await api.GET();assert.equal(r.status,role?403:401);privateHeaders(r);assert.equal(read,before)
 })
 for(const role of ['OWNER','ADMIN'])await check(role+' exports standard fields with safe CSV and private attachment',async()=>{
  context={organizationId:'org-a',role};records=[employee];const r=await api.GET();assert.equal(r.status,200);privateHeaders(r)
  assert.match(r.headers.get('content-type'),/^text\/csv/);assert.match(r.headers.get('content-disposition'),/^attachment;/)
  const bytes=Buffer.from(await r.arrayBuffer());assert.equal(bytes.subarray(0,3).toString('hex'),'efbbbf');const text=bytes.toString('utf8')
  assert(text.includes('"合成,""姓"""'));assert(text.includes('"改行\n名"'));assert(text.includes('"\'=1+1"'));assert(text.includes('"09000123456"'));assert(text.includes('"2026-01-02"'));assert(!text.includes('organizationId'))
 })
 await check('empty organization exports headers, not a fake employee',async()=>{records=[];const r=await api.GET();privateHeaders(r);assert.equal((await r.text()).trim().split('\r\n').length,1)})
 await check('10000 rows are complete and 10001 is an explicit error, never a partial CSV',async()=>{
  records=Array(10000).fill({...employee,lastName:'Synthetic',firstName:'Person'});let r=await api.GET();assert.equal(r.status,200);assert.equal((await r.text()).trim().split('\r\n').length,10001)
  records=Array(10001).fill(employee);r=await api.GET();assert.equal(r.status,413);privateHeaders(r);assert.equal((await r.json()).code,'HR_EXPORT_ROW_LIMIT')
 })
 await check('database failures are private JSON and hide internal details',async()=>{outage=true;const r=await api.GET();outage=false;assert.equal(r.status,500);privateHeaders(r);assert(!JSON.stringify(await r.json()).includes('private DB'))})
 await check('UTF8 byte size is bounded before sending a partial attachment',async()=>{records=[{...employee,lastName:'山'.repeat(1400000)}];const r=await api.GET();assert.equal(r.status,413);privateHeaders(r);assert.equal((await r.json()).code,'HR_EXPORT_SIZE_LIMIT');assert(!r.headers.has('content-disposition'))})
 await check('formula prefixes including leading whitespace/control characters are neutralized',async()=>{
  for(const value of ['=1+1','+SUM(A1)','-1','@SUM(A1)',' \t=1','\ufeff+1','\r=1','\tplain'])assert(csv.employeeCsv([{...employee,lastName:value}]).includes('"\''+value.replace(/"/g,'""')+'"'))
 })
 const source=fs.readFileSync('src/app/(shell)/hr/employees/page.tsx','utf8'),ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let handler
 function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='handleExport')handler=n.initializer.getText(ast);ts.forEachChild(n,visit)}visit(ast);assert(handler)
 const compiled=ts.transpileModule('('+handler+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
 function ui(fetcher){let clicks=0,errors=[],requests=0,current=true;const env={exportingRef:{current:false},exportMounted:{current:true},exportAbort:{current:null},canManageEmployees:true,isCurrent:()=>current,AbortController,
  setExporting(){},setExportError:v=>errors.push(v),HrStatusError:class extends Error{constructor(status){super('status');this.status=status}},hrErrorStatus:e=>e.status,
  fetch:async(...args)=>{requests++;return fetcher(...args)},URL:{createObjectURL:()=> 'blob:synthetic',revokeObjectURL(){}},setTimeout:fn=>fn(),
  document:{createElement:()=>({click(){clicks++},remove(){}}),body:{appendChild(){}}}}
  return{run:vm.runInNewContext(compiled,env),env,changed:()=>current=false,get clicks(){return clicks},get errors(){return errors},get requests(){return requests}}
 }
 await check('UI prevents duplicate clicks and downloads exactly one successful CSV',async()=>{let done;const gate=new Promise(resolve=>done=resolve),u=ui(async()=>{await gate;return new Response('csv',{headers:{'content-type':'text/csv'}})});const first=u.run();await u.run();assert.equal(u.requests,1);done();await first;assert.equal(u.clicks,1)})
 await check('UI never downloads a late response after organization change or unmount',async()=>{for(const mode of ['org','unmount']){let done;const gate=new Promise(resolve=>done=resolve),u=ui(async()=>{await gate;return new Response('csv',{headers:{'content-type':'text/csv'}})});const pending=u.run();if(mode==='org')u.changed();else u.env.exportMounted.current=false;done();await pending;assert.equal(u.clicks,0)}})
 await check('UI treats413 and wrong content types as errors without downloads',async()=>{for(const response of [new Response('private detail',{status:413}),Response.json({error:'wrong contract'})]){const u=ui(async()=>response);await u.run();assert.equal(u.clicks,0);assert(u.errors.at(-1)>=400)}})
 console.log(JSON.stringify({passed:results.length,results}))
})().catch(error=>{console.error(error);process.exitCode=1})
