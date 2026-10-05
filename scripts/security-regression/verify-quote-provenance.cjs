const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const read=f=>fs.readFileSync(path.join(__dirname,'../../',f),'utf8');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function load(file,deps){const exports={};vm.runInNewContext(compile(read(file)),{exports,require:n=>{assert(n in deps,n);return deps[n];}});return exports;}
(async()=>{
 const results=[];
 for(const source of ['own_price','market','competitor','manual','ai_estimate','unknown','invalid']) {
  let row={id:'d',status:'draft',lineItems:[]};
  const prisma={quoteMember:{findFirst:async()=>({role:'manager'})},quoteIssuer:{findUnique:async()=>null},quoteDocument:{count:async()=>0,create:async({data})=>{row={...row,...data,lineItems:data.lineItems.create};return row;},findFirst:async()=>row,findUnique:async()=>row,update:async({data})=>row={...row,...data}},quoteLineItem:{deleteMany:async()=>{row.lineItems=[];},createMany:async({data})=>{row.lineItems=data;}}};
  prisma.$transaction=async fn=>fn(prisma);
  const deps={'next/server':{NextResponse:Response},'@/lib/prisma':{prisma},'@/lib/quote/access':{getQuoteContext:async()=>({organizationId:'o',userId:'u',role:'manager'}),orgSlugFrom:()=> 'org',hasMinRole:()=>true},'@/lib/quote/document':{defaultExpiry:()=>new Date(),nextQuoteNo:async()=> 'Q',recalcDocument:async()=>{}},'@/lib/plan-limit':{assertFreeLimit:async()=>({ok:true,used:0,limit:3}),FREE_LIMITS:{quoteDocuments:3},jstStartOfMonthUtc:()=>new Date()},'@/lib/organization-quota-ledger':{getOrganizationQuotaUsage:async(_db,_key,_org,_period,countLive)=>countLive(),recordOrganizationQuotaUsage:async()=>{}},'@/lib/pricing':{SUPPORT_CONTACT_URL:'https://doyamarke.surisuta.jp/contact'},'@/lib/organization-billing':{getOrganizationOwnerUserId:async()=> 'u'},'@/lib/service-usage':{recordServiceUsage:async()=>{}}};
  const create=load('src/app/api/quote/documents/route.ts',deps),update=load('src/app/api/quote/documents/[id]/route.ts',deps);
  const item={itemName:'Synthetic work',qty:2,unitPrice:100,taxRate:10,priceSource:source,sourceRef:'2 days x 100',rangeMin:100,rangeMax:300};
  for(const method of ['POST','PATCH']) {
   const req={json:async()=>({items:[item]})};const response=method==='POST'?await create.POST(req):await update.PATCH(req,{params:Promise.resolve({id:'d'})});
   assert.equal(response.status,200);const saved=row.lineItems[0];assert.equal(saved.priceSource,source==='invalid'?'manual':source);assert.equal(saved.sourceRef,item.sourceRef);assert.equal(saved.rangeMin,100);assert.equal(saved.rangeMax,300);
   results.push({method,source,savedSource:saved.priceSource,outcome:'PASS'});
  }
  if(source==='own_price') {
   for(const [field,value] of [['qty',1.5],['qty','１,５'],['unitPrice',1.5],['unitPrice','1,5'],['unitPrice',2147483648]]) {
    const before=JSON.stringify(row.lineItems);
    for(const [method,handler] of [['POST',req=>create.POST(req)],['PATCH',req=>update.PATCH(req,{params:Promise.resolve({id:'d'})})]]) {
     const response=await handler({json:async()=>({items:[{...item,[field]:value}]})});
     assert.equal(response.status,400,`${method} ${field}=${value}`);
     assert.equal(JSON.stringify(row.lineItems),before,`${method} must not replace saved items`);
    }
   }
   const discount=await update.PATCH({json:async()=>({discountValue:1.5})},{params:Promise.resolve({id:'d'})});
   assert.equal(discount.status,400);
   results.push({case:'quote API rejects fractional, malformed and out-of-range money before write',outcome:'PASS'});
   for(const method of ['POST','PATCH']) {
    const handler=req=>method==='POST'?create.POST(req):update.PATCH(req,{params:Promise.resolve({id:'d'})});
    const noRange=await handler({json:async()=>({items:[{...item,rangeMin:null,rangeMax:null}]})});
    assert.equal(noRange.status,200,`${method} null market range`);
    assert.equal(row.lineItems[0].rangeMin,null);
    assert.equal(row.lineItems[0].rangeMax,null);
    const reducedTax=await handler({json:async()=>({items:[{...item,taxRate:8}]})});
    assert.equal(reducedTax.status,200,`${method} reduced tax`);
    assert.equal(row.lineItems[0].taxRate,8);
    for(const [field,value] of [['taxRate',9],['rangeMin',-1],['rangeMax',1.5],['rangeMin',{bad:true}]]) {
     const before=JSON.stringify(row.lineItems);
     const response=await handler({json:async()=>({items:[{...item,[field]:value}]})});
     assert.equal(response.status,400,`${method} ${field}=${value}`);
     assert.equal(JSON.stringify(row.lineItems),before,`${method} must preserve existing items`);
    }
    results.push({method,case:'null range stays null and invalid tax/range is rejected',outcome:'PASS'});
   }
   for(const [body,expected] of [
    [{discountType:'bad',discountValue:10},400],
    [{discountType:'rate',discountValue:101},400],
    [{discountType:'rate',discountValue:100},200],
    [{discountType:'amount',discountValue:200},200],
    [{discountType:'rate'},400],
   ]) {
    const before={type:row.discountType,value:row.discountValue};
    const response=await update.PATCH({json:async()=>body},{params:Promise.resolve({id:'d'})});
    assert.equal(response.status,expected,JSON.stringify(body));
    if(expected===400){assert.equal(row.discountType,before.type);assert.equal(row.discountValue,before.value);}
   }
   results.push({case:'invalid discount method and rates over 100 percent never change saved terms',outcome:'PASS'});
  }
 }
 // Execute the actual unit-price input callback on both editing screens.
 for(const file of ['src/app/quote/Tool.tsx','src/app/quote/documents/[id]/page.tsx']) {
  const ast=ts.createSourceFile('p.tsx',read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let callback;
  function walk(n){if(ts.isJsxAttribute(n)&&n.name.getText(ast)==='onChange'&&n.initializer?.expression){const c=n.initializer.expression.getText(ast);if(c.includes('unitPrice:')&&c.includes("sourceRef: '手入力'"))callback=c;}ts.forEachChild(n,walk);}walk(ast);assert(callback);
  let patch;const fn=vm.runInNewContext(compile('('+callback+')'),{idx:0,updateItem:(_,p)=>patch=p});
  for(const [value,expected] of [['300',300],['３００',300],['1,500',1500]]) {
   patch=undefined;fn({target:{value}});assert.equal(patch?.unitPrice,expected);assert.equal(patch?.priceSource,'manual');assert.equal(patch?.sourceRef,'手入力');
  }
  for(const value of ['1.5','1,5','abc','2147483648']) {
   patch=undefined;fn({target:{value}});assert.equal(patch,undefined,`${file}: ${value} must not silently change the amount`);
  }
  results.push({case:file+' manual edit and Japanese number input',outcome:'PASS'});
 }
 console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
