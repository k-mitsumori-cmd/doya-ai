const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../../src/app/api/sfa/deals/route.ts'),'utf8');
const {parseSfaAmount}=require('./load-typescript.cjs').load('src/lib/sfa/amount.ts');
(async()=>{const results=[];
for(const mode of ['open','won','lost','default-won','no-stages','foreign','missing']) {
 let saved=null,usage=0;const wanted=mode==='default-won'?'won':mode;const stage=['no-stages','missing'].includes(mode)?null:{id:'s',pipeline:{organizationId:mode==='foreign'?'other':'o'},probability:wanted==='won'?100:wanted==='lost'?0:30,isWon:wanted==='won',isLost:wanted==='lost'};
 const prisma={sfaStage:{findUnique:async()=>stage,findFirst:async()=>stage},sfaDeal:{create:async({data})=>{saved=data;return {id:'d',...data};}}};
 const deps={'next/server':{NextResponse:Response},'@/lib/prisma':{prisma},'@/lib/sfa/access':{getSfaContext:async()=>({organizationId:'o',memberId:'m',userId:'u'}),orgSlugFrom:()=> 'org'},'@/lib/sfa/format':{bigIntToNumber:o=>JSON.parse(JSON.stringify(o,(_,v)=>typeof v==='bigint'?Number(v):v))},'@/lib/sfa/amount':{parseSfaAmount},'@/lib/service-usage':{recordServiceUsage:async()=>{usage++;}},'@/lib/sfa/limits':{withSfaAdmission:async(_org,_requested,create)=>({created:await create(prisma)}),sfaQuotaResponse:()=>Response.json({error:'limit'},{status:402})}};
 const exported={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exported,require:n=>{assert(n in deps,n);return deps[n];}});
 const response=await exported.POST({json:async()=>({name:'Synthetic deal',amount:100,stageId:['default-won','no-stages'].includes(mode)?undefined:'s'})});
 if(['foreign','missing'].includes(mode)){assert.equal(response.status,400);assert.equal(saved,null);assert.equal(usage,0);}
 else{assert.equal(response.status,200);const expected=['won','lost'].includes(wanted)?wanted:'open';assert.equal(saved.status,expected);assert.equal(saved.stageId,mode==='no-stages'?null:'s');assert.equal(Boolean(saved.wonAt),expected==='won');assert.equal(Boolean(saved.lostAt),expected==='lost');if(expected!=='open')assert.equal(saved[expected+'At'].getTime(),saved.lastActivityAt.getTime());assert.equal(saved.probability,stage?.probability??0);assert.equal((await response.json()).deal.status,expected);assert.equal(usage,1);}
 results.push({mode,outcome:'PASS'});
}
console.log(JSON.stringify(results,null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
