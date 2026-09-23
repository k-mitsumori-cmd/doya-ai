const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const ast=ts.createSourceFile('p.tsx',fs.readFileSync(path.join(__dirname,'../../src/app/sfa/[orgSlug]/tasks/page.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),codes={};function walk(n){if(ts.isVariableDeclaration(n)&&['updateTask','toggle','changeDue','remove'].includes(n.name.getText(ast)))codes[n.name.getText(ast)]=n.initializer.getText(ast);ts.forEachChild(n,walk);}walk(ast);
(async()=>{const results=[];
for(const operation of ['toggle','changeDue'])for(const mode of ['success','500','network','malformed','wrong-id','duplicate','retry']){
 const initial={id:'a',status:'open',dueDate:null,dealName:'retained'};let tasks=[{...initial},{id:'b'}],calls=0,release;const errors=[],bodies=[];const lock={current:new Set()},pending=new Promise(r=>release=r);
 const env={load:()=>{},Error,orgSlug:'org',pendingRef:lock,setPendingIds:()=>{},setTasks:f=>tasks=f(tasks),sfaInit:(_,p)=>p,toast:{error:e=>errors.push(e)},fetch:async(_,o)=>{calls++;bodies.push(JSON.parse(o.body));if(mode==='duplicate')await pending;if(mode==='network')throw Error('network');if(mode==='500'||mode==='retry'&&calls===1)return Response.json({error:'blocked'},{status:500});return Response.json(mode==='malformed'?{}:{task:{id:mode==='wrong-id'?'other':'a',status:operation==='toggle'?'done':'open',dueDate:operation==='changeDue'?'2026-09-22T00:00:00.000Z':null}});}};
 for(const name of ['updateTask','toggle','changeDue','remove'])env[name]=vm.runInNewContext(ts.transpileModule('('+codes[name]+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,env);
 const p=env[operation](initial,'2026-09-22');assert.equal(tasks[0].status,'open');assert.equal(tasks[0].dueDate,null);
 if(mode==='duplicate'){await env[operation](initial,'2026-09-22');await env.remove(initial);assert.equal(calls,1);release();}
 await p;const good=['success','duplicate'].includes(mode);assert.equal(errors.length,good?0:1);assert.equal(lock.current.size,0);
 if(!good)assert.deepEqual(tasks[0],initial);
 if(mode==='retry')await env[operation](initial,'2026-09-22');
 if(good||mode==='retry'){assert.equal(tasks[0].status,operation==='toggle'?'done':'open');assert.equal(tasks[0].dueDate,operation==='changeDue'?'2026-09-22T00:00:00.000Z':null);assert.equal(tasks[0].dealName,'retained');}
 assert.equal(tasks[1].id,'b');assert.deepEqual(bodies[0],operation==='toggle'?{status:'done'}:{dueDate:'2026-09-22'});results.push({operation,mode,outcome:'PASS'});
}
console.log(JSON.stringify(results,null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
