const fs = require('fs'), path = require('path'), vm = require('vm'), ts = require('typescript'), assert = require('node:assert/strict');
const historyHelpers = require('./load-typescript.cjs').load('src/lib/persona/history-records.ts', {});
const source = fs.readFileSync(path.resolve(__dirname, '../../src/app/(shell)/persona/Tool.tsx'), 'utf8');
const ast = ts.createSourceFile('Tool.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), callbacks = {};
function visit(n) { if (ts.isVariableDeclaration(n) && ['setGeneratedData', 'handleGeneratePortrait', 'handleGenerateScene', 'handleModify'].includes(n.name.getText(ast))) { const init = n.initializer; callbacks[n.name.getText(ast)] = (ts.isCallExpression(init) ? init.arguments[0] : init).getText(ast) } ts.forEachChild(n, visit) } visit(ast);
const compile = s => ts.transpileModule(s, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
async function run(kind, scenario) {
 const a = { persona: { name: 'A' } }, b = { persona: { name: 'B' } }; let stored = JSON.stringify({ id: 'a', data: a }), state = { data: a, portrait: null, scenes: {}, loading: false, error: '' }; const pending = [];
 const env = {...require('./load-typescript.cjs').load('src/lib/persona/display-data.ts'), personaSceneIntent:require('./load-typescript.cjs').load('src/lib/persona/image-entitlements.ts').personaSceneIntent, isPaidPlan:()=>false, plan:'FREE', scenePrompts:{current:{}},scenePending:{current:new Set()},setSceneErrors(){}, ...historyHelpers, crypto:{randomUUID:()=> 'b'}, imageAttempts:{current:{}},portraitImage:null,sceneImages:{},currentServerRecord:{current:false},setAccessWarning(){},setErrorAction(){},setQuotaNotice(){},currentRecordId:{current:'a'}, autoGenerateFor:{current:null}, alive: {current:true}, generationAttempt:{current:null},textRequest:{current:null}, generatedData: a, currentPersona: { current: a }, imageRequests: { current: {} }, portraitAutoTriggered: { current: true }, sceneAutoTriggered: { current: true }, modificationInput: 'B', modifying: false, url: 'https://example.invalid', setModifying() {}, setError() {}, setModificationInput() {}, setPortraitError:v=>state.error=v, setPortraitLoading:v=>state.loading=v, setSceneLoading:v=>{state.sceneLoading=typeof v==='function'?v(state.sceneLoading||{}):v}, updateGeneratedData:v=>state.data=v, setPortraitImage:v=>state.portrait=v, setSceneImages:v=>state.scenes=typeof v==='function'?v(state.scenes):v, toFriendlyError:e=>String(e), accountStorage:{getItem:k=>k==='doya_persona_history'?'[]':stored,setItem:(k,v)=>{if(k==='doya_persona_last')stored=v}}, console:{error(){}}, fetch:(url)=>url.endsWith('/generate')?Promise.resolve(Response.json({data:b})):new Promise((resolve,reject)=>pending.push({resolve,reject})) };
 const helpers={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../../src/lib/persona/image-response.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:helpers,Error,TextDecoder,TextEncoder,AbortController,setTimeout,clearTimeout,fetch:env.fetch});Object.assign(env,helpers,{PersonaQuotaError:class PersonaQuotaError extends Error{}});
 for(const name of ['setGeneratedData','handleGeneratePortrait','handleGenerateScene','handleModify']) env[name]=vm.runInNewContext(compile('('+callbacks[name]+');'),env);
 const invoke=()=>kind==='portrait'?env.handleGeneratePortrait():env.handleGenerateScene('scene','diary-0');
 const first=invoke(); assert.equal(pending.length,1);
 if(scenario==='modified'||scenario==='late-error'||scenario==='old-timer') await env.handleModify();
 if(scenario==='unmounted')env.currentPersona.current=null;
 if(scenario==='other-tab')stored=JSON.stringify({data:b});
 if(scenario==='old-timer'){await invoke();assert.equal(pending.length,1)}
 if(scenario==='newer-request'){const second=invoke();assert.equal(pending.length,1,'both image types reject duplicates synchronously');await second;}
 if(scenario==='late-error')pending[0].reject(Error('late error'));else pending[0].resolve(Response.json({success:true,image:'/api/persona/images/old'}));await first;
 const image=kind==='portrait'?state.portrait:state.scenes['diary-0'];const saved=JSON.parse(stored);const savedImage=kind==='portrait'?saved.portrait:saved.sceneImages?.['diary-0'];
 if(scenario==='normal'){assert.equal(image,'/api/persona/images/old');assert.equal(savedImage,'/api/persona/images/old')}
 else if(scenario==='newer-request'){assert.equal(image,'/api/persona/images/old');assert.equal(savedImage,'/api/persona/images/old')}
 else if(scenario==='other-tab'){assert.equal(image,'/api/persona/images/old');assert.equal(saved.data.persona.name,'B');assert.equal(savedImage,undefined)}
 else {assert.ok(image==null);assert.equal(savedImage,undefined);assert.equal(state.error,'')}
 console.log('PASS',kind,scenario);
}
function verifyScheduledCleanup() {
 // シーン画像は自動で作らない（ボタンを押したときだけ）。自動のタイマー付き effect が無いことを確かめる。
 const effects=[];
 function find(n) { if(ts.isCallExpression(n) && n.expression.getText(ast)==='useEffect') effects.push(n.arguments[0]?.getText(ast)||'');ts.forEachChild(n,find) } find(ast);
 assert.equal(effects.filter(e=>e.includes('handleGenerateScene')).length,0);
 assert.equal(effects.filter(e=>e.includes('const timers:')).length,0);
 console.log('PASS no effect schedules scene images automatically');
}
(async()=>{verifyScheduledCleanup();for(const kind of ['portrait','scene'])for(const scenario of ['normal','modified','late-error','old-timer','newer-request','other-tab','unmounted'])await run(kind,scenario)})().catch(e=>{console.error(e);process.exitCode=1});
