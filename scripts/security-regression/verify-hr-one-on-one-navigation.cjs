const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const {check,results}=require('./load-typescript.cjs');
const source=fs.readFileSync('src/app/hr/one-on-one/[id]/page.tsx','utf8'),ast=ts.createSourceFile('x.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let effect,save;
function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='useEffect')effect=n.arguments[0].getText(ast);if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='handleSave')save=n.initializer.getText(ast);ts.forEachChild(n,visit)}visit(ast);
const compile=s=>ts.transpileModule('('+s+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const flush=()=>new Promise(r=>setImmediate(r));
function fixture(){const state={record:null,error:null,loading:false},pending=[];function bind(id){const env={id,Error,fetch:(url,options)=>new Promise(resolve=>pending.push({url,options,resolve})),setLoading:v=>state.loading=v,setError:v=>state.error=v,setRecord:v=>state.record=typeof v==='function'?v(state.record):v};return{effect:vm.runInNewContext(compile(effect),env),save:vm.runInNewContext(compile(save),env)}}return{state,pending,bind};}
(async()=>{
await check('old GET response ignored after route switch',async()=>{const f=fixture(),clean=f.bind('a').effect();clean();f.bind('b').effect();f.pending[1].resolve(Response.json({oneOnOne:{id:'b'}}));await flush();f.pending[0].resolve(Response.json({oneOnOne:{id:'a'}}));await flush();assert.equal(f.state.record.id,'b');assert.equal(f.state.loading,false)});
await check('old failure cannot replace newer successful record',async()=>{const f=fixture(),clean=f.bind('a').effect();clean();f.bind('b').effect();f.pending[1].resolve(Response.json({id:'b'}));await flush();f.pending[0].resolve(Response.json({}, {status:500}));await flush();assert.equal(f.state.error,null);assert.equal(f.state.record.id,'b')});
await check('route change clears previous errors and record',async()=>{const f=fixture();f.state.record={id:'a'};f.state.error='old';f.bind('b').effect();assert.equal(f.state.record,null);assert.equal(f.state.error,null);assert.equal(f.state.loading,true)});
await check('mismatched GET id not displayed',async()=>{const f=fixture();f.bind('a').effect();f.pending[0].resolve(Response.json({id:'b'}));await flush();assert.equal(f.state.record,null);assert.ok(f.state.error)});
await check('wrong form id rejected before PATCH',async()=>{const f=fixture();await assert.rejects(f.bind('b').save({recordId:'a'}));assert.equal(f.pending.length,0)});
await check('old save response cannot merge into another record',async()=>{const f=fixture();f.state.record={id:'a'};const p=f.bind('a').save({recordId:'a'});f.state.record={id:'b',managerNote:'new'};f.pending[0].resolve(Response.json({id:'a',managerNote:'old'}));await p;assert.equal(f.state.record.id,'b');assert.equal(f.state.record.managerNote,'new')});
await check('wrong save response id rejected',async()=>{const f=fixture();f.state.record={id:'a'};const p=f.bind('a').save({recordId:'a'});f.pending[0].resolve(Response.json({id:'b'}));await assert.rejects(p);assert.equal(f.state.record.id,'a')});
console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
