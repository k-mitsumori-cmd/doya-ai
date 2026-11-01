process.env.NODE_ENV='development';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../..'),dep=n=>require(path.join(repo,'node_modules',n)),React=dep('react'),ts=dep('typescript'),{JSDOM}=dep('jsdom');
const page='src/app/(shell)/kintai/clock/page.tsx',files=[page,'src/lib/kintai/use-clock.ts','src/lib/kintai/clock-response.ts'];
function compiled(file,resolve,extra={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(repo,file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:resolve,console,Date,Response,Request,Headers,AbortController,URL,setTimeout,clearTimeout,setInterval,clearInterval,...extra},{filename:file});return exports}
const parser=compiled('src/lib/kintai/clock-response.ts',n=>{throw Error(n)}),now=Date.now(),day=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
const record=(type='clock_in',n=1,employee=1,offset=-60000)=>({id:'c'+String(n).padStart(24,'0'),employeeId:'c'+String(employee+100).padStart(24,'0'),type,timestamp:new Date(now+offset).toISOString()});
const read=(rows=[],date=day)=>({records:rows,activeShiftRecords:rows,clockStatus:!rows.length?'not_clocked_in':rows.at(-1)?.type==='clock_out'?'clocked_out':rows.at(-1)?.type==='break_start'?'on_break':'working',date});
const results=[];async function test(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS Kintai clock recovery: '+name)}catch(e){results.push({name,passed:false,error:e.message});console.error('FAIL Kintai clock recovery: '+name+': '+e.message)}}
async function mounted(kind,strict){
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://synthetic.invalid'}),prior=new Map(),timers=[];
 for(const[k,v]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){prior.set(k,Object.getOwnPropertyDescriptor(global,k));Object.defineProperty(global,k,{value:v,writable:true,configurable:true})}
 let root,access={isActive:kind!=='inactive',ready:kind!=='ready-delay',actorId:'actorA',organizationId:'orgA'},posts=0,getCount=0,postRelease,postResolve,oldReadResolve,failedRead=false,accepted=false,postMode=kind;
 const initialType=kind==='normal-out'||kind==='normal-break-start'?'working':kind==='normal-break-end'?'on_break':'empty';
 const initial=initialType==='working'?[record()]:initialType==='on_break'?[record(),record('break_start',2,1,-30000)]:[];
 let rows=initial.slice(),currentRows=()=>access.actorId==='actorB'?[]:rows;
 const requests=[];
 async function fetch(url,opts={}){
  assert(String(url).startsWith('/api/kintai/clock'));const actor=access.actorId;requests.push({actor,method:opts.method||'GET'});
  if(opts.method==='POST'){
   posts++;const type=JSON.parse(opts.body).type,ack=record(type,initial.length+1,1,0);
   if(['duplicate','unmount','actor-change','actor-return'].includes(postMode)){postRelease=()=>{rows=[...initial,ack];postResolve(new Response(JSON.stringify({record:ack}),{status:200}))};return new Promise(resolve=>{postResolve=resolve})}
   if(postMode==='network')throw Error('synthetic network');
   if(postMode==='definitive400')return new Response(JSON.stringify({error:'合成の入力エラー'}),{status:400});
   if(['normal-in','normal-out','normal-break-start','normal-break-end','ack-read-fails','persisted500','persisted-malformed','recovered','resume'].includes(postMode)){rows=[...initial,ack];accepted=true}
   if(postMode==='ack-read-fails')failedRead=true;
   if(postMode==='invalid-json')return new Response('broken',{status:200});
   if(['http500','persisted500'].includes(postMode))return new Response(JSON.stringify({error:'synthetic'}),{status:500});
   if(postMode==='ack-different-record')rows=[record(type,9,1,0)];
   if(postMode==='ack-other-employee')rows=[record(type,initial.length+1,2,0)];
   if(postMode==='ack-time-mismatch')rows=[record(type,initial.length+1,1,1000)];
   let data={record:ack};
   if(['missing','persisted-malformed','read-fails','unknown-recheck','explicit-resume'].includes(postMode))data={};
   if(postMode==='null')data=null;
   if(postMode==='array')data=[];
   if(postMode==='wrong-type')data.record={...ack,type:'clock_out'};
   if(postMode==='wrong-id')data.record={...ack,id:'invalid'};
   if(postMode==='wrong-time')data.record={...ack,timestamp:'invalid'};
   if(postMode==='error-mixed')data.error='synthetic';
   if(postMode==='read-fails')failedRead=true;
   return new Response(JSON.stringify(data),{status:200});
  }
  getCount++;
  if(kind==='stale-read'&&getCount===1)return new Promise(resolve=>{oldReadResolve=()=>resolve(new Response(JSON.stringify(read([record()],new URL(url,'http://synthetic.invalid').searchParams.get('date'))),{status:200}))});
  if(failedRead)return new Response('{}',{status:503});
  let data=read(currentRows(),new URL(url,'http://synthetic.invalid').searchParams.get('date'));
  if(kind==='bad-initial')data={};
  if(kind==='null-row')data=read([null]);
  if(kind==='wrong-date')data.date='2000-01-01';
  return new Response(JSON.stringify(data),{status:200});
 }
 const tag=()=>React.createElement('span',{'aria-hidden':true}),cache={};
 function load(f){if(cache[f])return cache[f];return cache[f]=compiled(f,resolve,{window:dom.window,document:dom.window.document,fetch,setTimeout:(fn,ms)=>{const id=setTimeout(fn,ms);timers.push(id);return id}})}
 function resolve(n){if(n==='react'||n==='react/jsx-runtime')return dep(n);if(n==='next/link')return{__esModule:true,default:({children,href})=>React.createElement('a',{href},children)};if(n==='lucide-react')return{Pencil:tag,RotateCcw:tag};if(n==='@/components/kintai/ui-next')return{PageTitle:({children})=>React.createElement('h2',{},children)};if(n==='@/components/kintai/KintaiAccessContext')return{useKintaiAccess:()=>access};if(n==='@/components/ds')return{Skeleton:()=>React.createElement('div',{},'Skeleton')};if(n.startsWith('@/')){for(const ext of ['.ts','.tsx'])if(fs.existsSync(path.join(repo,'src',n.slice(2)+ext)))return load('src/'+n.slice(2)+ext)}if(n.startsWith('./')){for(const ext of ['.ts','.tsx'])if(fs.existsSync(path.join(repo,'src/lib/kintai',n.slice(2)+ext)))return load('src/lib/kintai/'+n.slice(2)+ext)}throw Error('Unmapped '+n)}
 const text=()=>document.body.textContent,button=(name)=>[...document.querySelectorAll('button')].find(x=>x.textContent.includes(name));
 const click=async name=>{const b=button(name);assert(b,'Missing button '+name);assert(!b.disabled,'Disabled '+name);await React.act(async()=>{b.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}))})};
 try{
  const Page=load(page).default,{createRoot}=dep('react-dom/client');root=createRoot(document.getElementById('root'));const render=()=>root.render(strict?React.createElement(React.StrictMode,{},React.createElement(Page)):React.createElement(Page));await React.act(async()=>render());
  if(kind==='ready-delay'){assert(!button('出勤する'));assert.equal(posts,0);access={...access,ready:true};await React.act(async()=>render());postMode='normal-in';await click('出勤する');assert.equal(posts,1);assert(text().includes('勤務中'));return}
  if(kind==='ready-frozen'){access={...access,ready:false};await React.act(async()=>render());await click('出勤する');assert.equal(posts,0);access={...access,ready:true};await React.act(async()=>render());postMode='normal-in';await click('出勤する');assert.equal(posts,1);assert(text().includes('勤務中'));return}
  if(kind==='stale-read'){access={...access,ready:false};await React.act(async()=>render());access={...access,ready:true};await React.act(async()=>render());assert(text().includes('まだ出勤していません'));assert(oldReadResolve);await React.act(async()=>oldReadResolve());assert(text().includes('まだ出勤していません'));assert(!text().includes('勤務中'));assert.equal(posts,0);return}
  if(['bad-initial','null-row','wrong-date'].includes(kind)){assert(text().includes('打刻状態を確認できませんでした'));assert.equal(posts,0);return}
  if(kind==='inactive'){assert(!button('出勤する'));assert(text().includes('従業員情報が無効化されています'));assert.equal(posts,0);return}
  if(kind==='duplicate'){
   const b=button('出勤する');await React.act(async()=>{b.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}));b.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}))});assert.equal(posts,1);await React.act(async()=>postRelease());assert(text().includes('勤務中'));return;
  }
  if(['unmount','actor-change','actor-return'].includes(kind)){
   await click('出勤する');assert.equal(posts,1);
   if(kind==='unmount'){await React.act(async()=>root.unmount());root=null;const before=requests.length;await React.act(async()=>postRelease());assert.equal(requests.length,before);return}
   access={...access,actorId:'actorB',organizationId:'orgB'};await React.act(async()=>render());
   if(kind==='actor-return'){access={...access,actorId:'actorA',organizationId:'orgA'};await React.act(async()=>render())}
   assert(text().includes('まだ出勤していません'));await React.act(async()=>postRelease());assert(!text().includes('出勤しました'));assert(text().includes('まだ出勤していません'));return
  }
  if(kind==='normal-out'){await click('退勤する');await click('退勤する')}
  else if(kind==='normal-break-start')await click('休憩を開始');
  else if(kind==='normal-break-end')await click('休憩終了');
  else await click('出勤する');
  assert.equal(posts,1);
  if(kind.startsWith('normal-')){assert(!text().includes('打刻結果を確認できませんでした'));assert(text().includes(kind==='normal-out'?'本日の勤務は終了しました':kind==='normal-break-start'?'休憩中':'勤務中'));return}
  if(['persisted500','persisted-malformed'].includes(kind)){assert(accepted);assert(text().includes('保存済みの打刻を確認しました'));assert(text().includes('勤務中'));assert(!text().includes('出勤しました'));return}
  if(kind==='definitive400'){assert(!text().includes('出勤しました'));assert(!text().includes('打刻結果を確認できませんでした'));assert(text().includes('まだ出勤していません'));return}
  if(kind==='ack-read-fails'){assert(text().includes('打刻結果を確認できませんでした'));assert(!text().includes('出勤しました'));failedRead=false;await click('状態を再確認');assert(text().includes('勤務中'));assert.equal(posts,1);return}
  assert(!text().includes('出勤しました'));assert(text().includes('打刻結果を確認できませんでした'));assert(!button('出勤する'));
  if(kind==='read-fails'){assert(button('最新の状態を確認して打刻を再開').disabled);failedRead=false;rows=[record('clock_in',9,1,0)];await click('状態を再確認');assert(text().includes('保存済みの打刻を確認しました'));assert(text().includes('勤務中'));assert.equal(posts,1)}
  if(kind==='unknown-recheck'){await click('状態を再確認');assert(text().includes('打刻結果を確認できませんでした'));assert.equal(posts,1)}
  if(kind==='explicit-resume'){await click('最新の状態を確認して打刻を再開');assert(text().includes('まだ出勤していません'));assert.equal(posts,1);postMode='resume';await click('出勤する');assert.equal(posts,2);assert(text().includes('勤務中'))}
 }finally{if(root)await React.act(async()=>root.unmount());for(const id of timers)clearTimeout(id);dom.window.close();for(const[k,d]of prior)if(d)Object.defineProperty(global,k,d);else delete global[k]}
}
(async()=>{
 const invalid=[null,[],{},read([null]),{...read(),date:'wrong'},{...read(),clockStatus:'working'},{...read(),error:'x'},read([record(),record()]),read([record(),record('break_start',2,2,0)]),read([record('clock_in',1,1,0),record('break_start',2,1,-60000)])];
 for(let i=0;i<invalid.length;i++)await test('GET parser rejects '+i,()=>assert.throws(()=>parser.parseKintaiClockRead(invalid[i],day)));
 await test('GET parser accepts actual-shaped current and carryover',()=>{assert.equal(parser.parseKintaiClockRead(read([record()]),day).clockStatus,'working');const prior=record('clock_in',9,1,-86400000);assert.equal(parser.parseKintaiClockRead({...read(),activeShiftRecords:[prior],clockStatus:'working'},day).clockStatus,'working')});
 await test('ACK rejects normalized invalid calendar date',()=>assert.equal(parser.isKintaiClockAcknowledgement({record:{...record(),timestamp:'2026-02-30T07:00:00.000Z'}},'clock_in'),false));
 const kinds=['normal-in','normal-out','normal-break-start','normal-break-end','missing','invalid-json','null','array','wrong-type','wrong-id','wrong-time','error-mixed','http500','network','persisted500','persisted-malformed','read-fails','unknown-recheck','explicit-resume','definitive400','bad-initial','null-row','wrong-date','duplicate','unmount','actor-change','actor-return','ack-read-fails','valid-ack-unconfirmed','ack-different-record','ack-other-employee','ack-time-mismatch','ready-delay','ready-frozen','stale-read','inactive'];
 for(const strict of [false,true])for(const kind of kinds)await test(kind+(strict?' StrictMode':' normal'),()=>mounted(kind,strict));
 const out={checkedAt:new Date().toISOString(),passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,cases:results,sourceHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,f))).digest('hex')])),scope:'Actual clock page/hook/parser normal and StrictMode, synthetic HTTP and provider-free DOM. No actual production failure injection, real account or paid API. Concurrent backend guarantees are separately tested with native SQL; explicit resume is user-driven and not API idempotency.'};if(process.env.DOYA_KINTAI_CLOCK_RESULT)fs.writeFileSync(process.env.DOYA_KINTAI_CLOCK_RESULT,JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({passed:out.passed,failed:out.failed}));if(out.failed)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1});
