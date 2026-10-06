const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const read = p => fs.readFileSync(path.join(__dirname, '../../', p), 'utf8');
const compile = s => ts.transpileModule(s, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
const { spawnSync } = require('node:child_process');
const mounted = spawnSync(process.execPath, [path.join(__dirname, 'verify-quote-document-mounted.cjs'), '--group=transitions'], { stdio: 'inherit', timeout: 60000 });
if (mounted.error || mounted.status !== 0) process.exit(1);
(async () => {
  const results = [];
  // Direct API calls must not bypass the UI's approval sequence or edit a sealed quote.
  for (const [status, body, role, expected] of [
    ['draft', {status:'sent'}, 'manager', 409],
    ['sent', {status:'confirmed'}, 'manager', 409],
    ['confirmed', {status:'draft'}, 'member', 403],
    ['confirmed', {notes:'changed'}, 'manager', 409],
    ['sent', {clientCompany:'changed'}, 'manager', 409],
  ]) {
    let writes = 0;
    const prisma = {
      quoteMember: {findFirst:async()=>({role})},
      quoteDocument: {findFirst:async()=>({id:'d',status}), update:async()=>{writes++;}, findUnique:async()=>({id:'d',status})},
      quoteLineItem: {deleteMany:async()=>{writes++;},createMany:async()=>{writes++;}},
      $transaction:async fn=>fn(prisma),
    };
    const deps = {'next/server':{NextResponse:Response}, '@/lib/prisma':{prisma},
      '@/lib/quote/access':{getQuoteContext:async()=>({organizationId:'o',userId:'u',role}),hasMinRole:()=>role==='manager',orgSlugFrom:()=> 'org'},
      '@/lib/quote/document':{recalcDocument:async()=>{}}};
    const exported = {};
    vm.runInNewContext(compile(read('src/app/api/quote/documents/[id]/route.ts')), {exports:exported,require:n=>{assert(n in deps,n);return deps[n];}});
    const response = await exported.PATCH({json:async()=>body},{params:Promise.resolve({id:'d'})});
    assert.equal(response.status,expected);
    assert.equal(writes,0);
    results.push({status,body,role,outcome:'PASS'});
  }
  console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
