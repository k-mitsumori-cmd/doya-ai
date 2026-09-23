const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
function load(file,deps){const exported={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../../',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exported,Date,URL,console,require:n=>{if(n in deps)return deps[n];throw Error(n)}});return exported}
const types=load('src/lib/kintai/types.ts',{});
(async()=>{const results=[];
for(const mode of ['active','disable-patch','disable-delete','membership-inactive','disabled-clock_out','disabled-break_start','disabled-break_end']){
 let actor='admin',employee={id:'emp',organizationId:'org',isActive:true},status='ACTIVE';
 const records=[];
 const prisma={kintaiMember:{findFirst:async({where})=>{
  if(where.userId==='admin')return {id:'admin-member',userId:'admin',organizationId:'org',role:'system_admin',status:'ACTIVE',employee:{id:'admin-emp',isActive:true}};
  if(where.userId==='user'&&where.status===status)return {id:'member',userId:'user',organizationId:'org',role:'employee',status,employee:{...employee}};
  return null;
 }},kintaiEmployee:{findFirst:async({where})=>where.id===employee.id&&where.organizationId===employee.organizationId&&(where.isActive===undefined||where.isActive===employee.isActive)?{...employee}:null,update:async({data})=>{employee={...employee,...data};return {...employee}}},kintaiAttendance:{findFirst:async()=>null},kintaiClockRecord:{findMany:async()=>records,create:async({data})=>{const row={id:'clock',...data};records.push(row);return row}}};
 prisma.$queryRaw=async()=>employee.isActive?[{id:employee.id}]:[];
 prisma.$transaction=async fn=>fn(prisma);
 const access=load('src/lib/kintai/access.ts',{'next-auth':{getServerSession:async()=>({user:{id:actor}})},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma},'./types':types});
 const deps={'next/server':{NextResponse:Response},'@/lib/prisma':{prisma},'@/lib/kintai/access':access};
 const edit=load('src/app/api/kintai/employees/[id]/route.ts',deps);
 const clock=load('src/app/api/kintai/clock/route.ts',{...deps,'@/lib/kintai/recalculate':{recalculateDayForEmployee:()=>{throw Error('Unexpected recalculation')}},'@/lib/service-usage':{recordServiceUsage:async()=>{}}});
 let disableStatus=null;
 if(mode==='disable-patch'||mode==='disable-delete'||mode.startsWith('disabled-')){
  const req={json:async()=>({isActive:false})},ctx={params:Promise.resolve({id:'emp'})};
  const r=await (mode==='disable-delete'?edit.DELETE(req,ctx):edit.PATCH(req,ctx));disableStatus=r.status;
  if(r.status!==200||employee.isActive)throw Error('Disable setup failed');
 }
 if(mode==='membership-inactive')status='INACTIVE';
 actor='user';
 const context=await access.getKintaiContext();
 const r=await clock.POST({json:async()=>({type:mode.startsWith('disabled-')?mode.slice(9):'clock_in'}),headers:new Headers()});
 const body=await r.json();
 const readResponse=await clock.GET({url:'https://synthetic.invalid/api/kintai/clock'});
 if(readResponse.status!==(mode==='membership-inactive'?401:200))throw Error('History access regression');
 const expectedAllowed=mode==='active';
 const ok=expectedAllowed?r.status===200&&records.length===1:r.status===(mode==='membership-inactive'?401:403)&&records.length===0;
 results.push({name:mode,outcome:ok?'PASS':'FAIL',disableStatus,employeeActive:employee.isActive,membershipStatus:status,contextGranted:!!context,clockStatus:r.status,clockWrites:records.length,body});
}
console.log(JSON.stringify(results,null,2));if(results.some(r=>r.outcome==='FAIL'))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
