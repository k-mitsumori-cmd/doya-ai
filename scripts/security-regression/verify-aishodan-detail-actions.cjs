const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')
const {check,results}=require('./load-typescript.cjs')
const ast=ts.createSourceFile('page.tsx',fs.readFileSync('src/app/aishodan/sessions/[id]/page.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
const actions={}
function visit(n){if(ts.isFunctionDeclaration(n)&&['override','reEvaluate'].includes(n.name?.text))actions[n.name.text]=n.getText(ast);ts.forEachChild(n,visit)}visit(ast)
function fixture(name,response){let error='',saving=false,loads=0,calls=0;const context={id:'synthetic',d:{outcome:null},setSaving:v=>saving=v,setError:v=>error=v,notifyError:(setter,text)=>setter(text),MANUAL_FIT_SCORE:{hot:85},withOrg:(_s,u)=>u,fetch:async()=>{calls++;return response()},load:async()=>loads++,window:{confirm:()=>false},Error};const action=vm.runInNewContext(ts.transpileModule('('+actions[name]+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);return{run:()=>action(name==='override'?'hot':false),state:()=>({error,saving,loads,calls})}}
;(async()=>{
 for(const name of ['override','reEvaluate']){
  await check(name+' transport rejection is handled without claiming failure or resubmitting',async()=>{const f=fixture(name,()=>{throw Error('PRIVATE_TRANSPORT_DETAIL')});await f.run();const s=f.state();assert.ok(s.error.includes('確認できませんでした'));assert.ok(s.error.includes('再読み込み'));assert.ok(!s.error.includes('PRIVATE_TRANSPORT_DETAIL'));assert.equal(s.saving,false);assert.equal(s.loads,0);assert.equal(s.calls,1)})
  await check(name+' server error remains visible and releases saving state',async()=>{const f=fixture(name,()=>Response.json({error:'Synthetic unavailable'},{status:503}));await f.run();assert.equal(f.state().error,'Synthetic unavailable');assert.equal(f.state().saving,false);assert.equal(f.state().loads,0)})
  await check(name+' success reloads authoritative result once',async()=>{const f=fixture(name,()=>Response.json({ok:true}));await f.run();assert.equal(f.state().error,'');assert.equal(f.state().saving,false);assert.equal(f.state().loads,1);assert.equal(f.state().calls,1)})
 }
 console.log(JSON.stringify({passed:results.length,results},null,2))
})().catch(e=>{console.error(e);process.exitCode=1})
