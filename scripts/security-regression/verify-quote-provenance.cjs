const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const read=f=>fs.readFileSync(path.join(__dirname,'../../',f),'utf8');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function load(file,deps){const exports={};vm.runInNewContext(compile(read(file)),{exports,require:n=>{assert(n in deps,n);return deps[n];}});return exports;}
(async()=>{
 const results=[];
 for(const source of ['own_price','market','competitor','manual','ai_estimate','unknown','invalid']) {
  let row={id:'d',status:'draft',lineItems:[]};
  const prisma={quoteIssuer:{findUnique:async()=>null},quoteDocument:{create:async({data})=>{row={...row,...data,lineItems:data.lineItems.create};return row;},findFirst:async()=>row,findUnique:async()=>row,update:async({data})=>row={...row,...data}},quoteLineItem:{deleteMany:async()=>{row.lineItems=[];},createMany:async({data})=>{row.lineItems=data;}}};
  prisma.$transaction=async fn=>fn(prisma);
  const deps={'next/server':{NextResponse:Response},'@/lib/prisma':{prisma},'@/lib/quote/access':{getQuoteContext:async()=>({organizationId:'o',userId:'u',role:'manager'}),orgSlugFrom:()=> 'org',hasMinRole:()=>true},'@/lib/quote/document':{defaultExpiry:()=>new Date(),nextQuoteNo:async()=> 'Q',recalcDocument:async()=>{}},'@/lib/plan-limit':{assertFreeLimit:async()=>({ok:true})},'@/lib/service-usage':{recordServiceUsage:async()=>{}}};
  const create=load('src/app/api/quote/documents/route.ts',deps),update=load('src/app/api/quote/documents/[id]/route.ts',deps);
  const item={itemName:'Synthetic work',qty:2,unitPrice:100,taxRate:10,priceSource:source,sourceRef:'2 days x 100',rangeMin:100,rangeMax:300};
  for(const method of ['POST','PATCH']) {
   const req={json:async()=>({items:[item]})};const response=method==='POST'?await create.POST(req):await update.PATCH(req,{params:Promise.resolve({id:'d'})});
   assert.equal(response.status,200);const saved=row.lineItems[0];assert.equal(saved.priceSource,source==='invalid'?'manual':source);assert.equal(saved.sourceRef,item.sourceRef);assert.equal(saved.rangeMin,100);assert.equal(saved.rangeMax,300);
   results.push({method,source,savedSource:saved.priceSource,outcome:'PASS'});
  }
 }
 // Execute the actual unit-price input callback on both editing screens.
 for(const file of ['src/app/quote/Tool.tsx','src/app/quote/documents/[id]/page.tsx']) {
  const ast=ts.createSourceFile('p.tsx',read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let callback;
  function walk(n){if(ts.isJsxAttribute(n)&&n.name.getText(ast)==='onChange'&&n.initializer?.expression){const c=n.initializer.expression.getText(ast);if(c.includes('unitPrice:')&&c.includes("sourceRef: '手入力'"))callback=c;}ts.forEachChild(n,walk);}walk(ast);assert(callback);
  let patch;const fn=vm.runInNewContext(compile('('+callback+')'),{idx:0,updateItem:(_,p)=>patch=p});fn({target:{value:'300'}});assert.equal(patch.unitPrice,300);assert.equal(patch.priceSource,'manual');assert.equal(patch.sourceRef,'手入力');results.push({case:file+' manual edit',outcome:'PASS'});
 }
 console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
