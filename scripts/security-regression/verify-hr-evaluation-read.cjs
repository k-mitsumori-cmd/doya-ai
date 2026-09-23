const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function load(file,deps){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../../',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{assert(n in deps,n);return deps[n];}});return exports;}
(async()=>{const results=[];
for(const role of ['OWNER','ADMIN','MANAGER','MEMBER','UNKNOWN'])for(const relation of ['self','evaluator','unrelated','unlinked','inactive','role-changed','foreign-org']){
 const ctx={organizationId:'o',userId:'u',memberId:'m',role};
 const member={id:'m',userId:'u',organizationId:'o',status:relation==='inactive'?'INACTIVE':'ACTIVE',role:relation==='role-changed'?'OTHER':role,employeeId:relation==='self'?'e':relation==='evaluator'?'reviewer':relation==='unlinked'?null:'other'};
 const evaluation={id:'ev',employeeId:'e',evaluatorId:'reviewer',period:{organizationId:relation==='foreign-org'?'other':'o'},selfComment:'private',employee:{lastName:'Test',firstName:'Person'}};
 const prisma={hrEvaluation:{findFirst:async()=>evaluation},hrOrganizationMember:{findFirst:async({where})=>{assert.deepEqual(JSON.parse(JSON.stringify(where)),{id:'m',userId:'u',organizationId:'o',status:'ACTIVE'});return Object.entries(where).every(([k,v])=>member[k]===v)?member:null;}}};
 const helper=load('src/lib/hr/evaluation-access.ts',{'@/lib/prisma':{prisma}});
 const api=load('src/app/api/hr/evaluations/[id]/route.ts',{'next/server':{NextResponse:Response},'next-auth':{getServerSession:async()=>({user:{id:'u'}})},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma},'@/lib/hr/access':{getHrContext:async()=>ctx},'@/lib/hr/evaluation-access':helper});
 const res=await api.GET({}, {params:Promise.resolve({id:'ev'})});
 const allowed=role!=='UNKNOWN'&&!['inactive','role-changed','foreign-org'].includes(relation)&&(['OWNER','ADMIN'].includes(role)||['self','evaluator'].includes(relation));
 assert.equal(res.status,allowed?200:403,role+'/'+relation);const body=await res.json();assert.equal(Boolean(body.evaluation),allowed);results.push({role,relation,status:res.status,outcome:'PASS'});
}
console.log(JSON.stringify(results,null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
