const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../../src/app/kintai/employees/page.tsx'),'utf8');
const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let callback;
function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='toggleActive')callback=n.initializer.getText(ast);ts.forEachChild(n,visit)}visit(ast);if(!callback)throw Error('Callback missing');
const code=ts.transpileModule('globalThis.toggle='+callback,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function harness(fetcher,initial=false,confirm=true){
 let rows=[{id:'employee',name:'synthetic',isActive:initial},{id:'other',name:'other',isActive:true}],calls=0,confirms=0,pending=new Set();const alerts=[];
 const sandbox={Set,window:{confirm:()=>{confirms++;return confirm}},JSON,alert:s=>alerts.push(s),togglingRef:{current:new Set()},setTogglingIds:v=>{pending=v},setEmployees:fn=>{rows=fn(rows)},fetch:async(...a)=>{calls++;return fetcher(...a)}};
 vm.runInNewContext(code,sandbox);return {toggle:()=>sandbox.toggle({...rows[0]}),state:()=>({rows,calls,confirms,alerts,pending:pending.size,locked:sandbox.togglingRef.current.size})};
}
const success=active=>Response.json({employee:{id:'employee',isActive:active}});
(async()=>{const results=[];
for(const [name,fetcher,initial,confirm,expected] of [
 ['activate',()=>success(true),false,true,true],['deactivate',()=>success(false),true,true,false],
 ['forbidden',()=>Response.json({error:'権限がありません'},{status:403}),false,true,false],
 ['server-error',()=>Response.json({error:'更新に失敗しました'},{status:500}),false,true,false],
 ['non-json-error',()=>new Response('unavailable',{status:503}),false,true,false],
 ['invalid-success',()=>Response.json({success:true}),false,true,false],
 ['network',()=>{throw Error('network')},false,true,false],
 ['cancel',()=>success(true),false,false,false],
 ]){
 const h=harness(fetcher,initial,confirm);await h.toggle();const s=h.state(),failExpected=!['activate','deactivate','cancel'].includes(name);
 const ok=s.rows[0].isActive===expected&&s.rows[1].isActive===true&&s.pending===0&&s.locked===0&&s.calls===(confirm?1:0)&&s.alerts.length===(failExpected?1:0);
 results.push({name,outcome:ok?'PASS':'FAIL',...s});
}
let resolve;const wait=new Promise(r=>{resolve=r});const duplicate=harness(()=>wait);const first=duplicate.toggle();await duplicate.toggle();const during=duplicate.state();resolve(success(true));await first;
results.push({name:'concurrent-duplicate',outcome:during.calls===1&&during.confirms===1&&during.locked===1&&duplicate.state().rows[0].isActive&&duplicate.state().locked===0?'PASS':'FAIL'});
let attempt=0;const retry=harness(()=>++attempt===1?Response.json({error:'temporary'},{status:500}):success(true));await retry.toggle();await retry.toggle();
results.push({name:'retry-after-failure',outcome:retry.state().calls===2&&retry.state().alerts.length===1&&retry.state().rows[0].isActive&&retry.state().locked===0?'PASS':'FAIL'});
console.log(JSON.stringify({cases:results.length,results},null,2));if(results.some(r=>r.outcome==='FAIL'))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
