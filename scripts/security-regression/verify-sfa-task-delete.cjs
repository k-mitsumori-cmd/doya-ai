const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const ast=ts.createSourceFile('p.tsx',fs.readFileSync(path.join(__dirname,'../../src/app/sfa/[orgSlug]/tasks/page.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let code;
function walk(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='remove')code=n.initializer.getText(ast);ts.forEachChild(n,walk);}walk(ast);
(async()=>{const results=[];
for(const mode of ['success','403','404','500','network','malformed','duplicate','retry']){
 let tasks=[{id:'a'},{id:'b'}],calls=0,release;const errors=[];const lock={current:new Set()};
 const pending=new Promise(r=>release=r);
 const env={load:()=>{},Error,orgSlug:'org',pendingRef:lock,setPendingIds:()=>{},setTasks:f=>tasks=f(tasks),sfaInit:(_,p)=>p,toast:{error:e=>errors.push(e)},fetch:async()=>{calls++;if(mode==='duplicate')await pending;if(mode==='network')throw Error('network');if(['403','404','500'].includes(mode)||mode==='retry'&&calls===1)return Response.json({error:'blocked'},{status:mode==='retry'?500:Number(mode)});return Response.json(mode==='malformed'?{}:{ok:true});}};
 const remove=vm.runInNewContext(ts.transpileModule('('+code+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,env);
 const p=remove({id:'a'});assert.equal(tasks.length,2,'must remain pending');
 if(mode==='duplicate'){await remove({id:'a'});assert.equal(calls,1);release();}
 await p;
 const good=['success','duplicate'].includes(mode);assert.equal(tasks.length,good?1:2);assert.equal(errors.length,good?0:1);assert.equal(lock.current.size,0);
 if(mode==='retry'){await remove({id:'a'});assert.equal(tasks.length,1);assert.equal(calls,2);}
 assert.equal(tasks.at(-1).id,'b');results.push({mode,outcome:'PASS'});
}
console.log(JSON.stringify(results,null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
