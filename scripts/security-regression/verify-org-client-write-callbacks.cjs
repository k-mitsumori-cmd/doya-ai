const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),{load}=require('./load-typescript.cjs'),{createOrgClient}=require('./org-client-test-loader.cjs');
const parser=load('src/lib/aio/brand-profile-input.ts');
function callback(file,name,globals){const source=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),matches=[];function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)===name&&n.initializer&&ts.isArrowFunction(n.initializer))matches.push(n.initializer.getText(ast));ts.forEachChild(n,visit)}visit(ast);assert.equal(matches.length,1);const x={};vm.runInNewContext(ts.transpileModule('exports.run=('+matches[0]+')',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:x,Error,...globals});return x.run}
const checks=[];
(async()=>{
for(const raw of ['{broken',JSON.stringify({ok:true}),JSON.stringify({ok:true,profile:{id:'wrong',brandName:'Wrong'}})])for(const service of ['aio','shodan']){
 const {client}=createOrgClient(service,{fetch:async()=>new Response(raw)});
 const success=[],errors=[],saved=[],draft=[],globals={...client,...parser,orgSlug:'synthetic',loading:false,loadError:null,form:{brandName:'Synthetic',brandUrl:'',aliases:'',competitors:'',category:'',market:'日本'},profile:{companyName:'Synthetic'},brandColors:[],logoPath:null,setSaving(){},setError(){},setSaved:v=>saved.push(v),toast:{success:s=>success.push(s),error:s=>errors.push(s)}};
 await callback('src/app/'+service+'/[orgSlug]/settings/page.tsx','save',globals)();assert.equal(success.length,0);assert.equal(errors.length,1);assert.ok(!saved.includes(true));checks.push(service+' actual save callback refuses unconfirmed success #'+checks.length);
 if(service==='aio'){
  errors.length=0;await callback('src/app/aio/[orgSlug]/prompts/page.tsx','add',{...globals,text:'Draft question',setAdding(){},setQuotaError(){},setText:v=>draft.push(v),load(){}})();assert.equal(success.length,0);assert.equal(errors.length,1);assert.equal(draft.length,0);checks.push('Actual prompt callback retains question draft #'+checks.length);
  errors.length=0;let reloaded=0,events=0;await callback('src/app/aio/[orgSlug]/page.tsx','runScan',{...globals,tooManyPrompts:false,setRunning(){},setErrorSource(){},setScanLimit(){},setScanLimitAction(){},toast:{loading(){},success:s=>success.push(s),error:s=>errors.push(s)},load:async()=>{reloaded++},window:{dispatchEvent(){events++}},Event:class{}})();assert.equal(success.length,0);assert.equal(errors.length,1);assert.equal(reloaded,0);assert.equal(events,1);checks.push('Actual scan callback rejects unknown completion #'+checks.length);
 }
}
console.log(JSON.stringify({passed:checks.length,checks,scope:'Actual AST-extracted save/add/runScan callbacks using actual service clients/transport/contracts; synthetic malformed and incomplete acknowledgments. No React mount, real network/provider/DB/email, or actor/org lifecycle proof.'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
