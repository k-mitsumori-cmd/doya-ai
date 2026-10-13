const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function load(file,deps){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../../',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{assert(n in deps,n);return deps[n];}});return exports;}
(async()=>{const results=[];
for(const method of ['PATCH','POST'])for(const role of ['OWNER','ADMIN','MANAGER','MEMBER','UNKNOWN'])for(const relation of ['self','evaluator','unrelated','unlinked','inactive','role-changed','foreign-org']){
 const ctx={organizationId:'o',userId:'u',memberId:'m',role};
 const member={id:'m',userId:'u',organizationId:'o',status:relation==='inactive'?'INACTIVE':'ACTIVE',role:relation==='role-changed'?'OTHER':role,employeeId:relation==='self'?'e':relation==='evaluator'?'reviewer':relation==='unlinked'?null:'other'};
 ctx.employeeId=member.employeeId;
 let evaluation={updatedAt:new Date('2026-09-01T00:00:00Z'),status:relation==='evaluator'&&!['OWNER','ADMIN'].includes(role)?'SUBMITTED':'DRAFT',id:'ev',employeeId:'e',evaluatorId:'reviewer',period:{organizationId:relation==='foreign-org'?'other':'o'},selfComment:'private'};
 let writes=0;
 const prisma={hrEvaluation:{findFirst:async()=>evaluation,update:async({data})=>{writes++;return {...evaluation,...data};}},hrOrganizationMember:{findFirst:async({where})=>{assert.deepEqual(JSON.parse(JSON.stringify(where)),{id:'m',userId:'u',organizationId:'o',status:'ACTIVE'});return Object.entries(where).every(([k,v])=>member[k]===v)?member:null;}}};
 prisma.hrEmployee={count:async({where})=>{assert.equal(where.organizationId,'o');return(typeof where.id==='string'?[where.id]:where.id.in).filter(id=>['e','reviewer','other'].includes(id)).length;}};
 prisma.$transaction=async fn=>fn(prisma);prisma.$queryRaw=async strings=>strings.join('').includes('hr_organization_members')?member.status==='ACTIVE'?[member]:[]:strings.join('').includes('hr_organizations')?[{id:'o'}]:[];
 prisma.hrEvaluation.updateMany=async({where,data})=>{assert.equal(where.id,'ev');assert.equal(where.updatedAt.getTime(),evaluation.updatedAt.getTime());writes++;evaluation={...evaluation,...data};return{count:1}};
 prisma.hrEvaluation.findUniqueOrThrow=async()=>evaluation;
 const dependencies=require('./hr-evaluation-fixture.cjs').evaluationDependencies(prisma);const helper=dependencies['@/lib/hr/evaluation-access'];
 const api=load('src/app/api/hr/evaluations/[id]/'+(method==='POST'?'submit/':'')+'route.ts',{...dependencies,'next/server':{NextResponse:Response},'next-auth':{getServerSession:async()=>({user:{id:'u'}})},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma},'@/lib/hr/access':{getHrContext:async()=>ctx},'@/lib/hr/evaluation-access':helper});
 const bodyInput=method==='POST'?{expectedUpdatedAt:evaluation.updatedAt.toISOString()}:{...(relation==='evaluator'&&!['OWNER','ADMIN'].includes(role)?{managerComment:'updated'}:{selfComment:'updated'}),expectedUpdatedAt:evaluation.updatedAt.toISOString()};const res=await api[method](new Request('https://synthetic.invalid/evaluation',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(bodyInput)}), {params:Promise.resolve({id:'ev'})});
 const allowed=role!=='UNKNOWN'&&!['inactive','role-changed','foreign-org'].includes(relation)&&(['OWNER','ADMIN'].includes(role)||['self','evaluator'].includes(relation));
 assert.equal(res.status,allowed?200:403,role+'/'+relation);const body=await res.json();assert.equal(Boolean(body.evaluation),allowed);assert.equal(writes,allowed?1:0);results.push({method,role,relation,status:res.status,outcome:'PASS'});
}
console.log(JSON.stringify(results,null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
