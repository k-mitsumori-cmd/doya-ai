const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {load,check,results}=require('./load-typescript.cjs'),root=path.resolve(__dirname,'../..'),file='src/app/banner/url/page.tsx';
const pricing=load('src/lib/pricing.ts',{'./unified-plan':load('src/lib/unified-plan.ts')}),plans=load('src/lib/plan-utils.ts');
function fixture({plan='PRO',bannerPlan='FREE',guest=false,eligible=true,usage={monthlyLimit:150,monthlyUsed:150,monthlyRemaining:0},limit=true,fetches=[]}={}){
 const source=fs.readFileSync(path.join(process.env.DOYA_TEST_BASELINE||root,file),'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true),stateNames=[];
 function find(node){if(ts.isVariableDeclaration(node)&&ts.isArrayBindingPattern(node.name)&&ts.isCallExpression(node.initializer)&&node.initializer.expression.getText(ast)==='useState')stateNames.push(node.name.elements[0].name.text);ts.forEachChild(node,find);}find(ast);
 const state=new Map(Object.entries({targetUrl:'https://example.invalid/product',error:limit?'synthetic limit':'',errorType:limit?'limit':null,limitUsage:limit?usage:null,showAdvanced:true,banners:['data:image/png;base64,synthetic'],baseBannerIdx:0}));
 let index=0,buttons=[],selects=[],requests=[];const timers=new Map();
 const fakeReact={...React,useState:init=>{const name=stateNames[index++];assert.ok(name);if(!state.has(name))state.set(name,init);return[state.get(name),value=>state.set(name,typeof value==='function'?value(state.get(name)):value)];},createElement:(type,props,...children)=>{if(type==='button')buttons.push({props,children});if(type==='select')selects.push(props);return React.createElement(type,props,...children);}};
 const empty=()=>null,container=({children})=>React.createElement('div',null,children),motion=new Proxy({},{get:()=>container}),exports={};
 const mocks={react:fakeReact,'next/link':({href,children,...props})=>React.createElement('a',{href,...props},children),'next-auth/react':{useSession:()=>({data:guest?null:{user:{plan,bannerPlan,email:'qa@example.invalid'}}})},'lucide-react':new Proxy({},{get:()=>empty}),'react-hot-toast':{Toaster:empty,toast:{error(){},success(){}}},'framer-motion':{motion,AnimatePresence:container},'@/components/DashboardSidebar':empty,'@/components/LoadingProgress':empty,'@/components/BannerCancelScheduleNotice':empty,'@/components/FreeHourPopup':{FreeHourPopup:empty},'@/lib/pricing':pricing,'@/lib/plan-utils':plans,'@/components/CheckoutButton':{CheckoutButton:container},'@/components/TrialCallout':{useTrialEligible:()=>eligible,TRIAL_DAYS:30,TrialNote:()=>eligible?React.createElement('span',null,'30日間無料'):null}};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,{exports,React:fakeReact,require:n=>{if(n in mocks)return mocks[n];throw Error('Unmocked '+n)},AbortController,window:{setTimeout:(fn,ms)=>{assert.equal(ms,290000);timers.set(1,fn);return 1;},clearTimeout:id=>timers.delete(id)},fetch:async(url,init)=>{requests.push({url,body:JSON.parse(init.body)});assert.ok(init.signal);assert.ok(fetches.length,'unexpected request');const response=fetches.shift();if(response instanceof Error)throw response;return typeof response==='function'?response(init.signal):response;}});
 return{timers,fireDeadline:()=>{const entries=[...timers];timers.clear();for(const [,fn] of entries)fn();},render:()=>{index=0;buttons=[];selects=[];return renderToStaticMarkup(React.createElement(exports.default));},state,requests,
  countEnabled:n=>{const b=buttons.find(b=>b.children[0]===n);assert.ok(b,'count button '+n);return !b.props.disabled;},chooseCount:n=>{const b=buttons.find(b=>b.children[0]===n);assert.ok(b&&!b.props.disabled);b.props.onClick();},sizeEnabled:()=>selects.some(p=>p.disabled===false),
  invoke:name=>{const b=buttons.find(b=>b.props.onClick?.name===name);assert.ok(b,name+' must be rendered');return b.props.onClick();}};
}
(async()=>{
 await check('URL banner page keeps PRO and paid aliases above stale service FREE, matching server entitlement',async()=>{
  for(const plan of ['PRO','BUNDLE','BASIC','STARTER','BUSINESS','PREMIUM','PRO_MONTHLY','BANNER_PRO']){
   const f=fixture({plan}),html=f.render();assert.ok(html.includes('>有料</span>'),plan);assert.ok(!html.includes('>無料</span>'),plan);assert.equal(f.countEnabled(5),true,plan);assert.equal(f.countEnabled(6),false,plan);assert.equal(f.sizeEnabled(),true,plan);assert.match(html,/1〜5枚 \/ サイズ指定OK/);f.chooseCount(5);f.render();assert.equal(f.state.get('count'),5);
  }
 });
 await check('URL banner quota sends PRO and Enterprise to support without non-sold purchase claims',async()=>{
  for(const monthlyLimit of [150,1000]){const f=fixture({plan:monthlyLimit===1000?'ENTERPRISE':'PRO',usage:{monthlyLimit}}),html=f.render();assert.match(html,/追加の利用枠を相談する/);assert.ok(html.includes('href="'+pricing.HIGH_USAGE_CONTACT_URL+'"'));assert.doesNotMatch(html,/エンタープライズプランを確認する|エンタープライズプランは月1000枚まで/);assert.match(html,/料金・利用条件を確認する/);}
 });
 await check('URL banner preserves valid service-paid entitlement and unknown plans never unlock paid settings',async()=>{
  const legacy=fixture({plan:'FREE',bannerPlan:'LIGHT',usage:{monthlyLimit:50}}),html=legacy.render();assert.ok(html.includes('>有料</span>'));assert.equal(legacy.sizeEnabled(),true);assert.equal(legacy.countEnabled(4),false);assert.match(html,/プロプランは月150枚まで/);
  const unknown=fixture({plan:'NOT_PRO',bannerPlan:'invalid',usage:{monthlyLimit:15}});unknown.render();assert.equal(unknown.sizeEnabled(),false);assert.equal(unknown.countEnabled(4),false);
 });
 await check('URL banner free trial eligibility and guest login guidance stay distinct and retain remaining count',async()=>{
  for(const eligible of [true,false]){const f=fixture({plan:'FREE',eligible,usage:{monthlyLimit:15,monthlyRemaining:1}}),html=f.render();assert.equal(html.includes('30日間無料の対象プランを確認する'),eligible);assert.match(html,/今月はあと1枚生成できます/);assert.match(html,/枚数を1枚以下に減らす/);assert.equal(f.sizeEnabled(),false);assert.equal(f.countEnabled(4),false);}
  const guest=fixture({guest:true,usage:{monthlyLimit:0}}),html=guest.render();assert.match(html,/ログインして続ける/);assert.ok(html.includes('/auth/signin?callbackUrl=%2Fbanner%2Furl'));
 });
 await check('URL banner generation and regeneration retain explicit support action and clear it on the next failure',async()=>{
  for(const name of ['handleGenerate','handleRegenerateFromSelected']){
   const f=fixture({plan:'LIGHT',limit:false,fetches:[Response.json({code:'MONTHLY_LIMIT_REACHED',error:'quota',usage:{monthlyLimit:50,monthlyRemaining:0},upgradeUrl:pricing.HIGH_USAGE_CONTACT_URL},{status:429}),Response.json({error:'入力をご確認ください'},{status:400})]});f.render();await f.invoke(name);assert.equal(f.state.get('limitContactRequested'),true);assert.match(f.render(),/追加の利用枠を相談する/);await f.invoke(name);assert.equal(f.state.get('limitContactRequested'),false);assert.equal(f.state.get('errorType'),'system');assert.equal(f.state.get('isGenerating'),false);assert.equal(f.requests.length,2);assert.equal(f.requests[0].url,'/api/banner/from-url');assert.equal(f.requests[0].body.targetUrl,'https://example.invalid/product');if(name==='handleRegenerateFromSelected')assert.ok(f.requests[0].body.baseImage.startsWith('data:image/'));
  }
 });
 await check('URL banner arbitrary external response URLs cannot replace plan guidance',async()=>{
  const f=fixture({plan:'FREE',limit:false,fetches:[Response.json({code:'MONTHLY_LIMIT_REACHED',error:'quota',usage:{monthlyLimit:15},upgradeUrl:'https://external.invalid/payment'},{status:429})]});f.render();await f.invoke('handleGenerate');assert.equal(f.state.get('limitContactRequested'),false);const html=f.render();assert.ok(!html.includes('external.invalid'));assert.ok(html.includes('href="/banner/pricing"'));
 });
 await check('URL banner body reads retain their deadline and abort preserves previous results in both handlers',async()=>{
  for(const name of ['handleGenerate','handleRegenerateFromSelected']){
   const f=fixture({limit:false,fetches:[signal=>({status:200,ok:true,text:()=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('synthetic timeout','AbortError')),{once:true}))})]});f.render();const previous=f.state.get('banners');let settled=false;const pending=f.invoke(name).then(()=>{settled=true;});await new Promise(resolve=>setImmediate(resolve));assert.equal(settled,false);assert.equal(f.timers.size,1);assert.equal(f.state.get('isGenerating'),true);f.fireDeadline();await pending;assert.equal(settled,true);assert.equal(f.timers.size,0);assert.equal(f.state.get('isGenerating'),false);assert.equal(f.state.get('errorType'),'system');assert.match(f.state.get('error'),/履歴を確認/);assert.equal(f.state.get('banners'),previous);
  }
 });
 await check('URL banner invalid success envelopes, private non-JSON diagnostics and network errors never erase old images',async()=>{
  for(const name of ['handleGenerate','handleRegenerateFromSelected']){
   for(const response of [Response.json(null),Response.json({}),Response.json([]),Response.json({banners:[]}),Response.json({banners:['not-an-image']}),new Response('SYNTHETIC_PRIVATE_DIAGNOSTIC',{status:200}),new Response('SYNTHETIC_PRIVATE_DIAGNOSTIC',{status:500}),new Error('SYNTHETIC_PRIVATE_DIAGNOSTIC'),{ok:true,status:200,text:async()=>{throw new Error('SYNTHETIC_PRIVATE_DIAGNOSTIC');}}]){
    const f=fixture({limit:false,fetches:[response]});f.render();const previous=f.state.get('banners');await f.invoke(name);assert.equal(f.state.get('banners'),previous);assert.equal(f.state.get('isGenerating'),false);assert.equal(f.state.get('errorType'),'system');assert.doesNotMatch(f.state.get('error'),/SYNTHETIC_PRIVATE/);assert.equal(f.timers.size,0);
   }
  }
 });
 await check('URL banner known upstream statuses keep actionable public messages without raw body text',async()=>{
  for(const status of [413,502,503]){
   const f=fixture({limit:false,fetches:[new Response('SYNTHETIC_PRIVATE_DIAGNOSTIC',{status})]});f.render();await f.invoke('handleGenerate');assert.doesNotMatch(f.state.get('error'),/SYNTHETIC_PRIVATE/);assert.match(f.state.get('error'),status === 413 ? /送信データが大きすぎ/ : /混雑/);
  }
 });
 await check('URL banner valid success and partial warnings update images truthfully and release timers',async()=>{
  for(const name of ['handleGenerate','handleRegenerateFromSelected'])for(const warning of [undefined,'生成枚数の反映を確認できませんでした。残り枚数を再読み込みしてください。']){
   const f=fixture({limit:false,fetches:[Response.json({banners:['data:image/png;base64,new'],warning})]});f.render();await f.invoke(name);assert.deepEqual(Array.from(f.state.get('banners')),['data:image/png;base64,new']);assert.equal(f.state.get('isGenerating'),false);assert.equal(f.timers.size,0);assert.equal(f.state.get('error'),warning||'');if(warning)assert.equal(f.state.get('errorType'),'system');
  }
 });
 console.log(JSON.stringify({passed:results.length,scope:'Actual page render and handlers; synthetic session/router/fetch, no provider, DB or payment request',results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
