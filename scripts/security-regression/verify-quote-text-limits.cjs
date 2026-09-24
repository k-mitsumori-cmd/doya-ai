const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const read=f=>fs.readFileSync(path.join(__dirname,'../../',f),'utf8');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function load(file,deps){const exports={};vm.runInNewContext(compile(read(file)),{exports,require:n=>{assert(n in deps,n);return deps[n];}});return exports;}
(async()=>{
 const results=[];
 for(const field of ['notes','paymentTerms','deliveryTerms']) for(const length of [2000,2001]) {
  const source='manual';
  let row={id:'d',status:'draft',lineItems:[]};
  const prisma={quoteIssuer:{findUnique:async()=>null},quoteDocument:{count:async()=>0,create:async({data})=>{row={...row,...data,lineItems:data.lineItems.create};return row;},findFirst:async()=>row,findUnique:async()=>row,update:async({data})=>row={...row,...data}},quoteLineItem:{deleteMany:async()=>{row.lineItems=[];},createMany:async({data})=>{row.lineItems=data;}}};
  prisma.$transaction=async fn=>fn(prisma);
  const deps={'next/server':{NextResponse:Response},'@/lib/prisma':{prisma},'@/lib/quote/access':{getQuoteContext:async()=>({organizationId:'o',userId:'u',role:'manager'}),orgSlugFrom:()=> 'org',hasMinRole:()=>true},'@/lib/quote/document':{defaultExpiry:()=>new Date(),nextQuoteNo:async()=> 'Q',recalcDocument:async()=>{}},'@/lib/plan-limit':{assertFreeLimit:async()=>({ok:true,used:0,limit:3}),FREE_LIMITS:{quoteDocuments:3},jstStartOfMonthUtc:()=>new Date()},'@/lib/service-usage':{recordServiceUsage:async()=>{}}};
  const create=load('src/app/api/quote/documents/route.ts',deps),update=load('src/app/api/quote/documents/[id]/route.ts',deps);
  const item={itemName:'Synthetic work',qty:2,unitPrice:100,taxRate:10,priceSource:source,sourceRef:'2 days x 100',rangeMin:100,rangeMax:300};
  for(const method of ['POST','PATCH']) {
   row={id:'d',status:'draft',lineItems:[]};
   const value='あ'.repeat(length);
   const req={json:async()=>({items:[item],[field]:value})};
   const response=method==='POST'?await create.POST(req):await update.PATCH(req,{params:Promise.resolve({id:'d'})});
   assert.equal(response.status,length===2000?200:400);
   if(length===2000)assert.equal(row[field],value);
   else{assert.equal(row[field],undefined);assert.equal(row.lineItems.length,0);assert.match((await response.json()).error,/2,000/);}
   results.push({method,field,length,outcome:'PASS'});
  }
 }
 console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
