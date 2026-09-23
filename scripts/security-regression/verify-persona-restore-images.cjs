const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.resolve(__dirname,'../../src/app/persona/Tool.tsx'),'utf8');
const ast=ts.createSourceFile('Tool.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),effects=[];
function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='useEffect')effects.push(n.arguments[0].getText(ast));ts.forEachChild(n,visit)}visit(ast);
const restore=effects.find(s=>s.includes("accountStorage.getItem('doya_persona_last')"));
const portrait=effects.find(s=>s.includes('handleGeneratePortrait()'));
const scene=effects.find(s=>s.includes('const timers:'));
const compile=s=>ts.transpileModule('('+s+');',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
for(const mode of ['restore-empty-images','restore-portrait','restore-complete','new-generation','new-modification']){
 const data={persona:{name:'Synthetic',age:30,gender:'男性',occupation:'Example',schedule:[{imagePrompt:'schedule'}]}},pending=new Set(),calls=[];
 const saved={data,portrait:mode==='restore-empty-images'?null:'portrait',sceneImages:mode==='restore-complete'?{'schedule-0':'saved','hero':'saved'}:{}};
 const env={...require('./load-typescript.cjs').load('src/lib/persona/display-data.ts'),initialRecord:undefined,includedPersonaImages:require('./load-typescript.cjs').load('src/lib/persona/image-entitlements.ts').includedPersonaImages,currentServerRecord:{current:false},setAccessWarning(){},currentRecordId:{current:null},setUrl(){},generatedData:null,autoGenerateFor:{current:null},portraitAutoTriggered:{current:false},sceneAutoTriggered:{current:false},portraitImage:null,portraitLoading:false,sceneImages:{},accountStorage:{getItem:()=>JSON.stringify(saved)},setGeneratedData:d=>env.generatedData=d,setPortraitImage:d=>env.portraitImage=d,setSceneImages:d=>env.sceneImages=d,setError:e=>{throw Error(e)},handleGeneratePortrait:()=>calls.push('portrait'),handleGenerateScene:()=>calls.push('scene'),setTimeout:f=>{pending.add(f);return f},clearTimeout:f=>pending.delete(f)};
 const run=s=>vm.runInNewContext(compile(s),env)();
 if(mode.startsWith('restore')){run(restore);run(restore)}else{env.generatedData=data;env.autoGenerateFor.current=data}
 // Initial render effect still sees the pre-restoration null state before React's next render.
 if(mode.startsWith('restore')){const restored=env.generatedData;env.generatedData=null;run(portrait);run(scene);env.generatedData=restored}
 const cleanups=[run(portrait),run(scene)];
 if(mode.startsWith('restore')){assert.equal(pending.size,0);assert.equal(calls.length,0);assert.equal(env.generatedData.persona.name,'Synthetic');assert.equal(env.portraitImage,saved.portrait)}
 else{assert.ok(pending.size>=2);for(const f of pending)f();assert.ok(calls.includes('portrait'));assert.ok(calls.includes('scene'));for(const c of cleanups)c?.();assert.equal(pending.size,0)}
 console.log('PASS',mode);
}
let requestSource;
for (const mode of ['server-url','blocked-storage','legacy-url','different-record']) {
 const data={persona:{name:'Server'}},initialRecord={id:'owned',data,sourceUrl:mode==='server-url'?'https://server.test':null,portrait:'/api/persona/images/p',sceneImages:{'schedule-0':'/api/persona/images/s'}};
 const env={...require('./load-typescript.cjs').load('src/lib/persona/display-data.ts'),initialRecord,autoGenerateFor:{current:data},currentServerRecord:{current:false},setAccessWarning(){},currentRecordId:{current:null},accountStorage:{getItem(){if(mode==='blocked-storage')throw Error('SecurityError');return JSON.stringify([{id:mode==='different-record'?'other':'owned',url:'https://legacy.test'}])}},setGeneratedData:v=>env.data=v,setUrl:v=>env.url=v,setPortraitImage:v=>env.portrait=v,setSceneImages:v=>env.scenes=v,setError(){throw Error('Server restore must not depend on storage')}};
 vm.runInNewContext(compile(restore),env)();assert.equal(env.data,data);assert.equal(env.currentRecordId.current,'owned');assert.equal(env.autoGenerateFor.current,null);assert.equal(env.portrait,initialRecord.portrait);assert.equal(env.scenes,initialRecord.sceneImages);assert.equal(env.url,mode==='server-url'?'https://server.test':mode==='legacy-url'?'https://legacy.test':'');console.log('PASS direct server restore',mode);
}
function find(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='requestMissingImages')requestSource=n.initializer.getText(ast);ts.forEachChild(n,find)}find(ast);
for(const mode of ['explicit','duplicate','unmounted','text-busy','image-busy','replaced']){
 const data={persona:{name:'Current'}},env={...require('./load-typescript.cjs').load('src/lib/persona/display-data.ts'),initialRecord:undefined,alive:{current:mode!=='unmounted'},generatedData:data,currentPersona:{current:mode==='replaced'?{}:data},textRequest:{current:mode==='text-busy'?Symbol():null},portraitLoading:mode==='image-busy',sceneLoading:{},autoGenerateFor:{current:mode==='duplicate'?data:null},portraitAutoTriggered:{current:true},sceneAutoTriggered:{current:true},setImageGenerationRequest:()=>env.renders++,renders:0};
 const fn=vm.runInNewContext(compile(requestSource),env);fn();fn();assert.equal(env.renders,mode==='explicit'?1:0);if(mode==='explicit'){assert.equal(env.autoGenerateFor.current,data);assert.equal(env.portraitAutoTriggered.current,false);assert.equal(env.sceneAutoTriggered.current,false)}console.log('PASS requestMissingImages',mode);
}
