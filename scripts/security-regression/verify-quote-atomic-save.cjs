const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const read = p => fs.readFileSync(path.join(__dirname,'../../',p),'utf8');
const compile = s => ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function moduleAt(file,deps) {
  const exports={};vm.runInNewContext(compile(read(file)),{exports,require:n=>{assert(n in deps,n);return deps[n];}});return exports;
}
(async()=>{
 const results=[];
 for(const fault of ['none','delete','create','metadata','totals','response','commit','confirmed','foreign','null']) {
  let row={id:'d',organizationId:'o',status:fault==='confirmed'?'confirmed':'draft',notes:'old',discountType:null,discountValue:0,totalExclTax:100,taxAmount:10,totalInclTax:110,lineItems:[{itemName:'old',qty:1,unitPrice:100,taxRate:10,priceSource:'manual'}]};
  const before=structuredClone(row);let active=false,reads=0,writes=0,transactions=0;
  const check=()=>assert.equal(active,true,'query escaped transaction');
  const fail=name=>{if(fault===name)throw Error('injected '+name);};
  const tx={quoteDocument:{
   findFirst:async({where})=>{check();assert.equal(where.organizationId,'o');return fault==='foreign'?null:structuredClone(row);},
   findUnique:async()=>{check();reads++;if(reads===2)fail('response');return structuredClone(row);},
   update:async({data})=>{check();writes++;fail('totalInclTax' in data?'totals':'metadata');row={...row,...data};return structuredClone(row);}
  },quoteLineItem:{
   deleteMany:async()=>{check();fail('delete');writes++;row.lineItems=[];},
   createMany:async({data})=>{check();fail('create');writes++;row.lineItems=structuredClone(data);}
  }};
  const prisma={$transaction:async(fn,options)=>{transactions++;assert.equal(options.isolationLevel,'Serializable');active=true;const snapshot=structuredClone(row);try {const res=await fn(tx);if(fault==='commit')throw Object.assign(Error('conflict'),{code:'P2034'});return res;}catch(e){row=snapshot;throw e;}finally{active=false;}}};
  const money=moduleAt('src/lib/quote/money.ts',{});
  const document=moduleAt('src/lib/quote/document.ts',{'@/lib/prisma':{prisma},'./money':money});
  const api=moduleAt('src/app/api/quote/documents/[id]/route.ts',{'next/server':{NextResponse:Response},'@/lib/prisma':{prisma},'@/lib/quote/document':document,'@/lib/quote/access':{getQuoteContext:async()=>({organizationId:'o',userId:'u',role:'manager'}),hasMinRole:()=>true,orgSlugFrom:()=> 'org'}});
  const body={status:'confirmed',notes:'new',items:[{itemName:'new',qty:2,unitPrice:200,taxRate:10,priceSource:'manual'},{itemName:'pending',qty:1,unitPrice:999,taxRate:10,priceSource:'unknown'}]};
  const res=await api.PATCH({json:async()=>fault==='null'?null:body},{params:Promise.resolve({id:'d'})});
  if(fault==='none') {assert.equal(res.status,200);assert.equal(row.status,'confirmed');assert.equal(row.notes,'new');assert.equal(row.lineItems.length,2);assert.equal(row.totalExclTax,400);assert.equal(row.taxAmount,40);assert.equal(row.totalInclTax,440);assert.equal((await res.json()).document.totalInclTax,440);}
  else {assert.equal(res.status,{confirmed:409,foreign:404,null:400,commit:409}[fault]||500);assert.deepEqual(row,before);if(['confirmed','foreign','null'].includes(fault))assert.equal(writes,0);}
  if(fault==='null')assert.equal(transactions,0);
  results.push({case:fault,status:res.status,outcome:'PASS'});
 }
 console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
