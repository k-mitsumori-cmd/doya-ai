// Called from the private PostgreSQL suite: actual client -> actual route -> actual SQL.
module.exports = async function runFactsMounted({root,deps,check,post,edit,db,id,keep,hold,replace}) {
 process.env.NODE_ENV='development';
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
 const req=name=>require(path.join(deps,name)),React=req('react'),ts=req('typescript'),{JSDOM}=req('jsdom');
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://example.invalid'}),tick=()=>new Promise(resolve=>setImmediate(resolve));
 const names=['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','Event','MouseEvent','IS_REACT_ACT_ENVIRONMENT'];
 const prior=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(global,name)]));
 for(const name of names)Object.defineProperty(global,name,{configurable:true,writable:true,value:name==='window'?dom.window:name==='IS_REACT_ACT_ENVIRONMENT'?true:dom.window[name]});
 let mounted=null,requests=[],responses=[],changed=[];
 const icon=()=>null,notice=({what,how})=>React.createElement('div',{role:'alert'},what,' ',how);
 async function fakeFetch(url,init={}) {
  assert.equal(url,'/api/shanai/interviews/'+id+'/facts');requests.push(init.method);
  assert(['POST','PUT'].includes(init.method));const promise=init.method==='POST'?post():edit(JSON.parse(init.body).facts);responses.push({method:init.method,promise});return promise;
 }
 function load(file,mocks,suffix='') {
  const exports={};const compiled=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  vm.runInNewContext(compiled+suffix,{exports,require:name=>{assert(name in mocks,'Unmocked '+name);return mocks[name];},URL,Error,fetch:fakeFetch,window:dom.window,document:dom.window.document,setTimeout,clearTimeout,setInterval,clearInterval,console},{filename:file});return exports;
 }
 const common={react:React,'react/jsx-runtime':req('react/jsx-runtime'),'lucide-react':new Proxy({},{get:()=>icon})};
 const ui=load('src/components/shanai/ui.tsx',{...common,'@/components/ds':{ErrorNotice:notice,Button:({children})=>React.createElement('button',null,children),EmptyState:icon},'./shell-context':{useInShanaiShell:()=>true},'@/components/ds/kun':{DoyaKun:icon}});
 const page=load('src/app/(shell)/shanai/interviews/[id]/page.tsx',{...common,'next/navigation':{},'next/link':{__esModule:true,default:icon},'react-hot-toast':{__esModule:true,default:{}},'@/components/shanai/SurveyForm':{__esModule:true,default:icon},'@/components/shanai/ui':ui,'@/components/ds':{ErrorNotice:notice},'@/lib/shanai/types':load('src/lib/shanai/types.ts',{}),'@/lib/shanai/survey':load('src/lib/shanai/survey.ts',{}),'@/components/shell/power':{}},'\nexports.FactSection=FactSection;');
 async function detail(){return {id,mode:'voice',facts:await db.shanaiFact.findMany({where:{interviewId:id},orderBy:{sortOrder:'asc'}})};}
 async function render(){
  requests=[];responses=[];changed=[];const initial=await detail();
  function Harness(){const [data,setData]=React.useState(initial);return React.createElement(page.FactSection,{data,materialReady:true,onChange:d=>{changed.push(d);setData(d);}});}
  mounted=req('react-dom/client').createRoot(document.getElementById('root'));
  await React.act(async()=>mounted.render(React.createElement(React.StrictMode,null,React.createElement(Harness))));
 }
 const finishRequest=method=>{const item=responses.filter(r=>r.method===method).at(-1);assert(item);return item.promise;};
 const button=label=>[...document.querySelectorAll('button')].find(b=>b.textContent===label);
 async function start(){await React.act(async()=>{const b=button('事実を抽出し直す')||button('事実を抽出する');assert(b);b.click();await tick();});if(button('抽出し直す'))await React.act(async()=>{button('抽出し直す').click();await tick();});}
 async function stop(){if(mounted){await React.act(async()=>mounted.unmount());mounted=null;}}
 try{
  await check('mounted fact editor preserves checkbox edit through actual SQL generation conflict',async()=>{try{
   await keep();await render();const h=hold();await start();await h.entered.promise;const checkbox=document.querySelector('input[type=checkbox]');assert(!checkbox.disabled);
   await React.act(async()=>{checkbox.click();await finishRequest('PUT');await tick();});assert.equal((await db.shanaiFact.findFirst({where:{interviewId:id}})).approved,false);
   await React.act(async()=>{h.finish.resolve();await finishRequest('POST');await tick();});for(let i=0;i<8&&button('事実を抽出し直す').disabled;i++)await React.act(async()=>tick());
   assert.equal(changed.length,1);assert.equal(document.querySelector('input[type=checkbox]').checked,false);assert(document.querySelector('[role=alert]').textContent.includes('読み直して'));assert.deepEqual(requests,['POST','PUT']);
  }finally{await stop();}});
  await check('mounted stale fact save shows conflict without a false success callback',async()=>{try{
   await keep();await render();assert.equal((await post()).status,200);
   await React.act(async()=>{document.querySelector('input[type=checkbox]').click();await finishRequest('PUT');await tick();});for(let i=0;i<8&&!document.querySelector('[role=alert]');i++)await React.act(async()=>tick());
   assert.equal(changed.length,0);assert(document.querySelector('[role=alert]').textContent.includes('読み直して'));assert.equal((await db.shanaiFact.findFirst({where:{interviewId:id}})).approved,true);assert.deepEqual(requests,['PUT']);
  }finally{await stop();}});
  await check('mounted extraction reports replaced audio without applying retired output',async()=>{try{
   await keep();await render();const h=hold();await start();await h.entered.promise;assert.equal((await replace()).status,200);
   await React.act(async()=>{h.finish.resolve();await finishRequest('POST');await tick();});for(let i=0;i<8&&!document.querySelector('[role=alert]');i++)await React.act(async()=>tick());
   assert.equal(changed.length,0);assert(document.querySelector('[role=alert]').textContent.includes('読み直して'));assert.equal((await db.shanaiFact.findFirst({where:{interviewId:id}})).statement,'KEEP');
  }finally{await stop();}});
  await check('mounted successful extraction displays the actual SQL facts',async()=>{try{
   await render();await start();await React.act(async()=>{await finishRequest('POST');await tick();});
   assert.equal(changed.length,1);assert(document.body.textContent.includes('原文: OLD AUDIO'));assert.equal(document.querySelectorAll('[role=alert]').length,0);assert.deepEqual(requests,['POST']);
  }finally{await stop();}});
 }finally{
  await stop();dom.window.close();for(const [name,descriptor] of prior){if(descriptor)Object.defineProperty(global,name,descriptor);else delete global[name];}
 }
};
