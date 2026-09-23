const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const read = p => fs.readFileSync(path.join(__dirname, '../../', p), 'utf8');
const compile = s => ts.transpileModule(s, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
const ast = ts.createSourceFile('page.tsx', read('src/app/quote/documents/[id]/page.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let saveCode;
function walk(n) {
  if (ts.isFunctionDeclaration(n) && n.name?.text === 'save') saveCode = n.getText(ast);
  ts.forEachChild(n, walk);
}
walk(ast);
(async () => {
  const results = [];
  for (const [status, next, role, saving] of [
    ['confirmed','sent','manager',false], ['confirmed','draft','manager',false],
    ['sent','draft','manager',false], ['draft','confirmed','manager',false],
    ['confirmed',undefined,'manager',false], ['confirmed','sent','member',false],
    ['confirmed','sent','manager',true],
  ]) {
    let row = {id:'d', organizationId:'o', status, notes:'original', lineItems:[{itemName:'original',qty:1,unitPrice:100}]};
    const originalItems = JSON.stringify(row.lineItems);
    const bodies = [], errors = [];
    let itemWrites = 0;
    const prisma = {
      quoteDocument: {findFirst:async()=>({...row}), findUnique:async()=>row, update:async({data})=>(row={...row,...data})},
      quoteLineItem: {deleteMany:async()=>{itemWrites++;}, createMany:async()=>{itemWrites++;}},
      $transaction:async a=>a(prisma),
    };
    const deps = {'next/server':{NextResponse:Response}, '@/lib/prisma':{prisma},
      '@/lib/quote/access':{getQuoteContext:async()=>({organizationId:'o',userId:'u',role}),hasMinRole:()=>role==='manager',orgSlugFrom:()=> 'org'},
      '@/lib/quote/document':{recalcDocument:async()=>{}}};
    const exported = {};
    vm.runInNewContext(compile(read('src/app/api/quote/documents/[id]/route.ts')), {exports:exported, require:n=>{assert(n in deps,n);return deps[n];}});
    const env = {id:'d',doc:{...row},saving,notes:'edited',paymentTerms:'end of month',deliveryTerms:'next month',clientCompany:'company',clientPerson:'person',discountType:'',discountValue:'',items:[{itemName:'edited',qty:1,unitPrice:200}],withOrg:(_,p)=>p,
      fetch:async(_,o)=>{const body=JSON.parse(o.body);bodies.push(body);return exported.PATCH({json:async()=>body},{params:Promise.resolve({id:'d'})});},
      notifyError:(_,e)=>errors.push(e)};
    for (const k of ['Doc','Items','ClientCompany','ClientPerson','DiscountType','DiscountValue','Notes','PaymentTerms','DeliveryTerms','Saving','Error']) env['set'+k]=()=>{};
    const save = vm.runInNewContext(compile('('+saveCode+')'),env);
    await save(next ? {status:next} : {});
    if (saving || !next) {assert.equal(bodies.length,0);assert.equal(row.status,status);}
    else if (role==='member') {assert.equal(row.status,status);assert.equal(errors.length,1);}
    else {
      assert.equal(errors.length,0);assert.equal(row.status,next);
      if (status==='draft') {assert.equal(row.notes,'edited');assert.equal(itemWrites,2);assert.equal(bodies[0].items[0].unitPrice,200);}
      else {assert.deepEqual(bodies,[{status:next}]);assert.equal(itemWrites,0);assert.equal(row.notes,'original');assert.equal(JSON.stringify(row.lineItems),originalItems);}
    }
    results.push({status,next:next||'save',role,saving,outcome:'PASS'});
  }
  console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
