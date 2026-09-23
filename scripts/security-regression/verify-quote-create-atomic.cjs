const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function load(p,deps={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../../',p),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{assert(n in deps,n);return deps[n];}});return exports;}
(async()=>{
 const results=[];
 for(const mode of ['success','create','read','totals','commit','collision-once','collision-always']){
  let rows=[],active=false,usage=0,attempts=0,fail=mode;
  const tx={quoteDocument:{
   create:async({data})=>{assert(active);attempts++;if(fail==='create')throw Error('create');if(fail==='collision-always'||fail==='collision-once'&&attempts===1)throw Object.assign(Error('duplicate'),{code:'P2002'});const row={...data,id:'d'+attempts,status:'draft',discountValue:0,lineItems:data.lineItems.create};rows.push(row);return {id:row.id,quoteNo:row.quoteNo};},
   findUnique:async({where})=>{assert(active);if(fail==='read')throw Error('read');return rows.find(r=>r.id===where.id);},
   update:async({where,data})=>{assert(active);if(fail==='totals')throw Error('totals');Object.assign(rows.find(r=>r.id===where.id),data);}
  }};
  const prisma={quoteIssuer:{findUnique:async()=>null},quoteDocument:{findFirst:async()=>null},$transaction:async fn=>{const before=structuredClone(rows);active=true;try{const r=await fn(tx);if(fail==='commit')throw Error('commit');return r;}catch(e){rows=before;throw e;}finally{active=false;}}};
  const money=load('src/lib/quote/money.ts'),document=load('src/lib/quote/document.ts',{'@/lib/prisma':{prisma},'./money':money});
  const api=load('src/app/api/quote/documents/route.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma},'@/lib/quote/document':document,'@/lib/quote/access':{getQuoteContext:async()=>({organizationId:'o',userId:'u'}),orgSlugFrom:()=> 'org'},'@/lib/plan-limit':{assertFreeLimit:async()=>({ok:true})},'@/lib/service-usage':{recordServiceUsage:async()=>{usage++;}}});
  const req={json:async()=>({items:[{itemName:'work',qty:2,unitPrice:100,taxRate:10,priceSource:'manual'}]})};
  const response=await api.POST(req);
  const successful=['success','collision-once'].includes(mode);
  assert.equal(response.status,successful?200:500);
  assert.equal(rows.length,successful?1:0);assert.equal(usage,successful?1:0);
  if(successful){assert.equal(rows[0].totalInclTax,220);assert.equal(rows[0].totalExclTax,200);assert.equal(rows[0].taxAmount,20);}
  else{if(mode==='collision-always')assert.equal(attempts,5);fail='success';const retry=await api.POST(req);assert.equal(retry.status,200);assert.equal(rows.length,1);assert.equal(usage,1);assert.equal(rows[0].totalInclTax,220);}
  results.push({mode,outcome:'PASS',initialStatus:response.status,rowsAfterRetry:rows.length});
 }
 console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
