const assert=require('node:assert/strict');
const {load}=require('./load-typescript.cjs');
const conflict={code:'P2002',meta:{modelName:'HrEmployee',target:['organizationId','employeeNumber']},message:'SYNTHETIC_PRIVATE_DATABASE_DETAIL'};
const helper=load('src/lib/hr/employee-number.ts');
function fixture(method,error,authenticated=true){
 let usageWrites=0;
 const employee={id:'synthetic-employee',organizationId:'synthetic-org',firstName:'Synthetic',lastName:'Employee',status:'ACTIVE',updatedAt:new Date('2026-01-01T00:00:00.000Z'),department:null,histories:[],evaluations:[],oneOnOnesAsEmployee:[]};
 const prisma={hrEmployee:{findFirst:async({where})=>{assert.equal(where.organizationId,'synthetic-org');return employee;},findMany:async({where})=>{assert.equal(where.organizationId,'synthetic-org');return[employee];},count:async()=>1},$transaction:async()=>{throw error;}};
 const api=load(method==='PATCH'||method==='DETAIL'?'src/app/api/hr/employees/[id]/route.ts':'src/app/api/hr/employees/route.ts',{
  'next/server':{NextResponse:Response},'next-auth':{getServerSession:async()=>authenticated?{user:{id:'synthetic-user'}}:null},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma},
  '@/lib/hr/access':{getHrContext:async()=>authenticated?{organizationId:'synthetic-org',userId:'synthetic-user',memberId:'synthetic-member',role:'ADMIN'}:null,hasMinRole:()=>true},
  '@/lib/hr/types':{HrMemberRole:{OWNER:'OWNER',ADMIN:'ADMIN',MANAGER:'MANAGER',MEMBER:'MEMBER'},EmployeeStatus:{ACTIVE:'ACTIVE',RESIGNED:'RESIGNED',ON_LEAVE:'ON_LEAVE',RETIRED:'RETIRED'}},
  '@/lib/hr/constants':{DEFAULT_PAGE_SIZE:50,MAX_PAGE_SIZE:200},
  '@/lib/hr/billing':{createWithinEmployeeLimit:async()=>{throw error;},employeeLimitMessage:()=>''},
  '@/lib/hr/evaluation-access':{getEvaluationReadWhere:async()=>({})},
  '@/lib/hr/one-on-one-access':{getOneOnOneReadWhere:async()=>({}),getOneOnOneViewer:async()=>({}),filterOneOnOneFields:value=>value},
  '@/lib/service-usage':{recordServiceUsage:async()=>{usageWrites++;throw Error('Usage must not be recorded for a failed write');}},
 });
 return{api,get usageWrites(){return usageWrites;}};
}
function privateResponse(r){assert.equal(r.headers.get('cache-control'),'private, no-store');assert.ok(r.headers.get('vary').split(',').some(v=>v.trim().toLowerCase()==='cookie'));}
(async()=>{
 let passed=0;
 for(const method of ['POST','PATCH'])for(const [name,error,status]of[
  ['employee number conflict',conflict,409],
  ['different unique field',{...conflict,meta:{modelName:'HrEmployee',target:['email']}},500],
  ['different model',{...conflict,meta:{modelName:'OtherModel',target:['organizationId','employeeNumber']}},500],
  ['database unavailable',{code:'P1001',message:'SYNTHETIC_PRIVATE_DATABASE_DETAIL'},500],
 ]){
  const f=fixture(method,error),body={firstName:'Synthetic',lastName:'Employee',employeeNumber:'DUPLICATE'};
  const r=await f.api[method](new Request('http://localhost/employees',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),{params:Promise.resolve({id:'synthetic-employee'})});
  assert.equal(r.status,status);privateResponse(r);const data=await r.json();assert.equal(JSON.stringify(data).includes('SYNTHETIC_PRIVATE_DATABASE_DETAIL'),false);assert.equal(f.usageWrites,0);
  if(status===409){assert.equal(data.code,'EMPLOYEE_NUMBER_CONFLICT');assert.equal(data.field,'employeeNumber');}else assert.notEqual(data.code,'EMPLOYEE_NUMBER_CONFLICT');
  console.log(`PASS ${method} ${name}: status, private response, no failed usage`);passed++;
 }
 for(const method of ['LIST','DETAIL'])for(const authenticated of [true,false]){
  const f=fixture(method,null,authenticated);const r=await f.api.GET({nextUrl:new URL('http://localhost/employees')},{params:Promise.resolve({id:'synthetic-employee'})});assert.equal(r.status,authenticated?200:401);privateResponse(r);const data=await r.json();if(authenticated)assert.equal(method==='LIST'?data.items[0].id:data.employee.id,'synthetic-employee');console.log(`PASS ${method} ${authenticated?'allowed':'denied'}: private response and payload`);passed++;
 }
 for(const [name,value,expected]of[
  ['reverse field order',{code:'P2002',meta:{target:['employeeNumber','organizationId']}},true],
  ['missing target',{code:'P2002'},false],
  ['extra unique fields',{code:'P2002',meta:{target:['organizationId','employeeNumber','other']}},false],
  ['ordinary error',new Error('SYNTHETIC_PRIVATE_DATABASE_DETAIL'),false],
 ]){assert.equal(helper.isEmployeeNumberConflict(value),expected);console.log('PASS constraint identity '+name);passed++;}
 console.log(passed+' employee API error/privacy cases passed; synthetic boundaries only.');
})().catch(error=>{console.error(error);process.exitCode=1;});
