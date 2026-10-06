const assert=require('node:assert/strict');
const {fixture,dom}=require('./verify-cunning-start-mounted.cjs');
const checks=[];
const paths=['/api/cunning/knowledge','/api/cunning/sessions','/api/cunning/company','/api/cunning/profiles'];
const kb={id:'kb',name:'SYNTHETIC_KB',_count:{chunks:1}};
const company=i=>({id:'company'+i,companyName:'SYNTHETIC_COMPANY_'+i,url:'https://example.invalid'});
const applicant=i=>({id:'applicant'+i,name:'SYNTHETIC_APPLICANT_'+i});
const page=(rows,total=rows.length,nextCursor=null)=>({profiles:rows,total,nextCursor});
const button=(f,text)=>[...f.c.querySelectorAll('button')].find(b=>b.textContent.includes(text));
const click=(f,b)=>{assert.ok(b,'Missing button');return f.act(()=>f.props(b).onClick())};
const interview=f=>click(f,button(f,'面接対策'));
const retry=(f,part)=>{const alert=[...f.c.querySelectorAll('[role="alert"]')].find(e=>e.textContent.includes(part));assert.ok(alert,'Missing alert '+part);return click(f,alert.querySelector('button'))};
const select=(f,index,value)=>f.act(()=>f.props(f.c.querySelectorAll('select')[index]).onChange({target:{value}}));
async function check(name,fn,options={}){const f=await fixture(options);try{await fn(f);assert.ok(!f.c.textContent.includes('SYNTHETIC_PRIVATE'));checks.push(name)}finally{await f.close();assert.equal(f.timers.size,0)}}
(async()=>{
for(const path of paths){
 await check('Fetch deadline and explicit recovery: '+path,async f=>{
  await f.draft();await f.expire();if(path.includes('company')||path.includes('profiles'))await interview(f);
  const error=path.includes('knowledge')?'ナレッジを取得':path.includes('sessions')?'最近のセッションを取得':'企業・プロフィールを取得';
  assert.ok(f.c.textContent.includes(error));assert.ok(f.calls.filter(x=>x.url===path).every(x=>x.init.signal.aborted));
  const count=f.calls.length;await f.act(()=>{});assert.equal(f.calls.length,count,'No automatic retry');
  f.list(path,async()=>Response.json(path.includes('knowledge')?{bases:[kb]}:path.includes('sessions')?{sessions:[]}:page(path.includes('company')?[company(0)]:[applicant(0)])));
  await retry(f,error);assert.ok(!f.c.textContent.includes(error));assert.equal(f.c.querySelector('textarea').value,'PRESERVED_DRAFT');
 },{[path]:()=>new Promise(()=>{})});
 await check('Body deadline cancels reader: '+path,async f=>{
  await f.expire();if(path.includes('company')||path.includes('profiles'))await interview(f);
  assert.ok(f.c.textContent.includes('取得できませんでした'));assert.ok(f.calls.filter(x=>x.url===path).every(x=>x.init.signal.aborted));
 },{[path]:async()=>new Response(new ReadableStream({pull(){return new Promise(()=>{})}}))});
}
await check('Profile retry preserves both selected references and note, without fetching quota/history/knowledge',async f=>{
 await interview(f);await select(f,0,'company');await select(f,1,'applicant');await f.draft();
 f.list('/api/cunning/company',async()=>{throw Error('SYNTHETIC_PRIVATE')});
 // Reauthentication refresh triggers a scoped read; parent layout separately handles actor remount.
 f.auth('authenticated',{user:{id:'alpha',plan:'PRO'}});await f.render();
 assert.equal(f.c.querySelectorAll('select')[0].value,'company');assert.equal(f.c.querySelectorAll('select')[1].value,'applicant');
 const count=f.calls.length;f.list('/api/cunning/company',async()=>Response.json(page([{id:'company',companyName:'SYNTHETIC_COMPANY',url:'https://example.invalid'}])));
 await retry(f,'企業・プロフィールを取得');assert.deepEqual(f.calls.slice(count).map(x=>x.url).sort(),['/api/cunning/company','/api/cunning/profiles']);
 assert.equal(f.c.querySelectorAll('select')[0].value,'company');assert.equal(f.c.querySelectorAll('select')[1].value,'applicant');assert.equal(f.c.querySelector('textarea').value,'PRESERVED_DRAFT');
});
await check('Large legitimate full applicant profile page above billing 64KiB is accepted',async f=>{
 await interview(f);assert.ok(f.c.querySelector('option[value="applicant0"]'));assert.ok(!f.c.textContent.includes('企業・プロフィールを取得できませんでした'));
},{'/api/cunning/profiles':async()=>Response.json(page(Array.from({length:50},(_,i)=>({...applicant(i),resume:'職'.repeat(8000),motivation:'望'.repeat(4000)}))))});
for(const [name,body] of [['invalid company fields',page([{id:'safe',companyName:{invalid:true},url:'https://example.invalid'}])],['error response', {error:'SYNTHETIC_PRIVATE',...page([company(0)])}],['invalid JSON',null],['excessive stream', 'x'.repeat(4*1024*1024+1)]])await check('Malformed '+name+' preserves previous profile list',async f=>{
 await interview(f);await select(f,0,'company');f.list('/api/cunning/company',async()=>name==='invalid JSON'?new Response('{'):typeof body==='string'?new Response(body):Response.json(body));
 f.auth('authenticated',{user:{id:'alpha',plan:'PRO'}});await f.render();assert.ok(f.c.textContent.includes('企業・プロフィールを取得できませんでした'));assert.equal(f.c.querySelectorAll('select')[0].value,'company');
});
await check('Same-frame pagination is coalesced, failure preserves pages, explicit reload keeps later-page selected option',async f=>{
 await interview(f);const more=button(f,'企業をさらに表示');let finish;
 f.list('/api/cunning/company?cursor=company49',()=>new Promise(r=>finish=r));const handler=f.props(more).onClick;await f.act(()=>{handler();handler()});assert.equal(f.calls.filter(x=>x.url.includes('?cursor=')).length,1);
 await f.act(()=>finish(Response.json(page([company(50)],51))));await select(f,0,'company50');
 f.list('/api/cunning/company',async()=>{throw Error('SYNTHETIC_PRIVATE')});f.auth('authenticated',{user:{id:'alpha',plan:'PRO'}});await f.render();assert.equal(f.c.querySelectorAll('select')[0].value,'company50');
 f.list('/api/cunning/company',async()=>Response.json(page(Array.from({length:50},(_,i)=>company(i)),51,'company49')));await retry(f,'企業・プロフィールを取得');assert.equal(f.c.querySelectorAll('select')[0].value,'company50');assert.ok(f.c.querySelector('option[value="company50"]').textContent.includes('選択済み'));
},{'/api/cunning/company':async()=>Response.json(page(Array.from({length:50},(_,i)=>company(i)),51,'company49'))});
await check('Pagination network failure releases lock and retains visible rows and cursor',async f=>{
 await interview(f);f.list('/api/cunning/company?cursor=company49',async()=>{throw Error('SYNTHETIC_PRIVATE')});await click(f,button(f,'企業をさらに表示'));assert.ok(f.c.textContent.includes('続きを取得できませんでした'));assert.equal(button(f,'企業をさらに表示').disabled,false);assert.ok(f.c.querySelector('option[value="company49"]'));
 f.list('/api/cunning/company?cursor=company49',async()=>Response.json(page([company(50)],51)));await click(f,button(f,'企業をさらに表示'));assert.ok(f.c.querySelector('option[value="company50"]'));
},{'/api/cunning/company':async()=>Response.json(page(Array.from({length:50},(_,i)=>company(i)),51,'company49'))});
for(const [path,data] of [['/api/cunning/knowledge',{bases:[{id:'bad',name:'SYNTHETIC_PRIVATE'}]}],['/api/cunning/sessions',{sessions:[{id:'../invalid',title:'SYNTHETIC_PRIVATE',mode:'sales',durationSec:0,_count:{answers:0}}]}]])await check('Malformed list row cannot crash render or create unsafe links: '+path,async f=>{
 assert.ok(f.c.textContent.includes('取得できませんでした'));assert.ok(!f.c.querySelector('a[href*="../invalid"]'));
},{[path]:async()=>Response.json(data)});
await check('Actor/auth interruption cancels all scoped list reads and rejects resolved stale ABA completion',async()=>{
 const finish=[];const f=await fixture(Object.fromEntries(paths.map(path=>[path,()=>new Promise(resolve=>finish.push({path,resolve}))])));
 try {
  const old=f.calls.filter(x=>paths.includes(x.url));const oldFinish=[...finish];const before=f.calls.length;
  f.auth('loading',{user:{id:'alpha',plan:'FREE'}});await f.render();assert.ok(old.every(x=>x.init.signal.aborted));
  f.auth('unauthenticated',null);await f.render();assert.equal(f.calls.length,before);
  f.auth('authenticated',{user:{id:'alpha',plan:'FREE'}});await f.render();assert.ok(f.calls.length>before);
  await f.act(()=>{for(const {path,resolve} of oldFinish)resolve(Response.json(path.includes('knowledge')?{bases:[{...kb,name:'SYNTHETIC_PRIVATE'}]}:path.includes('sessions')?{sessions:[{id:'old',title:'SYNTHETIC_PRIVATE',mode:'sales',durationSec:0,_count:{answers:0}}]}:page(path.includes('company')?[{...company(0),companyName:'SYNTHETIC_PRIVATE'}]:[{...applicant(0),name:'SYNTHETIC_PRIVATE'}])))});
  assert.ok(!f.c.textContent.includes('SYNTHETIC_PRIVATE'));await interview(f);assert.ok(!f.c.textContent.includes('SYNTHETIC_PRIVATE'));await f.expire();
 }finally{await f.close();assert.equal(f.timers.size,0)}
});
await check('Missing refreshed knowledge keeps an explicit selected warning and blocks retained start callback until reselection',async f=>{
 await select(f,0,'kb');let finish;f.list('/api/cunning/knowledge',()=>new Promise(resolve=>finish=resolve));f.auth('authenticated',{user:{id:'alpha',plan:'PRO'}});await f.render();const retained=f.props(f.button()).onClick;assert.equal(f.button().disabled,false);await f.act(()=>finish(Response.json({bases:[]})));
 assert.equal(f.c.querySelector('select').value,'kb');assert.ok(f.c.querySelector('option[value="kb"]').textContent.includes('一覧にありません'));assert.ok(f.c.textContent.includes('参照先を選び直してください'));assert.ok(f.button().disabled);
 await f.act(()=>retained());assert.equal(f.posts().length,0);await select(f,0,'');await f.click();assert.equal(f.posts().length,1);assert.equal(JSON.parse(f.posts()[0].init.body).knowledgeBaseId,null);
});
await check('Unmount cancels every pending read and clears all deadlines',async f=>{const pending=f.calls.filter(x=>paths.includes(x.url));await f.close();assert.ok(pending.every(x=>x.init.signal.aborted));assert.equal(f.timers.size,0)},Object.fromEntries(paths.map(path=>[path,()=>new Promise(()=>{})])));
console.log(JSON.stringify({passed:checks.length,checks,scope:'Actual Tool mounted under StrictMode; actual bounded list/billing readers and parsers; synthetic network/timers only. No authenticated production calls, customer writes, AI, recording, upload or billing. Parent layout actor isolation is tested separately.'},null,2));dom.window.close();
})().catch(e=>{console.error(e);process.exitCode=1});
process.on('beforeExit',()=>{if(checks.length!==21){console.error('Incomplete Cunning list mounted checks',checks.length);process.exitCode=1}});
