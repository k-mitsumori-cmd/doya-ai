process.env.NODE_ENV='test';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const D=__dirname,root=process.env.DOYA_PARENT_ROOT||path.resolve(D,'../..'),deps=process.env.DOYA_PARENT_DEPS||path.join(root,'node_modules');

if(process.env.DOYA_PARENT_CHILD!=='1'){
 const {spawnSync}=require('node:child_process');const reports=[];
 for(const mode of ['0','1']){
  const env={};for(const key of ['PATH','HOME','LANG','TMPDIR'])if(process.env[key])env[key]=process.env[key];
  Object.assign(env,{DOYA_PARENT_CHILD:'1',DOYA_PARENT_ROOT:root,DOYA_PARENT_DEPS:deps,DOYA_PARENT_STRICT:mode,NODE_ENV:'test'});
  const child=spawnSync(process.execPath,[__filename],{env,encoding:'utf8',timeout:45000,maxBuffer:4*1024*1024});
  assert(!child.error && child.status===0,'Shanai detail parent child failed: '+(child.stderr||child.error||child.stdout));
  assert(child.stdout.trim(),'Complete child report is required; empty successful process is not acceptance');const lines=child.stdout.trim().split('\n');assert.equal(lines.length,1,'Exactly one complete child report required');const report=JSON.parse(lines[0]);
  assert.equal(report.results.length,10);assert.equal(report.passed,10);assert.equal(report.failed,0);assert.equal(report.consoleErrors.length,0);assert.equal(report.strictMode,mode==='1');reports.push(report);
 }
 const bindings={...reports[0].sourceBindings};assert.deepEqual(reports[1].sourceBindings,bindings);
 for(const name of ['package.json','package-lock.json'])bindings[name]=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex');
 bindings['scripts/security-regression/verify-shanai-detail-read-lifecycle.cjs']=crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');
 const report={marker:'shanai-detail-read-lifecycle',checkedAt:new Date().toISOString(),passed:20,expected:20,normalChecks:10,strictModeChecks:10,sourceBindings:bindings,consoleErrors:0,writes:0,reports,scope:'Complete actual parent function and React lifecycle; child placeholders, synthetic Next params/router and API. Existing actual child Section regressions remain separate. No native browser, real auth/HTTP/DB/provider or production writes.'};
 const output=process.env.DOYA_PARENT_OUTPUT||path.join(root,'docs/audits/2026-10-06-all-services-recheck/shanai-detail-read-lifecycle-results.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({marker:report.marker,passed:20,expected:20,normalChecks:10,strictModeChecks:10,sourceBindings:bindings,consoleErrors:0,writes:0}));process.exit(0);
}

const req=n=>require(path.join(deps,n)),React=req('react'),ts=req('typescript'),{JSDOM}=req('jsdom');
const relative='src/app/(shell)/shanai/interviews/[id]/page.tsx',source=fs.readFileSync(path.join(root,relative),'utf8');
const boundary=source.indexOf('// ---------- ① 録音 ----------');assert(boundary>0);
// Execute the complete actual parent. Child sections are placeholders: this verifies parent reads only.
const code=source.slice(0,boundary)+['VoiceSection','SurveySection','PhotoSection','FactSection','ArticleSection'].map(n=>n==='VoiceSection'?'function VoiceSection(p){captureReload(p.reload);return null}':`function ${n}(){return null}`).join('\n');
const dom=new JSDOM('<div id="root"></div>',{url:'https://synthetic.invalid/shanai/interviews/A'});
for(const k of ['window','document','navigator','HTMLElement','Node','Event','MouseEvent'])Object.defineProperty(global,k,{configurable:true,value:k==='window'?dom.window:dom.window[k]});
global.IS_REACT_ACT_ENVIRONMENT=true;
const strict=process.env.DOYA_PARENT_STRICT==='1';let capturedReload;let id='A',pending=[],mounted,consoleErrors=[];const originalError=console.error;console.error=(...a)=>consoleErrors.push(a.map(String).join(' '));
const h=React.createElement,noop=()=>null;
const ui={api:url=>new Promise((resolve,reject)=>pending.push({url,resolve,reject})),Button:({children,onClick})=>h('button',{onClick},children),ConfirmDialog:noop,PageTitle:({children})=>h('h1',null,children),StatusBadge:noop,PageSkeleton:()=>h('p',{'data-loading':true},'loading'),ForbiddenState:()=>h('p',{'data-forbidden':true},'forbidden'),ErrorState:({onRetry})=>h('button',{'data-retry':true,onClick:onRetry},'retry')};
const mocks={react:React,'react/jsx-runtime':req('react/jsx-runtime'),'next/navigation':{useParams:()=>({id}),useRouter:()=>({push(){throw Error('No navigation writes')}})},'next/link':{__esModule:true,default:({children})=>h('span',null,children)},'lucide-react':new Proxy({},{get:()=>noop}),'react-hot-toast':{__esModule:true,default:{success(){throw Error('No writes')},error(){}}},'@/components/shanai/SurveyForm':{default:noop},'@/components/shanai/ui':ui,'@/components/ds':{ErrorNotice:noop},'@/lib/shanai/types':{},'@/lib/shanai/survey':{},'@/components/shell/power':{}};
const exportsObject={};vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports:exportsObject,require:n=>{assert(n in mocks,n);return mocks[n]},window:dom.window,console,captureReload:r=>{capturedReload=r}},{filename:relative});
const Page=exportsObject.default,tick=()=>new Promise(r=>setImmediate(r));
const data=n=>({interview:{id:n,mode:'voice',audio:{status:'uploaded'},intervieweeName:n,status:'DRAFT',department:'',position:'',joinYear:''}});
async function render(){await React.act(async()=>{mounted.render(strict?h(React.StrictMode,null,h(Page)):h(Page));await tick()})}
async function settle(p,value,error){await React.act(async()=>{error?p.reject(value):p.resolve(value);await tick()})}
async function start(){if(mounted)await React.act(async()=>mounted.unmount());id='A';pending=[];mounted=req('react-dom/client').createRoot(document.getElementById('root'));await render();assert.equal(pending.length,strict?2:1);if(strict){const retired=pending.shift();await settle(retired,data('retired'));assert.equal(shown(),null)}}
const shown=()=>document.querySelector('h1')?.textContent||null;const results=[];
async function check(name,fn){try{await start();await fn();results.push({name,passed:true})}catch(e){results.push({name,passed:false,error:e.message})}}
(async()=>{
 await check('normal detail read',async()=>{await settle(pending[0],data('A'));assert.equal(shown(),'A さん')});
 await check('failed read retry clears error and shows successful detail',async()=>{await settle(pending[0],new Error('synthetic'),true);assert(document.querySelector('[data-retry]'));await React.act(async()=>{document.querySelector('[data-retry]').click();await tick()});assert.equal(pending.length,2);await settle(pending[1],data('A'));assert.equal(shown(),'A さん');assert(!document.querySelector('[data-retry]'))});
 await check('route switch immediately removes prior detail while next read pending',async()=>{await settle(pending[0],data('A'));id='B';await render();assert.equal(pending.length,2);assert.equal(shown(),null);assert(document.querySelector('[data-loading]'));await settle(pending[1],data('B'));assert.equal(shown(),'B さん')});
 await check('late A success cannot replace current B detail',async()=>{const a=pending[0];id='B';await render();await settle(pending[1],data('B'));await settle(a,data('A'));assert.equal(shown(),'B さん')});
 await check('late A failure cannot hide current B detail',async()=>{const a=pending[0];id='B';await render();await settle(pending[1],data('B'));await settle(a,new Error('late failure'),true);assert.equal(shown(),'B さん');assert(!document.querySelector('[data-retry]'))});
 await check('A forbidden does not persist after switching to accessible B',async()=>{await settle(pending[0],Object.assign(new Error('forbidden'),{status:403}),true);assert(document.querySelector('[data-forbidden]'));id='B';await render();await settle(pending[1],data('B'));assert.equal(shown(),'B さん')});

 await check('retired A reload callback cannot start another A read after B',async()=>{await settle(pending[0],data('A'));const retired=capturedReload;id='B';await render();await settle(pending[1],data('B'));await React.act(async()=>{void retired();await tick()});assert.equal(pending.length,2);assert.equal(shown(),'B さん')});
 await check('reload callback cannot start a read after unmount',async()=>{await settle(pending[0],data('A'));const retired=capturedReload;await React.act(async()=>mounted.unmount());mounted=null;void retired();assert.equal(pending.length,1)});
 await check('late unauthorized response after B cannot redirect',async()=>{const a=pending[0];id='B';await render();await settle(pending[1],data('B'));const before=consoleErrors.length;await settle(a,Object.assign(new Error('retired unauthorized'),{status:401}),true);assert.equal(shown(),'B さん');assert.equal(consoleErrors.length,before)});
 await check('late failure after unmount is ignored',async()=>{const a=pending[0];await React.act(async()=>mounted.unmount());mounted=null;const before=consoleErrors.length;await settle(a,new Error('retired failure'),true);assert.equal(consoleErrors.length,before)});
})().finally(async()=>{if(mounted)await React.act(async()=>mounted.unmount());console.error=originalError;dom.window.close();const report={checkedAt:new Date().toISOString(),strictMode:strict,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,results,sourceBindings:{[relative]:crypto.createHash('sha256').update(source).digest('hex')},consoleErrors,scope:'Actual complete parent function and actual React hooks mounted. Child sections and UI decorative components, Next params/router and api transport are synthetic. No real HTTP, auth, data, provider, or production fault injection.'};console.log(JSON.stringify(report));if(report.failed||report.results.length!==10||report.consoleErrors.length)process.exitCode=1});
