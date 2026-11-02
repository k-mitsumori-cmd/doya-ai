process.env.NODE_ENV='development';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../..'),dep=n=>require(path.join(repo,'node_modules',n)),React=dep('react'),ts=dep('typescript'),{JSDOM}=dep('jsdom');
function source(file){return fs.readFileSync(path.join(repo,file),'utf8')}
const page='src/app/(shell)/kintai/clock/page.tsx',files=[page,'src/lib/kintai/use-clock.ts','src/lib/kintai/clock-response.ts','src/lib/kintai/clock-display.ts','src/lib/kintai/attendance.ts'];
function compiled(file,resolve,extra={}){const exports={};vm.runInNewContext(ts.transpileModule(source(file),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:resolve,console,Date,Response,Request,Headers,AbortController,URL,crypto:crypto.webcrypto,setTimeout,clearTimeout,setInterval,clearInterval,...extra},{filename:file});return exports}
const parser=compiled('src/lib/kintai/clock-response.ts',n=>{throw Error(n)}),day=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'}),now=Date.parse(day+'T12:00:00+09:00');
let clockTime=now;class ClockDate extends Date{constructor(...args){if(args.length)super(...args);else super(clockTime)}static now(){return clockTime}}
const record=(type='clock_in',n=1,employee=1,offset=-60000)=>({id:'c'+String(n).padStart(24,'0'),employeeId:'c'+String(employee+100).padStart(24,'0'),type,timestamp:new Date(clockTime+offset).toISOString()});
const read=(rows=[],date=day)=>({records:rows.filter(r=>!r||!Number.isFinite(Date.parse(r.timestamp))||new Date(r.timestamp).toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'})===date),activeShiftRecords:rows,clockStatus:!rows.length?'not_clocked_in':rows.at(-1)?.type==='clock_out'?'clocked_out':rows.at(-1)?.type==='break_start'?'on_break':'working',date});
const shiftFixture=compiled('src/lib/kintai/shift-records.ts',n=>{throw Error(n)});
const results=[];async function test(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS Kintai clock recovery: '+name)}catch(e){results.push({name,passed:false,error:e.message});console.error('FAIL Kintai clock recovery: '+name+': '+e.message)}}
async function mounted(kind,strict){
 clockTime=['open-page-midnight','midnight-open-shift','midnight-held-post','report-midnight','report-midnight-initial-error'].includes(kind)?Date.parse(day+'T23:59:50+09:00'):kind==='jst-midnight-carry'?Date.parse(day+'T00:00:20+09:00'):now;
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://synthetic.invalid/kintai/clock?token=PRIVATE#hash'}),prior=new Map(),timers=[];
 for(const[k,v]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){prior.set(k,Object.getOwnPropertyDescriptor(global,k));Object.defineProperty(global,k,{value:v,writable:true,configurable:true})}
 let root,access={isActive:kind!=='inactive',ready:kind!=='ready-delay',actorId:'actorA',organizationId:'orgA'},posts=0,getCount=0,postRelease,postResolve,oldReadResolve,failedRead=false,accepted=false,postMode=kind,holdReads=false,heldReads=[],reportRequests=[],reportMode=kind==='report-pending'?202:kind==='report-success'?200:kind==='report-malformed'?200:503;
 const initialType=kind==='normal-out'||kind==='normal-break-start'||kind==='jst-midnight-carry'?'working':kind==='normal-break-end'?'on_break':'empty';
 const displayRows=kind==='display-multiple-closed'?[record('clock_in',1,1,-3600000),record('break_start',2,1,-3577000),record('break_end',3,1,-3537000),record('clock_out',4,1,-3495000),record('clock_in',5,1,-600000),record('clock_out',6,1,-556000)]:kind==='display-second-live'?[record('clock_in',1,1,-10800000),record('clock_out',2,1,-7200000),record('clock_in',3,1,-1800000)]:kind==='display-on-break'?[record('clock_in',1,1,-7200000),record('break_start',2,1,-3600000)]:null;
 const initial=kind==='midnight-open-shift'?[record('clock_in',1,1,-10800000),record('clock_out',2,1,-7200000),record('clock_in',3,1,-3600000)]:displayRows|| (kind==='open-page-midnight'?[record('clock_in',1,1,-3600000),record('clock_out',2,1,-600000)]:initialType==='working'?[record()]:initialType==='on_break'?[record(),record('break_start',2,1,-30000)]:[]);
 let rows=initial.slice(),currentRows=()=>access.actorId==='actorB'?[]:rows;
 const requests=[];
 async function fetch(url,opts={}){
  if(url==='/api/feedback/error-report'){const body=JSON.parse(opts.body);reportRequests.push(body);return new Response(JSON.stringify(kind==='report-success'?{success:true,reportId:body.reportId}:{}),{status:reportMode})}
  assert(String(url).startsWith('/api/kintai/clock'));const actor=access.actorId;requests.push({actor,method:opts.method||'GET',url:String(url)});
  if(opts.method==='POST'){
   posts++;const type=JSON.parse(opts.body).type,ack=record(type,initial.length+1,1,0);
   if(['duplicate','unmount','actor-change','actor-return','midnight-held-post'].includes(postMode)){postRelease=()=>{rows=[...initial,ack];postResolve(new Response(JSON.stringify({record:ack}),{status:200}))};return new Promise(resolve=>{postResolve=resolve})}
   if(postMode==='network')throw Error('synthetic network');
   if(postMode==='definitive400')return new Response(JSON.stringify({error:'合成の入力エラー'}),{status:400});
   if(['normal-in','normal-out','normal-break-start','normal-break-end','jst-midnight-carry','ack-read-fails','persisted500','persisted-malformed','recovered','resume'].includes(postMode)){rows=[...initial,ack];accepted=true}
   if(postMode==='ack-read-fails')failedRead=true;
   if(postMode==='invalid-json')return new Response('broken',{status:200});
   if(['http500','persisted500'].includes(postMode))return new Response(JSON.stringify({error:'synthetic'}),{status:500});
   if(postMode==='ack-different-record')rows=[record(type,9,1,0)];
   if(postMode==='ack-other-employee')rows=[record(type,initial.length+1,2,0)];
   if(postMode==='ack-time-mismatch')rows=[record(type,initial.length+1,1,1000)];
   let data={record:ack};
   if(['missing','persisted-malformed','read-fails','unknown-recheck','explicit-resume'].includes(postMode))data={};
   if(kind.startsWith('report-'))data={};
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
  if(holdReads)return new Promise(resolve=>heldReads.push({resolve,date:new URL(url,'http://synthetic.invalid').searchParams.get('date')}));
  if(['report-initial-error','report-midnight-initial-error'].includes(kind))return new Response('{}',{status:503});
  if(failedRead)return new Response('{}',{status:503});
  const requestedDay=new URL(url,'http://synthetic.invalid').searchParams.get('date');
  let data=read(kind==='open-page-midnight'&&requestedDay!==day?[]:currentRows(),requestedDay);
  if(kind==='midnight-open-shift')data=read(shiftFixture.recordsWithCarryover(currentRows(),new Date(requestedDay+'T00:00:00+09:00')),requestedDay);
  if(kind==='bad-initial')data={};
  if(kind==='null-row')data=read([null]);
  if(kind==='wrong-date')data.date='2000-01-01';
  return new Response(JSON.stringify(data),{status:200});
 }
 const tag=()=>React.createElement('span',{'aria-hidden':true}),cache={};
 function load(f){if(cache[f])return cache[f];return cache[f]=compiled(f,resolve,{window:dom.window,document:dom.window.document,fetch,Date:ClockDate,setTimeout:(fn,ms)=>{const id=setTimeout(fn,ms);timers.push(id);return id}})}
 function resolve(n){if(n==='@/lib/kintai/clock-display')return load('src/lib/kintai/clock-display.ts');if(n==='react'||n==='react/jsx-runtime')return dep(n);if(n==='next/link')return{__esModule:true,default:({children,href})=>React.createElement('a',{href},children)};if(n==='@/lib/pricing')return{SUPPORT_CONTACT_URL:'https://support.synthetic.invalid/contact'};if(n==='lucide-react')return{Pencil:tag,RotateCcw:tag};if(n==='@/components/kintai/ui-next')return{PageTitle:({children})=>React.createElement('h2',{},children)};if(n==='@/components/kintai/KintaiAccessContext')return{useKintaiAccess:()=>access};if(n==='@/components/ds')return{Skeleton:()=>React.createElement('div',{},'Skeleton')};if(n.startsWith('@/')){for(const ext of ['.ts','.tsx'])if(fs.existsSync(path.join(repo,'src',n.slice(2)+ext)))return load('src/'+n.slice(2)+ext)}if(n.startsWith('./')){for(const ext of ['.ts','.tsx'])if(fs.existsSync(path.join(repo,'src/lib/kintai',n.slice(2)+ext)))return load('src/lib/kintai/'+n.slice(2)+ext)}throw Error('Unmapped '+n)}
 const text=()=>document.body.textContent,button=(name)=>[...document.querySelectorAll('button')].find(x=>x.textContent.includes(name));
 const forms=()=>document.querySelectorAll('section[aria-label="エラーを報告する"] form'),contacts=()=>document.querySelectorAll('a[href="https://support.synthetic.invalid/contact"]');
 const input=async(area,value)=>{await React.act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(area,value);area.dispatchEvent(new dom.window.Event('input',{bubbles:true}))})};
 const sendReport=async()=>{assert.equal(forms().length,1);await React.act(async()=>forms()[0].dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})))};
 const click=async name=>{const b=button(name);assert(b,'Missing button '+name);assert(!b.disabled,'Disabled '+name);await React.act(async()=>{b.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}))})};
 try{
  const Page=load(page).default,{createRoot}=dep('react-dom/client');root=createRoot(document.getElementById('root'));const render=()=>root.render(strict?React.createElement(React.StrictMode,{},React.createElement(Page)):React.createElement(Page));await React.act(async()=>render());
  if(kind==='midnight-open-shift'){
   assert(text().includes('勤務中 — 2時間0分'));const readsBefore=getCount;clockTime+=30000;
   await React.act(async()=>new Promise(resolve=>setTimeout(resolve,1100)));
   assert(getCount>readsBefore);assert(text().includes('勤務中 — 1時間1分'));assert.equal(posts,0);return;
  }
  if(kind==='midnight-held-post'){
   await click('出勤する');assert.equal(posts,1);const readsBefore=getCount;clockTime+=30000;
   await React.act(async()=>new Promise(resolve=>setTimeout(resolve,1100)));
   assert.equal(getCount,readsBefore);assert.equal(posts,1);
   await React.act(async()=>postRelease());assert(text().includes('勤務中 — 0時間1分'));assert(!text().includes('打刻結果を確認できませんでした'));assert.equal(posts,1);
   const nextDay=new Date(clockTime).toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});assert(requests.filter(x=>x.method==='GET').slice(readsBefore).every(x=>x.url.includes(nextDay)));return;
  }
  if(kind.startsWith('display-')){
   assert.equal(posts,0);
   if(kind==='display-multiple-closed')assert(text().includes('勤務時間: 2分'));
   if(kind==='display-second-live')assert(text().includes('勤務中 — 1時間30分'));
   if(kind==='display-on-break'){assert(text().includes('休憩中 — 1時間0分'));assert(text().includes('1時間'));assert(!text().includes('2時間'))}
   return;
  }
  if(kind==='open-page-midnight'){
   assert(text().includes('本日の勤務は終了しました'));const initialReads=getCount;clockTime+=30000;
   await React.act(async()=>new Promise(resolve=>setTimeout(resolve,1100)));
   const updatedDay=new Date(clockTime).toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});assert.notEqual(updatedDay,day);assert(text().includes(Number(updatedDay.slice(5,7))+'月'+Number(updatedDay.slice(8,10))+'日'));
   assert(!text().includes('本日の勤務は終了しました'));assert(text().includes('まだ出勤していません'));assert(getCount>initialReads);assert.equal(posts,0);
   console.log(JSON.stringify({finding:'midnight-refresh-positive',strict,initialDate:day,currentDate:updatedDay,getReadsBefore:initialReads,getReadsAfter:getCount,clockPosts:posts,pageShowsPreviousDayClosedState:false,visibleDateChanged:true}));
   await React.act(async()=>root.unmount());root=createRoot(document.getElementById('root'));await React.act(async()=>render());assert(text().includes('まだ出勤していません'));assert(getCount>initialReads);assert.equal(posts,0);console.log(JSON.stringify({finding:'midnight-reload-control',strict,newDayReadOnRemount:true,newDayNotClockedIn:true,clockPosts:posts}));return;
  }
  if(kind==='ready-delay'){assert(!button('出勤する'));assert.equal(posts,0);access={...access,ready:true};await React.act(async()=>render());postMode='normal-in';await click('出勤する');assert.equal(posts,1);assert(text().includes('勤務中'));return}
  if(kind==='ready-frozen'){access={...access,ready:false};await React.act(async()=>render());await click('出勤する');assert.equal(posts,0);access={...access,ready:true};await React.act(async()=>render());postMode='normal-in';await click('出勤する');assert.equal(posts,1);assert(text().includes('勤務中'));return}
  if(kind==='stale-read'){access={...access,ready:false};await React.act(async()=>render());access={...access,ready:true};await React.act(async()=>render());assert(text().includes('まだ出勤していません'));assert(oldReadResolve);await React.act(async()=>oldReadResolve());assert(text().includes('まだ出勤していません'));assert(!text().includes('勤務中'));assert.equal(posts,0);return}
  if(kind.startsWith('report-')){
   if(!kind.endsWith('initial-error'))await click('出勤する');
   assert.equal(forms().length,0);assert.equal(contacts().length,1);assert.equal(reportRequests.length,0);
   await click('状態を再確認');assert.equal(forms().length,1);assert.equal(contacts().length,1);assert.equal(reportRequests.length,0);
   const area=document.querySelector('textarea');await input(area,'Synthetic retained clock report');
   if(kind==='report-preserve'){
    holdReads=true;await click('状態を再確認');assert.equal(document.querySelector('textarea'),area);assert.equal(area.value,'Synthetic retained clock report');
    await React.act(async()=>heldReads.shift().resolve(new Response('{}',{status:503})));holdReads=false;
   }
   await sendReport();assert.equal(reportRequests.length,1);const first=reportRequests[0];assert.equal(first.userDescription,'Synthetic retained clock report');assert.equal(first.errorType,'unknown');assert.equal(first.errorUrl,'/kintai/[detail]');assert(!JSON.stringify(first).includes('PRIVATE'));assert.match(first.reportId,/^[0-9a-f-]{36}$/);
   if(kind==='report-success'){assert(text().includes('報告を送信しました'));await click('状態を再確認');assert(text().includes('報告を送信しました'));assert.equal(reportRequests.length,1);return}
   assert(!text().includes('ご協力ありがとうございます'));assert(area.readOnly);assert(text().includes(first.reportId));
   if(kind==='report-midnight'||kind==='report-midnight-initial-error'){
    const readsBefore=getCount;clockTime+=30000;
    await React.act(async()=>new Promise(resolve=>setTimeout(resolve,1100)));
    assert(getCount>readsBefore);assert.equal(document.querySelector('textarea'),area);assert.equal(area.value,'Synthetic retained clock report');assert(text().includes(first.reportId));assert.equal(reportRequests.length,1);
    await sendReport();assert.equal(reportRequests.length,2);assert.deepEqual(reportRequests[1],first);assert.equal(posts,kind.endsWith('initial-error')?0:1);return;
   }
   if(kind==='report-actor-reset'){
    access={...access,actorId:'actorB',organizationId:'orgB'};await React.act(async()=>render());assert.equal(forms().length,0);assert(!text().includes(first.reportId));
    access={...access,actorId:'actorA',organizationId:'orgA'};await React.act(async()=>render());await click('出勤する');assert.equal(forms().length,0);await click('状態を再確認');assert.equal(forms().length,1);assert.equal(document.querySelector('textarea').value,'');await sendReport();assert.equal(reportRequests.length,2);assert.notEqual(reportRequests[1].reportId,first.reportId);return;
   }
   holdReads=true;await click('状態を再確認');assert.equal(document.querySelector('textarea'),area);assert.equal(area.value,'Synthetic retained clock report');assert(text().includes(first.reportId));
   await React.act(async()=>heldReads.shift().resolve(new Response('{}',{status:503})));holdReads=false;
   assert.equal(document.querySelector('textarea'),area);assert(text().includes(first.reportId));await sendReport();assert.equal(reportRequests.length,2);assert.deepEqual(reportRequests[1],first);assert.equal(posts,kind==='report-initial-error'?0:1);return;
  }
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
  if(kind==='normal-out'||kind==='jst-midnight-carry'){await click('退勤する');await click('退勤する')}
  else if(kind==='normal-break-start')await click('休憩を開始');
  else if(kind==='normal-break-end')await click('休憩終了');
  else await click('出勤する');
  assert.equal(posts,1);
  if(kind.startsWith('normal-')||kind==='jst-midnight-carry'){assert(!text().includes('打刻結果を確認できませんでした'));assert(text().includes(kind==='normal-out'||kind==='jst-midnight-carry'?'本日の勤務は終了しました':kind==='normal-break-start'?'休憩中':'勤務中'));return}
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
 const kinds=['normal-in', 'normal-out', 'normal-break-start', 'normal-break-end', 'missing', 'invalid-json', 'null', 'array', 'wrong-type', 'wrong-id', 'wrong-time', 'error-mixed', 'http500', 'network', 'persisted500', 'persisted-malformed', 'read-fails', 'unknown-recheck', 'explicit-resume', 'definitive400', 'bad-initial', 'null-row', 'wrong-date', 'duplicate', 'unmount', 'actor-change', 'actor-return', 'ack-read-fails', 'valid-ack-unconfirmed', 'ack-different-record', 'ack-other-employee', 'ack-time-mismatch', 'ready-delay', 'ready-frozen', 'stale-read', 'inactive', 'jst-midnight-carry', 'report-unknown', 'report-preserve', 'report-pending', 'report-success', 'report-malformed', 'report-initial-error', 'report-actor-reset', 'open-page-midnight', 'display-multiple-closed', 'display-second-live', 'display-on-break', 'midnight-open-shift', 'midnight-held-post', 'report-midnight', 'report-midnight-initial-error'];
 for(const strict of [false,true])for(const kind of kinds)await test(kind+(strict?' StrictMode':' normal'),()=>mounted(kind,strict));
 const out={checkedAt:new Date().toISOString(),passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,cases:results,sourceHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(source(f)).digest('hex')])),scope:'Actual repository clock page/shared display/canonical attendance plus current hook/parser/form in normal and StrictMode. 116 parser and mounted scenarios expected including midnight carry, held POST and report draft/ID preservation, not unique product features. Offline synthetic HTTP/DOM; not native/browser/provider/production proof.'};if(process.env.DOYA_KINTAI_CLOCK_RESULT)fs.writeFileSync(process.env.DOYA_KINTAI_CLOCK_RESULT,JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({passed:out.passed,failed:out.failed}));if(out.failed)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1});
