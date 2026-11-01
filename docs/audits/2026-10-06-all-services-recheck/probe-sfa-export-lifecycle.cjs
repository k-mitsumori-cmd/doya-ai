const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {load}=require('../../../scripts/security-regression/load-typescript.cjs');
(async()=>{
 let actorActive=true,contextChecks=0,pages=0,readsAfterRevocation=0;
 const stamp=new Date('2026-10-01T00:00:00.000Z');
 const rows=Array.from({length:501},(_,i)=>({id:String(i).padStart(6,'0'),name:'Synthetic '+i,industry:null,prefecture:null,address:null,url:null,corporateNumber:null,employeeCount:null,creditRank:null,createdAt:stamp}));
 const prisma={sfaAccount:{findFirst:async()=>({id:'000500'}),findMany:async({where,take})=>{pages++;if(!actorActive)readsAfterRevocation++;const page=rows.filter(r=>!where.id.gt||r.id>where.id.gt).slice(0,take);if(pages===1)actorActive=false;return page;}}};
 const route=load('src/app/api/sfa/export/route.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma},'@/lib/sfa/access':{getSfaContext:async()=>{contextChecks++;return actorActive?{organizationId:'org',userId:'actor',memberId:'member'}:null;},orgSlugFrom:()=> 'org'}},{TextEncoder,ReadableStream});
 const response=await route.GET(new Request('https://local.test/api/sfa/export?type=accounts&org=org'));
 assert.equal(response.status,200);const reader=response.body.getReader();const first=await reader.read();assert.equal(first.done,false);actorActive=false;
 let bytes=first.value.length;while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.length;}
 assert.ok(readsAfterRevocation>0);assert.equal(contextChecks,1);assert.equal(pages,2);assert.ok(!response.headers.get('vary')?.toLowerCase().includes('cookie'));assert.ok(!response.headers.get('cache-control')?.includes('private'));
 const file='src/app/api/sfa/export/route.ts';const result={checkedAt:new Date().toISOString(),status:'confirmed-follow-up-gaps-not-repaired',findings:['Streaming CSV continues reading/exporting next page after actor loses membership; context is checked once only.','Authenticated CSV response lacks private cache directive and Vary Cookie.'],pageReads:pages,readsAfterRevocation,contextChecks,completedBytes:bytes,sourceHash:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),scope:'Actual export handler with 501 synthetic rows, native Response/ReadableStream and synthetic context/database revocation timing. No real DB concurrency, production request, customer data or provider calls. Formula escaping and finite pagination already exist; not classified as missing.'};
 fs.writeFileSync('docs/audits/2026-10-06-all-services-recheck/sfa-export-lifecycle-baseline.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({findings:result.findings.length,pageReads:pages,readsAfterRevocation,contextChecks}));
})().catch(e=>{console.error(e);process.exitCode=1});
