const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function load(p,deps={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../../',p),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{assert(n in deps,n);return deps[n];}});return exports;}
(async()=>{
 const results=[];
 for(const mode of ['success','create','read','totals','commit','collision-once','collision-always']){
  let rows=[],active=false,usage=0,attempts=0,fail=mode;
  const tx={quoteDocument:{
   count:async()=>rows.length,
   create:async({data})=>{assert(active);attempts++;if(fail==='create')throw Error('create');if(fail==='collision-always'||fail==='collision-once'&&attempts===1)throw Object.assign(Error('duplicate'),{code:'P2002'});const row={...data,id:'d'+attempts,status:'draft',discountValue:0,lineItems:data.lineItems.create};rows.push(row);return {id:row.id,quoteNo:row.quoteNo};},
   findUnique:async({where})=>{assert(active);if(fail==='read')throw Error('read');return rows.find(r=>r.id===where.id);},
   update:async({where,data})=>{assert(active);if(fail==='totals')throw Error('totals');Object.assign(rows.find(r=>r.id===where.id),data);}
  }};
  const prisma={quoteIssuer:{findUnique:async()=>null},quoteDocument:{findFirst:async()=>null},$transaction:async (fn,options)=>{assert.equal(options.isolationLevel,'Serializable');const before=structuredClone(rows);active=true;try{const r=await fn(tx);if(fail==='commit')throw Error('commit');return r;}catch(e){rows=before;throw e;}finally{active=false;}}};
  const money=load('src/lib/quote/money.ts'),document=load('src/lib/quote/document.ts',{'@/lib/prisma':{prisma},'./money':money});
  const api=load('src/app/api/quote/documents/route.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma},'@/lib/quote/document':document,'@/lib/quote/access':{getQuoteContext:async()=>({organizationId:'o',userId:'u'}),orgSlugFrom:()=> 'org'},'@/lib/plan-limit':{assertFreeLimit:async()=>({ok:true,used:0,limit:3}),FREE_LIMITS:{quoteDocuments:3},jstStartOfMonthUtc:()=>new Date()},'@/lib/service-usage':{recordServiceUsage:async()=>{usage++;}}});
  const req={json:async()=>({items:[{itemName:'work',qty:2,unitPrice:100,taxRate:10,priceSource:'manual'}]})};
  const response=await api.POST(req);
  const successful=['success','collision-once'].includes(mode);
  assert.equal(response.status,successful?200:500);
  assert.equal(rows.length,successful?1:0);assert.equal(usage,successful?1:0);
  if(successful){assert.equal(rows[0].totalInclTax,220);assert.equal(rows[0].totalExclTax,200);assert.equal(rows[0].taxAmount,20);}
  else{if(mode==='collision-always')assert.equal(attempts,5);fail='success';const retry=await api.POST(req);assert.equal(retry.status,200);assert.equal(rows.length,1);assert.equal(usage,1);assert.equal(rows[0].totalInclTax,220);}
  results.push({mode,outcome:'PASS',initialStatus:response.status,rowsAfterRetry:rows.length});
 }
 for(const [limit,expectedUpgrade] of [[3,'/quote/pricing'],[100,undefined]]){
  let checks=0,transactions=0,creates=0;
  const tx={quoteDocument:{count:async()=>limit,create:async()=>{creates++;throw Error('over limit create')}}};
  const prisma={quoteIssuer:{findUnique:async()=>null},quoteDocument:{findFirst:async()=>null},$transaction:async(fn,options)=>{transactions++;assert.equal(options.isolationLevel,'Serializable');if(transactions===1)throw Object.assign(Error('serialization'),{code:'P2034'});return fn(tx);}};
  const api=load('src/app/api/quote/documents/route.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma},'@/lib/quote/document':{defaultExpiry:()=>new Date(),nextQuoteNo:async()=> 'Q',recalcDocument:async()=>{}},'@/lib/quote/access':{getQuoteContext:async()=>({organizationId:'o',userId:'u'}),orgSlugFrom:()=> 'org'},'@/lib/plan-limit':{assertFreeLimit:async()=>++checks===1?{ok:true,used:limit-1,limit}:{ok:false,used:limit,limit,reason:'上限に達しました'},FREE_LIMITS:{quoteDocuments:3},jstStartOfMonthUtc:()=>new Date()},'@/lib/service-usage':{recordServiceUsage:async()=>{throw Error('must not record')}}});
  const response=await api.POST({json:async()=>({items:[]})});
  assert.equal(response.status,402);assert.equal(transactions,2);assert.equal(creates,0);
  const body=await response.json();assert.equal(body.code,'LIMIT_REACHED');assert.equal(body.upgradeUrl,expectedUpgrade);
  results.push({mode:`stale-${limit}-quota-after-serialization`,outcome:'PASS',initialStatus:response.status,rowsAfterRetry:0});
 }
 console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
