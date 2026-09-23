const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../../src/app/api/sfa/activities/route.ts'),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const iso=n=>`2026-09-${n}T00:00:00.000Z`;
const cases=[{name:'newer',dates:[19]},{name:'same',dates:[15]},{name:'older',dates:[1]},{name:'initial-null',initial:null,dates:[1]}, {name:'new-then-old',dates:[19,1]}, {name:'old-then-new',dates:[1,19]}, {name:'update-failure-rollback',dates:[19],fail:true},{name:'no-deal',dates:[19],noDeal:true}];
(async()=>{const results=[];
for(const c of cases){
 let latest=c.initial===null?null:new Date(iso(15)),activities=[],rollbacks=0,updates=0,queue=Promise.resolve();
 const initial=latest?.toISOString()||null;
 const tx={sfaActivity:{create:async({data})=>{const a={id:String(activities.length+1),...data};activities.push(a);return a}},sfaDeal:{updateMany:async({where,data})=>{
  updates++;if(c.fail)throw Error('synthetic update failure');
  const matches=where.id==='deal'&&where.organizationId==='org'&&where.OR.some(p=>p.lastActivityAt===null?latest===null:latest!==null&&latest<new Date(p.lastActivityAt.lt));
  if(matches)latest=new Date(data.lastActivityAt);return {count:matches?1:0};
 }}};
 const prisma={sfaDeal:{findUnique:async({where})=>where.id==='deal'?{organizationId:'org'}:null},$transaction:fn=>{const result=queue.then(async()=>{const saved={latest,activities:[...activities]};try{return await fn(tx)}catch(e){latest=saved.latest;activities=saved.activities;rollbacks++;throw e}});queue=result.catch(()=>{});return result}};
 const deps={'next/server':{NextResponse:Response},'@/lib/prisma':{prisma},'@/lib/sfa/access':{getSfaContext:async()=>({organizationId:'org',memberId:'member'}),orgSlugFrom:()=> 'org'}};
 const exported={};vm.runInNewContext(code,{exports:exported,Date,URL,require:n=>{if(n in deps)return deps[n];throw Error(n)}});
 const responses=await Promise.all(c.dates.map(day=>exported.POST({json:async()=>({subject:'synthetic',dealId:c.noDeal?undefined:'deal',occurredAt:iso(String(day).padStart(2,'0'))})})));
 const expected=c.fail||c.noDeal?initial:new Date(Math.max(initial?new Date(initial).getTime():-Infinity,...c.dates.map(n=>new Date(iso(String(n).padStart(2,'0'))).getTime()))).toISOString();
 const ok=(latest?.toISOString()||null)===expected&&activities.length===(c.fail?0:c.dates.length)&&responses.every(r=>r.status===(c.fail?500:200))&&(!c.fail||rollbacks===1)&&(!c.noDeal||updates===0);
 results.push({name:c.name,outcome:ok?'PASS':'FAIL',expected,actual:latest?.toISOString()||null,activities:activities.length,statuses:responses.map(r=>r.status),rollbacks});
}
console.log(JSON.stringify({cases:results.length,results},null,2));if(results.some(r=>r.outcome==='FAIL'))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
