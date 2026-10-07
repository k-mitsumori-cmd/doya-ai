process.env.NODE_ENV='test';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),vm=require('node:vm'),ts=require('typescript'),React=require('react'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<body></body>',{url:'https://local.test'});global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=require('react-dom/client');
const act=fn=>React.act(async()=>{await fn();for(let i=0;i<8;i++)await new Promise(setImmediate)});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
let network,calls=[],imageMode='good',status='authenticated',actor='actor-a',view;
class FakeImage {set src(value){if(!value)return;queueMicrotask(()=>{this.naturalWidth=imageMode==='oversize'?9000:320;this.naturalHeight=50;if(imageMode==='bad')this.onerror?.();else if(imageMode==='good'||imageMode==='oversize')this.onload?.()})}}
let lockTail=Promise.resolve();const navigator={locks:{request:(_name,fn)=>{const next=lockTail.then(fn);lockTail=next.catch(()=>{});return next}}};
const globals={window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,crypto,navigator,Image:FakeImage,AbortController,Response,URL,URLSearchParams,Date,Map,Set,Error,TextDecoder,Uint8Array,console,setTimeout,clearTimeout,setInterval,clearInterval,fetch:async(url,init)=>{const c={url,init,body:init.body?JSON.parse(init.body):null};calls.push(c);return network(c)}};
function load(file,mocks,extra={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:n=>{if(n in mocks)return mocks[n];throw Error('Unmocked '+n)},...globals,...extra},{filename:file});return exports}
const client=load('src/lib/doyaslide/operation-client.ts',{}),hook=load('src/lib/doyaslide/use-operation-recovery.ts',{react:React,'./operation-client':client});
const runtime=require('react/jsx-runtime');
const Panel=load('src/components/doyaslide/DoyaSlideOperationRecovery.tsx',{'react/jsx-runtime':runtime}).default;
const notices=[];const toast=m=>notices.push(['notice',m]);toast.error=m=>notices.push(['error',m]);toast.success=m=>notices.push(['success',m]);
const Page=load('src/app/doyaslide/[id]/page.tsx',{
 react:React,'react/jsx-runtime':runtime,'next/navigation':{useParams:()=>({id:'project-a'}),useRouter:()=>({replace(){}}),useSearchParams:()=>({get:()=>null})},
 'next/link':p=>React.createElement('a',{href:p.href},p.children),'react-hot-toast':toast,
 '@/lib/doyaslide/constants':{LOGO_POSITIONS:[],estimateGenSeconds:()=>5,formatDuration:()=> '5秒'},'@/lib/pricing':{SUPPORT_CONTACT_URL:'/contact'},
 '@/components/doyaslide/SlideImage':p=>React.createElement('img',{src:p.src,alt:p.alt||''}),
 'next-auth/react':{useSession:()=>({status,data:{user:{id:actor}}})},
 '@/lib/doyaslide/use-operation-recovery':hook,'@/components/doyaslide/DoyaSlideOperationRecovery':Panel,
}).default;
let root,host,project,mode,receipts,hold;
const clone=v=>JSON.parse(JSON.stringify(v));
const slide=(i,image=true)=>({id:'slide-'+i,projectId:'project-a',index:i,role:null,headline:null,subText:null,imageUrl:image?'https://local.test/old-'+i:null,rawImageUrl:image?'https://local.test/old-raw-'+i:null,status:image?'done':'pending',version:1,model:image?'synthetic':null});
const seed=(count=1,image=true)=>({id:'project-a',title:'Synthetic project',status:image?'completed':'structured',aspectRatio:'wide',logoUrl:null,logoPosition:'top-right',logoSize:'M',logoBackingChip:false,slides:Array.from({length:count},(_,i)=>slide(i,image))});
const transport=c=>{
 if(c.url.startsWith('/api/doyaslide/projects/'))return Response.json({project:clone(project)});
 if(c.url.endsWith('/revert'))return Response.json({versions:[]});
 assert(c.url.startsWith('/api/doyaslide/operations'));
 if(c.init.method==='GET'){const id=new URL('https://local.test'+c.url).searchParams.get('operationId');return Response.json(receipts.get(id))}
 assert.equal(c.init.method,'POST');assert(client.readDoyaSlideIntent(actor,'project-a'));const b=c.body;
 if(mode==='quota')return Response.json({code:'LIMIT_REACHED',limit:20,error:'今月の上限です',upgradeUrl:'/doyaslide/pricing'},{status:403});
 const targets=b.kind==='batch'?project.slides.filter(s=>!s.imageUrl).slice(0,4):project.slides.filter(s=>s.id===b.slideId);
 const saved=mode==='partial'?targets.slice(0,1):targets;
 for(const item of saved){item.version+=item.imageUrl?1:0;item.imageUrl='https://local.test/new-'+item.id+'-'+item.version;item.rawImageUrl=item.imageUrl+'-raw';item.status='done';item.model='synthetic'}
 const body={operationId:b.operationId,projectId:'project-a',kind:b.kind,state:'completed',results:saved.map(s=>({slideId:s.id,imageUrl:s.imageUrl,rawImageUrl:s.rawImageUrl,version:s.version,model:s.model})),errorCount:targets.length-saved.length,skipped:0,deferred:0,limit:20};receipts.set(b.operationId,clone(body));
 if(mode==='lost')throw Error('Synthetic lost response');if(mode==='held'){hold=deferred();return hold.promise.then(()=>Response.json(body))}return Response.json(body)
};
const mount=async()=>{host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(()=>root.render(React.createElement(React.StrictMode,null,React.createElement(Page))))};
const close=async()=>{if(root){await act(()=>root.unmount());root=null;host.remove()}};
const button=text=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes(text));
const click=async text=>{const b=button(text);assert(b,'missing button '+text);await act(()=>b.click())};
const input=text=>{const el=host.querySelector('input[placeholder="修正を入力..."]');assert(el);const setter=Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set;setter.call(el,text);el.dispatchEvent(new dom.window.Event('input',{bubbles:true}))};
const postCount=()=>calls.filter(c=>c.init.method==='POST').length;
const cases=[];const test=async(name,fn,count=1,image=true)=>{await close();localStorage.clear();calls=[];notices.length=0;status='authenticated';actor='actor-a';project=seed(count,image);receipts=new Map();mode='success';network=transport;await mount();await fn();cases.push(name);console.log('PASS '+name)};
(async()=>{
 global.localStorage=dom.window.localStorage;
 await test('full editor regenerate uses durable operation and confirms saved project before success',async()=>{await click('再生成');assert.equal(postCount(),1);assert.equal(calls.find(c=>c.init.method==='POST').body.kind,'regenerate');assert.equal(client.readDoyaSlideIntent(actor,'project-a'),null);assert.equal(notices.filter(n=>n[0]==='success').length,1)});
 await test('same-frame double regenerate sends one operation and leaves no extra version',async()=>{mode='held';await click('再生成');assert.equal(postCount(),1);await click('再生成');assert.equal(postCount(),1);await act(()=>hold.resolve());assert.equal(project.slides[0].version,2);assert.equal(client.readDoyaSlideIntent(actor,'project-a'),null)});
 await test('lost response blocks new AI; explicit recovery and confirmation close without provider replay',async()=>{mode='lost';await click('再生成');assert.equal(postCount(),1);assert(client.readDoyaSlideIntent(actor,'project-a'));assert(button('再生成').disabled);assert.equal(notices.filter(n=>n[0]==='success').length,0);await click('保存結果を確認');await click('確認して操作を閉じる');assert.equal(client.readDoyaSlideIntent(actor,'project-a'),null);assert.equal(postCount(),1)});
 await test('recovered older saved version can close without replacing a newer current image',async()=>{mode='lost';await click('再生成');project.slides[0].version=3;project.slides[0].imageUrl='https://local.test/newer';project.slides[0].rawImageUrl='https://local.test/newer-raw';await click('保存結果を確認');await click('確認して操作を閉じる');assert.equal(client.readDoyaSlideIntent(actor,'project-a'),null);assert.equal(project.slides[0].imageUrl,'https://local.test/newer');assert.equal(postCount(),1);assert(notices.some(n=>n[1].includes('現在表示中の版は変更していません')))});
 await test('chat retains a newer draft across lost response and explicit recovery never appends duplicate chat',async()=>{await act(()=>input('First change'));mode='lost';await click('send');assert.equal(postCount(),1);assert.equal(calls.find(c=>c.init.method==='POST').body.message,'First change');await act(()=>input('Newer unsent change'));await click('保存結果を確認');await click('確認して操作を閉じる');assert.equal(host.querySelector('input[placeholder="修正を入力..."]').value,'Newer unsent change');assert.equal(postCount(),1);assert.equal(notices.filter(n=>n[0]==='success').length,0)});
 await test('partial batch never automatically retries failed AI slots and does not claim completion',async()=>{mode='partial';await click('未生成を生成');assert.equal(postCount(),1);assert.equal(project.slides.filter(s=>s.imageUrl).length,1);assert.equal(notices.filter(n=>n[0]==='success').length,0);assert.equal(client.readDoyaSlideIntent(actor,'project-a'),null)},4,false);
 await test('full editor quota rejection preserves draft and displays verified persistent pricing link',async()=>{await act(()=>input('Keep this draft'));mode='quota';await click('send');assert.equal(postCount(),1);assert.equal(host.querySelector('input[placeholder="修正を入力..."]').value,'Keep this draft');assert(host.querySelector('a[href="/doyaslide/pricing"]'));assert.equal(client.readDoyaSlideIntent(actor,'project-a'),null)});
 await close();const files=['src/app/doyaslide/[id]/page.tsx','src/lib/doyaslide/operation-client.ts','src/lib/doyaslide/use-operation-recovery.ts','src/components/doyaslide/DoyaSlideOperationRecovery.tsx'];fs.writeFileSync('docs/audits/2026-10-06-all-services-recheck/doyaslide-operation-editor-mounted-results.json',JSON.stringify({checkedAt:new Date().toISOString(),passed:cases.length,cases,sourceHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),scope:'Actual full editor and actual client/hook/panel under React18 StrictMode with synthetic session/network/locks; no real provider, customer DB or production. Native browser and cross-process Web Locks remain unproven.'},null,2)+'\n');
})().catch(async e=>{console.error(e);await close();process.exitCode=1});
