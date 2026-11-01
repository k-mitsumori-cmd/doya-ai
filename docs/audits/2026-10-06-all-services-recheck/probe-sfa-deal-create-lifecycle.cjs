const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {fixture,deferred,props}=require('../../../scripts/security-regression/sfa-client-fixture.cjs');
const results=[];
const open=async f=>f.act(()=>props([...f.container.querySelectorAll('button')].find(b=>b.textContent.includes('商談を追加'))).onClick());
(async()=>{
 let f=await fixture('deals');
 try{
  await open(f);await f.edit('input[placeholder^="例: 新規SaaS"]','Synthetic deal');const hold=deferred();f.reply(async()=>{await hold.promise;return Response.json({deal:{id:'new-deal'}})});
  let one,two;await f.act(()=>{const handler=props(f.button('追加する')).onClick;one=handler();two=handler()});assert.equal(f.writes.length,2);assert.ok(f.writes.every(r=>!r.body.operationId));
  await f.act(()=>{hold.resolve()});await f.act(()=>Promise.all([one,two]));results.push({name:'Current deal creation still sends two same-frame POSTs without operation UUID',observedPosts:2,confirmed:true});
 }finally{await f.close()}
 f=await fixture('deals');
 try{
  await open(f);await f.edit('input[placeholder^="例: 新規SaaS"]','Alpha draft');const hold=deferred();f.reply(async()=>{await hold.promise;return Response.json({deal:{id:'new-deal'}})});
  let operation;await f.act(()=>{operation=props(f.button('追加する')).onClick()});await f.org('beta');await open(f);await f.edit('input[placeholder^="例: 新規SaaS"]','Beta draft');
  const before=f.notices.length;await f.act(()=>{hold.resolve()});await f.act(()=>operation);assert.ok(!f.container.querySelector('input[placeholder^="例: 新規SaaS"]'));assert.ok(f.notices.slice(before).some(n=>n.kind==='success'));
  results.push({name:'Current retained deal page announces old-organization success and closes newer form after late response',confirmed:true,scope:'Actual component retained with mocked navigation; production layout identity remount is separately verified, so draft loss is not claimed for actual Next routing. Unscoped toast callback remains an open lifecycle issue.'});
 }finally{await f.close()}
 const files=['src/app/sfa/[orgSlug]/deals/page.tsx','scripts/security-regression/sfa-client-fixture.cjs'];const report={checkedAt:new Date().toISOString(),findings:results.length,results,sourceHashes:Object.fromEntries(files.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')])),scope:'Read-only source plus synthetic actual mounted page and fake transport only. No customer data/provider/production writes. This is a separate unresolved deal-business lifecycle cohort, not a regression in repaired task/activity clients.'};fs.writeFileSync('docs/audits/2026-10-06-all-services-recheck/sfa-deal-create-lifecycle-baseline.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({confirmedFindings:results.length}));
})().catch(e=>{console.error(e);process.exitCode=1});
