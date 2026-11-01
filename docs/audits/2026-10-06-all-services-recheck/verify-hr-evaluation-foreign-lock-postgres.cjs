const path=require('path'),assert=require('assert/strict');
const root=process.cwd(),{PrismaClient,Prisma}=require(path.join(root,'node_modules/@prisma/client')),{load}=require(path.join(root,'scripts/security-regression/load-typescript.cjs'));
(async()=>{const socket=process.env.DOYA_SFA_AUTHORITY_PG_SOCKET;assert.match(socket,/^\/tmp\/doya-sfa-authority-[a-f0-9]{8}\/socket$/);const db=new PrismaClient({datasources:{db:{url:`postgresql://doya_sfa@localhost:56481/postgres?host=${socket}&sslmode=disable&pgbouncer=false`}}});
try{
 const safe=await db.$queryRawUnsafe('SELECT inet_server_addr() AS address');assert.equal(safe[0].address,null);
 await db.user.create({data:{id:'actor-a',email:'a@example.invalid'}});for(const id of ['org-a','org-b'])await db.hrOrganization.create({data:{id,slug:id,name:id}});
 await db.hrOrganizationMember.create({data:{id:'member-a',organizationId:'org-a',userId:'actor-a',role:'OWNER',status:'ACTIVE'}});
 await db.hrEmployee.create({data:{id:'employee-b',organizationId:'org-b',firstName:'Synthetic',lastName:'B'}});
 await db.hrEvaluationPeriod.create({data:{id:'period-b',organizationId:'org-b',name:'Synthetic',startDate:new Date('2099-01-01'),endDate:new Date('2099-12-31')}});
 await db.hrEvaluation.create({data:{id:'evaluation-b',employeeId:'employee-b',periodId:'period-b'}});
 const scope=load('src/lib/hr/evaluation-scope.ts'),input=load('src/lib/hr/evaluation-input.ts'),access=load('src/lib/hr/evaluation-access.ts',{'@/lib/prisma':{prisma:db},'@/lib/hr/evaluation-scope':scope}),mutation=load('src/lib/hr/evaluation-mutation.ts'),ai=load('src/lib/hr/evaluation-ai-access.ts',{'@prisma/client':{Prisma},'@/lib/hr/evaluation-access':access,'@/lib/hr/evaluation-input':input});
 let locked;const lockedPromise=new Promise(r=>locked=r),events=[];let foreign;
 const legitimate=db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM hr_organizations WHERE id = ${'org-b'} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM hr_evaluation_periods WHERE id = ${'period-b'} FOR UPDATE`;events.push('legitimate-period-locked');
  foreign=mutation.runHrEvaluationMutation(db,{organizationId:'org-a',userId:'actor-a',memberId:'member-a',role:'OWNER',employeeId:null},real=>{
   const traced=new Proxy(real,{get(target,key){if(key==='$queryRaw')return async(...args)=>{const result=await target.$queryRaw(...args);if(String(args[0]).includes('hr_evaluations')&&result.length){events.push('foreign-evaluation-locked-before-denial');locked()}return result};const value=target[key];return typeof value==='function'?value.bind(target):value}});
   return ai.readHrEvaluationForAi(traced,{organizationId:'org-a',userId:'actor-a',memberId:'member-a',role:'OWNER',employeeId:null},'evaluation-b',null)
  }).then(value=>({value}),error=>({error}));
  const outcome=await Promise.race([foreign,new Promise((_,reject)=>setTimeout(()=>reject(Error('Foreign request waited on legitimate period lock')),2000))]);
  assert.equal(outcome.error?.status,403);events.push('foreign-denied-without-waiting');
  await tx.$queryRaw`SELECT id FROM hr_evaluations WHERE id = ${'evaluation-b'} ORDER BY id FOR UPDATE`;
 },{timeout:15000}).then(value=>({value}),error=>({error}));
 const lr=await legitimate,fr=await foreign;const errors=[lr.error,fr.error].filter(Boolean);const deadlock=errors.some(e=>JSON.stringify(e).includes('40P01')||String(e).includes('deadlock detected'));
 console.log(JSON.stringify({privateUnixOnly:true,events,deadlockReproduced:deadlock,legitimateFailed:!!lr.error,foreignFailed:!!fr.error,errors:errors.map(e=>({code:e.code,meta:e.meta,message:String(e).slice(-500)}))},null,2));assert.equal(deadlock,false);assert.equal(lr.error,undefined);assert.equal(fr.error?.status,403);assert.ok(events.includes('foreign-denied-without-waiting'));assert.ok(!events.includes('foreign-evaluation-locked-before-denial'));
const ctx={organizationId:'org-a',userId:'actor-a',memberId:'member-a',role:'OWNER',employeeId:null};
const {evaluationDependencies}=require(path.join(root,'scripts/security-regression/hr-evaluation-fixture.cjs'));
const deps={...evaluationDependencies(db),'next/server':{NextResponse:Response},'next-auth':{getServerSession:async()=>({user:{id:ctx.userId}})},'@/lib/auth':{},'@/lib/prisma':{prisma:db},'@/lib/hr/access':{getHrContext:async()=>ctx}};
const patch=load('src/app/api/hr/evaluations/[id]/route.ts',deps),submit=load('src/app/api/hr/evaluations/[id]/submit/route.ts',deps),extraCases=[];
const bounded=async(promise)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Foreign scope waited on a legitimate locked row')),2000))])}finally{clearTimeout(timer)}};
const foreignEvaluation=await db.hrEvaluation.findUniqueOrThrow({where:{id:'evaluation-b'}});
for(const [name,handler,method] of [['PATCH',patch.PATCH,'PATCH'],['submit',submit.POST,'POST']]){
 await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM hr_evaluations WHERE id = ${'evaluation-b'} FOR UPDATE`;
  const response=await bounded(handler(new Request('https://synthetic.invalid/',{method,headers:{'content-type':'application/json'},body:JSON.stringify({expectedUpdatedAt:foreignEvaluation.updatedAt.toISOString()})}),{params:Promise.resolve({id:'evaluation-b'})}));assert.equal(response.status,403);assert.equal(response.headers.get('cache-control'),'private, no-store');
 });extraCases.push(name+' rejects foreign evaluation403 without waiting on its lock');
}
await db.hrEmployee.create({data:{id:'employee-a',organizationId:'org-a',firstName:'Synthetic',lastName:'A'}});
await db.hrEvaluationPeriod.create({data:{id:'period-a',organizationId:'org-a',name:'Synthetic A',startDate:new Date('2099-01-01'),endDate:new Date('2099-12-31')}});
const own=await db.hrEvaluation.create({data:{id:'evaluation-a',employeeId:'employee-a',periodId:'period-a'}});
await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM hr_employees WHERE id = ${'employee-b'} FOR UPDATE`;
 const response=await bounded(patch.PATCH(new Request('https://synthetic.invalid/',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({expectedUpdatedAt:own.updatedAt.toISOString(),evaluatorId:'employee-b'})}),{params:Promise.resolve({id:own.id})}));assert.equal(response.status,400);assert.equal((await tx.hrEvaluation.findUniqueOrThrow({where:{id:own.id}})).evaluatorId,null);
});extraCases.push('Foreign evaluator rejected400 without waiting on employee lock or persisting assignment');
const files=['src/lib/hr/evaluation-ai-access.ts','src/lib/hr/evaluation-access.ts','src/lib/hr/evaluation-input.ts','src/lib/hr/evaluation-scope.ts','src/lib/hr/evaluation-mutation.ts','src/lib/hr/evaluation-save-operation.ts','src/lib/private-api-response.ts','src/app/api/hr/evaluations/[id]/route.ts','src/app/api/hr/evaluations/[id]/submit/route.ts','scripts/security-regression/hr-evaluation-fixture.cjs',__filename];const fs=require('fs'),crypto=require('crypto');fs.writeFileSync(path.join(root,'docs/audits/2026-10-06-all-services-recheck/hr-evaluation-foreign-lock-postgres.json'),JSON.stringify({checkedAt:new Date().toISOString(),passed:7,cases:['Private Unix-only PostgreSQL','Foreign request denied403 before legitimate period lock is released','Legitimate evaluation write completes without deadlock','Foreign evaluation row is never locked',...extraCases].map(name=>({name,passed:true})),events,deadlockReproduced:false,sourceHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),scope:'Actual current AI access and mutation helpers, real Prisma and private Unix-only PostgreSQL. Deterministic simultaneous foreign-ID request and legitimate period/evaluation mutation. No production DB/provider/customer writes.'},null,2)+'\n');
}finally{await db.$disconnect()}})().catch(e=>{console.error(e);process.exitCode=1});
