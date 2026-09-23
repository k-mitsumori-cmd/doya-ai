const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict');
const {check,results}=require('./load-typescript.cjs');
const source=fs.readFileSync('src/app/interview/projects/[id]/edit/page.tsx','utf8');
const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let titleCode,unloadCode;
function visit(n){
 if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='handleTitleChange')titleCode=n.initializer.getText(ast);
 if(ts.isCallExpression(n)&&n.expression.getText(ast)==='useEffect'&&n.arguments[0]?.getText(ast).includes('const beforeUnload'))unloadCode=n.arguments[0].getText(ast);
 ts.forEachChild(n,visit);
}visit(ast);
const compile=s=>ts.transpileModule('('+s+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
(async()=>{
 await check('title-only edits queue the new title and retain current body',async()=>{
  const calls=[],pending=new Map();let currentTitle='Old',saved=true,dirty=false,next=0;
  const unsavedRef={current:false},saveTimerRef={current:null},saveSequenceRef={current:0};
  const f=vm.runInNewContext(compile(titleCode),{content:'Body stays',unsavedRef,saveTimerRef,saveSequenceRef,setHasUnsavedChanges:v=>dirty=v,setLastSaved:v=>saved=v,setTitle:v=>currentTitle=v,clearTimeout:id=>pending.delete(id),setTimeout:fn=>{const id=++next;pending.set(id,fn);return id},autoSave:(...args)=>calls.push(args)});
  f('First title');f('Latest title');assert.equal(currentTitle,'Latest title');assert.equal(saved,null);assert.equal(dirty,true);assert.equal(unsavedRef.current,true);assert.equal(pending.size,1);
  for(const fn of pending.values())fn();assert.deepEqual(calls,[['Body stays','Latest title']]);
 });
 for(const dirty of [false,true])await check('browser exit warning dirty='+dirty,async()=>{
  const events=new Map(),cleared=[];const sequence={current:5};
  const effect=vm.runInNewContext(compile(unloadCode),{unsavedRef:{current:dirty},saveTimerRef:{current:123},saveSequenceRef:sequence,clearTimeout:id=>cleared.push(id),window:{addEventListener:(n,f)=>events.set(n,f),removeEventListener:(n,f)=>{assert.equal(events.get(n),f);events.delete(n)}}});
  const cleanup=effect();let prevented=false;const event={preventDefault:()=>prevented=true,returnValue:undefined};events.get('beforeunload')(event);assert.equal(prevented,dirty);
  cleanup();assert.equal(events.size,0);assert.deepEqual(cleared,[123]);assert.equal(sequence.current,6);
 });
 console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
