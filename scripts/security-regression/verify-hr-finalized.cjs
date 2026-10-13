const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
(async()=>{const results=[];
for(const operation of ['PATCH','POST'])for(const mode of ['draft','finalized','race','foreign','anonymous']){
 let row={updatedAt:new Date('2026-09-01T00:00:00Z'),employeeId:'subject',evaluatorId:'reviewer',id:'e',status:mode==='finalized'?'FINALIZED':'DRAFT',managerComment:'old',period:{organizationId:mode==='foreign'?'other':'o'}},writes=0;
 const deps={'@/lib/hr/evaluation-access':{canReadEvaluation:async()=>true,getEvaluationRatingField:async()=> 'finalRating'},'next/server':{NextResponse:Response},'next-auth':{getServerSession:async()=>mode==='anonymous'?null:{user:{id:'u'}}},'@/lib/auth':{authOptions:{}},'@/lib/hr/access':{getHrContext:async()=>({organizationId:'o',userId:'u',memberId:'m',role:'OWNER',employeeId:null})},'@/lib/prisma':{prisma:{hrEvaluation:{findFirst:async()=>structuredClone(row),update:async({where,data})=>{assert.equal(where.status.not,'FINALIZED');if(mode==='race')row.status='FINALIZED';if(row.status==='FINALIZED')throw Object.assign(Error('conditional miss'),{code:'P2025'});writes++;return row={...row,...data};}}}}};
 const prisma=deps['@/lib/prisma'].prisma;
 prisma.$transaction=async fn=>fn(prisma);prisma.$queryRaw=async strings=>strings.join('').includes('hr_organization_members')?[{role:'OWNER',status:'ACTIVE',employeeId:null}]:strings.join('').includes('hr_organizations')?[{id:'o'}]:[];
 prisma.hrEvaluation.findUniqueOrThrow=async()=>row;
 prisma.hrEvaluation.updateMany=async options=>{try{await prisma.hrEvaluation.update(options);return{count:1}}catch(error){if(error.code==='P2025')return{count:0};throw error}};
 Object.assign(deps,{...require('./hr-evaluation-fixture.cjs').evaluationDependencies(prisma),'@/lib/hr/evaluation-access':deps['@/lib/hr/evaluation-access']});
 const file='src/app/api/hr/evaluations/[id]/'+(operation==='POST'?'submit/':'')+'route.ts';const exported={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../../',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exported,require:n=>{assert(n in deps,n);return deps[n];}});
 const res=await exported[operation](new Request('https://synthetic.invalid/evaluation',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(operation==='POST'?{expectedUpdatedAt:row.updatedAt.toISOString()}:{managerComment:'new',status:'DRAFT',expectedUpdatedAt:row.updatedAt.toISOString()})}),{params:Promise.resolve({id:'e'})});
 const expected=mode==='draft'?200:mode==='anonymous'?401:mode==='foreign'?403:409;assert.equal(res.status,expected);assert.equal(writes,mode==='draft'?1:0);
 if(['finalized','race'].includes(mode)){assert.equal(row.status,'FINALIZED');assert.equal(row.managerComment,'old');}
 if(mode==='draft')assert.equal(operation==='PATCH'?row.managerComment:row.status,operation==='PATCH'?'new':'SUBMITTED');results.push({operation,mode,status:res.status,outcome:'PASS'});
}
console.log(JSON.stringify(results,null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
