const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const {check,results}=require('./load-typescript.cjs');
const source=fs.readFileSync('src/app/interview/projects/[id]/edit/page.tsx','utf8');
const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let code;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='autoSave')code=n.initializer.arguments[0].getText(ast);ts.forEachChild(n,visit)}visit(ast);
const compiled=ts.transpileModule('('+code+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function setup(fetch){const state={saved:null,error:null,saving:false};const fn=vm.runInNewContext(compiled,{unsavedRef:{current:false},setHasUnsavedChanges:()=>{},draftId:'draft',title:'Title',fetch,Date,Error,draftVersionsRef:{current:{draft:'2026-09-20T00:00:00.000Z'}},saveQueueRef:{current:Promise.resolve()},saveSequenceRef:{current:0},setLastSaved:v=>state.saved=v,setSaveError:v=>state.error=v,setSaving:v=>state.saving=v});return{fn,state};}
(async()=>{
 for(const mode of ['ok','403','500','network','invalid-json','false-success','wrong-draft'])await check('autosave '+mode,async()=>{
  const f=setup(async()=>{if(mode==='network')throw Error('Offline');if(mode==='invalid-json')return new Response('broken');return Response.json({success:mode!=='false-success',draft:{id:mode==='wrong-draft'?'other':'draft',updatedAt:'2026-09-20T00:00:01.000Z'}},{status:['403','500'].includes(mode)?Number(mode):200})});
  await f.fn('New content');assert.equal(!!f.state.saved,mode==='ok');assert.equal(!!f.state.error,mode!=='ok');assert.equal(f.state.saving,false);
 });
 for(const firstFails of [false,true])await check('serialized saves, firstFails='+firstFails,async()=>{
  const calls=[];let release;const f=setup(async(_,options)=>{const content=JSON.parse(options.body).content;calls.push(content);if(content==='older')await new Promise(r=>release=r);return Response.json({success:true,draft:{id:'draft',updatedAt:'2026-09-20T00:00:01.000Z'}},{status:content==='older'&&firstFails?500:200})});
  const first=f.fn('older'),second=f.fn('newer');await Promise.resolve();await Promise.resolve();
  assert.deepEqual(calls,['older']);assert.equal(f.state.saved,null);assert.equal(f.state.saving,true);
  release();await Promise.all([first,second]);assert.deepEqual(calls,['older','newer']);assert.ok(f.state.saved);assert.equal(f.state.error,null);assert.equal(f.state.saving,false);
 });
 console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
