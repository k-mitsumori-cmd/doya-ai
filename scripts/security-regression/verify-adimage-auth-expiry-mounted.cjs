const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{createRequire}=require('node:module')
const file='scripts/security-regression/verify-adimage-operation-tool-mounted.cjs'
const prefix=fs.readFileSync(file,'utf8').split('\n(async()=>{')[0]
const f=new Function('require','__dirname',prefix+'\nreturn {mount,close,act,input,click,prepare,render,client,host:()=>host,dom,reset:()=>{receipts=new Map();calls=[];actor="actor-a";status="authenticated";mode="success"},setActor:v=>actor=v,setNetwork:v=>network=v,originalNetwork:network,calls:()=>calls};')(createRequire(path.resolve(file)),path.dirname(path.resolve(file)))
const cases=[]
const test=async(name,fn)=>{await f.close();f.reset();f.dom.window.localStorage.clear();f.setNetwork(f.originalNetwork);await f.mount();await fn();cases.push(name);console.log('PASS '+name)}
const checkLogin=()=>{assert.equal(f.host().querySelector('a')?.getAttribute('href'),'/auth/signin?callbackUrl=/adimage');assert(f.host().textContent.includes('再ログイン'));assert.equal(f.host().querySelector('input'),null);assert.equal(f.host().querySelector('img'),null);assert(!f.host().textContent.includes('Synthetic brand'))}
const posts=()=>f.calls().filter(c=>c.init.method==='POST').length
;(async()=>{try{
 for(const kind of ['analyze','generate','refine','feedback']) await test(kind+' POST401 retains intent, hides private UI, and recovers by GET without replay',async()=>{
  if(kind!=='analyze')await f.prepare()
  if(['refine','feedback'].includes(kind)){await f.click('広告画像を作る');await f.click('結果を確認しました')}
  if(kind==='refine')await f.act(()=>f.input('その他の要望（任意）','Synthetic refine'))
  if(kind==='analyze')await f.act(()=>f.input('https://example.com','https://synthetic.test'))
  let cancelled=0
  f.setNetwork(async c=>{if(c.init.method==='POST'){await f.originalNetwork(c);return new Response(new ReadableStream({cancel(){cancelled++}}),{status:401})}return f.originalNetwork(c)})
  await f.click({analyze:'広告コピーを作る',generate:'広告画像を作る',refine:'この内容で作り直す',feedback:'AIフィードバックをもらう'}[kind])
  checkLogin();const saved=f.client.readAdImageIntent('actor-a');assert.equal(saved.kind,kind);const count=posts();assert.equal(cancelled,1)
  await f.act(()=>{f.dom.window.dispatchEvent(new f.dom.window.Event('focus'));f.dom.window.dispatchEvent(new f.dom.window.Event('storage'))});checkLogin()
  f.setNetwork(c=>c.url.startsWith('/api/adimage/operations?')?Response.json({error:'Login'},{status:401}):f.originalNetwork(c));await f.click('保存結果を確認');checkLogin();assert.equal(f.client.readAdImageIntent('actor-a').operationId,saved.operationId)
  f.setNetwork(c=>c.url.startsWith('/api/adimage/operations?')?Response.json({invalid:true}):f.originalNetwork(c));await f.click('保存結果を確認');checkLogin()
  f.setNetwork(f.originalNetwork);await f.click('保存結果を確認');assert.equal(posts(),count);assert(!f.host().textContent.includes('ログインの有効期限'));assert.equal(f.client.readAdImageIntent('actor-a').operationId,saved.operationId);await f.click('結果を確認しました');assert.equal(f.client.readAdImageIntent('actor-a'),null)
 })
 await test('GET401 clears previously accepted result; restored browser GET requires explicit acknowledgment',async()=>{
  await f.prepare();await f.click('広告画像を作る');assert(f.host().querySelector('img'));const saved=f.client.readAdImageIntent('actor-a');const count=posts()
  f.setNetwork(c=>c.url.startsWith('/api/adimage/operations?')?Response.json({error:'Login'},{status:401}):f.originalNetwork(c));await f.click('保存結果を確認');checkLogin();assert(!f.host().textContent.includes('結果を確認しました'))
  await f.close();f.setNetwork(f.originalNetwork);await f.mount();assert.equal(f.client.readAdImageIntent('actor-a').operationId,saved.operationId);await f.click('保存結果を確認');assert(f.host().querySelector('img'));assert.equal(posts(),count);await f.click('結果を確認しました')
 })
 await test('DELETE401 retains missing intent until verified cancellation and acknowledgment',async()=>{
  const saved=f.client.createAdImageIntent('actor-a','analyze','analysis');await f.act(()=>f.dom.window.dispatchEvent(new f.dom.window.Event('focus')));await f.click('保存結果を確認')
  f.setNetwork(c=>c.init.method==='DELETE'?Response.json({error:'Login'},{status:401}):f.originalNetwork(c));await f.click('未受付の操作を終了');checkLogin();assert.equal(f.client.readAdImageIntent('actor-a').operationId,saved.operationId)
  f.setNetwork(f.originalNetwork);await f.click('保存結果を確認');await f.click('未受付の操作を終了');await f.click('この操作を閉じる');assert.equal(f.client.readAdImageIntent('actor-a'),null);assert.equal(posts(),0)
 })
 await test('Late old actor401 cannot require login for a different actor or returned actor epoch',async()=>{
  let finish;f.setNetwork(c=>c.url==='/api/adimage/analyze'?new Promise(r=>finish=r):f.originalNetwork(c));await f.act(()=>f.input('https://example.com','https://synthetic.test'));await f.click('広告コピーを作る');f.setActor('actor-b');await f.render();f.setActor('actor-a');await f.render();await f.act(()=>finish(Response.json({error:'Login'},{status:401})));assert(!f.host().textContent.includes('ログインの有効期限'));assert(f.client.readAdImageIntent('actor-a'));assert.equal(f.client.readAdImageIntent('actor-b'),null)
 })
 const files=['src/app/adimage/Tool.tsx','src/lib/adimage/use-operation-recovery.ts','src/lib/adimage/operation-client.ts'];fs.writeFileSync('docs/audits/2026-10-06-all-services-recheck/adimage-auth-expiry-mounted-results.json',JSON.stringify({checkedAt:new Date().toISOString(),passed:cases.length,cases,sourceHashes:Object.fromEntries(files.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')])),scope:'Actual Tool/hook/client React18 StrictMode; synthetic HTTP/session. No real OAuth, provider, production customer data or native-browser claim.'},null,2)+'\n')
 }finally{await f.close()}})().catch(e=>{console.error(e);process.exitCode=1})
