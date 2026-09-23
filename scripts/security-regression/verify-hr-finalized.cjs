const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
(async()=>{const results=[];
for(const operation of ['PATCH','POST'])for(const mode of ['draft','finalized','race','foreign','anonymous']){
 let row={id:'e',status:mode==='finalized'?'FINALIZED':'DRAFT',managerComment:'old',period:{organizationId:mode==='foreign'?'other':'o'}},writes=0;
 const deps={'@/lib/hr/evaluation-access':{canReadEvaluation:async()=>true,getEvaluationRatingField:async()=> 'finalRating'},'next/server':{NextResponse:Response},'next-auth':{getServerSession:async()=>mode==='anonymous'?null:{user:{id:'u'}}},'@/lib/auth':{authOptions:{}},'@/lib/hr/access':{getHrContext:async()=>({organizationId:'o'})},'@/lib/prisma':{prisma:{hrEvaluation:{findFirst:async()=>structuredClone(row),update:async({where,data})=>{assert.equal(where.status.not,'FINALIZED');if(mode==='race')row.status='FINALIZED';if(row.status==='FINALIZED')throw Object.assign(Error('conditional miss'),{code:'P2025'});writes++;return row={...row,...data};}}}}};
 const file='src/app/api/hr/evaluations/[id]/'+(operation==='POST'?'submit/':'')+'route.ts';const exported={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../../',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exported,require:n=>{assert(n in deps,n);return deps[n];}});
 const res=await exported[operation]({json:async()=>({managerComment:'new',status:'DRAFT'})},{params:Promise.resolve({id:'e'})});
 const expected=mode==='draft'?200:mode==='anonymous'?401:mode==='foreign'?403:mode==='finalized'&&operation==='POST'?400:409;assert.equal(res.status,expected);assert.equal(writes,mode==='draft'?1:0);
 if(['finalized','race'].includes(mode)){assert.equal(row.status,'FINALIZED');assert.equal(row.managerComment,'old');}
 if(mode==='draft')assert.equal(operation==='PATCH'?row.managerComment:row.status,operation==='PATCH'?'new':'SUBMITTED');results.push({operation,mode,status:res.status,outcome:'PASS'});
}
console.log(JSON.stringify(results,null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
