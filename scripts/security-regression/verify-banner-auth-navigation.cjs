process.env.NODE_ENV='test';
async function checkUrl(){
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {load,check,results}=require('./load-typescript.cjs'),root=path.resolve(__dirname,'../..'),file='src/app/(shell)/banner/url/page.tsx';
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

const {JSDOM}=require('jsdom');
const guest=fixture({guest:true,limit:true,usage:{monthlyLimit:0,monthlyUsed:0,monthlyRemaining:0}});
const guestDoc=new JSDOM(guest.render()).window.document;
const links=[...guestDoc.querySelectorAll('a')].filter(a=>a.getAttribute('href')?.startsWith('/auth/signin'));
const decoded=links.map(a=>({label:a.textContent.trim(),callback:new URL(a.getAttribute('href'),'https://example.invalid').searchParams.get('callbackUrl')}));
for(const label of ['ログイン','ログインして試す','ログインして続ける']) assert.equal(decoded.find(a=>a.label===label)?.callback,'/banner/url',label);
assert.ok([...guestDoc.querySelectorAll('a')].some(a=>a.textContent.trim()==='手動で作る'&&a.getAttribute('href')==='/banner/dashboard'));
const signed=fixture({guest:false,limit:true}),signedDoc=new JSDOM(signed.render()).window.document;
assert.equal([...signedDoc.querySelectorAll('a')].some(a=>a.textContent.trim()==='ログイン'&&a.getAttribute('href')?.startsWith('/auth/signin')),false);
assert.equal(guest.requests.length+signed.requests.length,0);
console.log('PASS actual URL page guest 3 auth callbacks remain URL workflow; manual mode and authenticated view unchanged');

}
async function checkDashboard(){
process.env.NODE_ENV='test';
const UI_NEXT_MOCKS={'@/components/shell/ui-next-context':{__esModule:true,useUiNext:()=>false,useUiNextMode:()=>null},'@/components/ds':{__esModule:true,Button:()=>null,ToolHero:()=>null,EmptyState:()=>null,Skeleton:()=>null},'@/components/shell/ShellLoading':{__esModule:true,default:()=>null},'@/components/banner/banner-next.module.css':{__esModule:true,default:{}},'@/components/adimage/AdImageProgressNext':{__esModule:true,default:()=>null}} // 新しい見た目（UI 品質）の部品。今の見た目（useUiNext()=false）で確かめる
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),ts=require('typescript'),assert=require('node:assert/strict'),React=require('react'),{JSDOM}=require('jsdom');
const b='docs/audits/2026-10-06-all-services-recheck/';const prefix=process.argv.find(x=>x.startsWith('--source-root='))?.slice(14)||'';
const dom=new JSDOM('<!doctype html><body></body>',{url:'https://local.test/banner/dashboard'});global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true;const {createRoot}=require('react-dom/client');window.scrollTo=()=>{};window.HTMLElement.prototype.scrollIntoView=function(){};
const props=e=>e?.[Object.keys(e).find(k=>k.startsWith('__reactProps$'))];const act=fn=>React.act(async()=>{await fn();for(let i=0;i<12;i++)await new Promise(setImmediate)});const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
class Observer{observe(){}disconnect(){}unobserve(){}}
let actor='alpha',plan='PRO',status='authenticated',reply,requests=[],notices=[],root,host;const timers=new Set(),intervals=new Set();
const session=()=>({status,data:status==='unauthenticated'?null:{user:{id:actor,plan:'FREE',bannerPlan:plan}}});const toast=s=>notices.push(s);toast.error=toast.success=toast;
const template={id:'template',industry:'ビジネス / ブランディング',category:'business',prompt:'Synthetic template prompt '.repeat(5),size:'1200x628',imageUrl:'data:image/png;base64,synthetic-template',previewUrl:null,displayTitle:'Synthetic template'};
const fetch=async(url,init={})=>{if(String(url).includes('/templates'))return Response.json({templates:[template],featuredTemplateId:'template'});if(url==='/api/banner/test/generate'){requests.push({url,init});return reply?reply():Response.json({banners:['data:image/png;base64,ALPHA_PRIVATE']})}throw Error('Unexpected synthetic fetch '+url)};
const globals={window,document,HTMLElement:window.HTMLElement,IntersectionObserver:Observer,ResizeObserver:Observer,sessionStorage:window.sessionStorage,localStorage:window.localStorage,fetch,console:{log(){},warn(){},error(){}},setInterval:(fn,ms)=>{const id=setInterval(fn,ms);intervals.add(id);return id},clearInterval:id=>{clearInterval(id);intervals.delete(id)},setTimeout:(fn,ms)=>{const id=setTimeout(fn,ms===3000?0:ms);timers.add(id);return id},clearTimeout,requestAnimationFrame:fn=>setTimeout(fn,0),cancelAnimationFrame:clearTimeout,FileReader:window.FileReader,AbortController,AbortSignal,TextDecoder,Uint8Array,Response,URL,crypto};
function load(file,mocks){const exports={};const actual=prefix&&fs.existsSync(prefix+'/'+file)?prefix+'/'+file:file;vm.runInNewContext(ts.transpileModule(fs.readFileSync(actual,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:n=>{if(!(n in mocks)&&n in UI_NEXT_MOCKS)return UI_NEXT_MOCKS[n];assert(n in mocks,'Unmocked '+n);const v=mocks[n];return v&&Object.hasOwn(v,'default')?{__esModule:true,...v}:v},...globals},{filename:actual});return exports}
const shared={'react':React,'react/jsx-runtime':require('react/jsx-runtime'),'next-auth/react':{useSession:session}},motionCache=new Map();const motion=new Proxy({},{get:(_,tag)=>{if(!motionCache.has(tag))motionCache.set(tag,React.forwardRef(function({children,initial,animate,exit,transition,whileHover,whileTap,...p},ref){return React.createElement(tag,{...p,ref},children)}));return motionCache.get(tag)}});
const mocks={...shared,'lucide-react':new Proxy({},{get:()=>()=>null}),'framer-motion':{motion,AnimatePresence:({children})=>children},'react-hot-toast':{toast,Toaster:()=>null},'@/components/DashboardSidebar':{default:()=>null},'next/image':{default:({fill,priority,unoptimized,quality,fetchPriority,...p})=>React.createElement('img',p)},'@/lib/pricing':{HIGH_USAGE_CONTACT_URL:'https://example.invalid/contact'},'@/lib/banner-template-storage':{templateImageUrl:u=>u},'@/lib/banner/template-access':{getBannerTemplateTier:()=> 'FREE'},'@/components/banner/BannerLimitModal':{default:({isOpen,monthlyUsed,monthlyLimit})=>isOpen?React.createElement('div',{'data-limit':true},monthlyUsed+'/'+monthlyLimit):null},'@/components/banner/BannerQuotaNotice':{default:()=>null},'@/components/banner/useBannerQuota':{useBannerQuota:onLimit=>({check:async()=>true,refresh:async()=>null,acceptLimit(){},reportLimit:data=>onLimit({open:true,used:data?.usage?.monthlyUsed,limit:data?.usage?.monthlyLimit}),usage:{used:0,limit:150},checking:false,error:false})}};
mocks['@/lib/banner/use-request-fence']=load('src/lib/banner/use-request-fence.ts',{react:React});
const observations=[];const observe=(name,passed)=>{observations.push({name,passed});console.log((passed?'PASS ':'FAIL ')+name)};

try {
 for(const mode of ['guest','paid']){
  status=mode==='guest'?'unauthenticated':'authenticated';actor=mode==='guest'?'guest':'paid';plan=mode==='guest'?'FREE':'FREE';requests=[];notices=[];window.localStorage.clear();window.sessionStorage.clear();
  mocks['@/lib/banner/template-access'].getBannerTemplateTier=()=>mode==='guest'?'FREE':'PRO';
  const Page=load('src/app/(shell)/banner/dashboard/page.tsx',mocks).default;
  host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(()=>root.render(React.createElement(Page)));
  const locked=host.querySelector('.cursor-pointer.opacity-70');assert.ok(locked,'actual locked template card');await act(()=>props(locked).onClick());
  const modal=[...host.querySelectorAll('a')].filter(a=>a.closest('.fixed'));
  if(mode==='guest'){
    const login=modal.find(a=>a.textContent.trim()==='ログイン');assert.ok(login,'guest lock modal login');
    assert.equal(new URL(login.getAttribute('href'),'https://example.invalid').searchParams.get('callbackUrl'),'/banner/dashboard');
    assert.equal(modal.some(a=>a.textContent.trim()==='プランを見る'),false);
  }else{
    assert.ok(modal.some(a=>a.textContent.trim()==='プランを見る'&&a.getAttribute('href')==='/banner/dashboard/plan'),'paid modal plan branch');
    assert.equal(modal.some(a=>a.textContent.trim()==='ログイン'),false);
  }
  assert.equal(requests.length,0,'template click cannot generate');
  const close=[...host.querySelectorAll('button')].find(e=>e.textContent.trim()==='閉じる'&&e.closest('.fixed'));assert.ok(close);await act(()=>props(close).onClick());
  assert.equal([...host.querySelectorAll('a')].some(a=>a.closest('.fixed')&&a.textContent.trim()==='ログイン'),false);
  console.log('PASS actual Banner dashboard '+mode+' locked-template modal destination, close, zero generation');
  await act(()=>root.unmount());host.remove();root=null;
 }
} finally {if(root)await act(()=>root.unmount());for(const id of timers)clearTimeout(id);for(const id of intervals)clearInterval(id);dom.window.close()}

}
async function checkRoot(){

const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react'),assert=require('node:assert/strict'),root=path.resolve(__dirname,'../..');
let session=null,uiNext=false;const mocks={
 'next-auth':{getServerSession:async()=>session},'@/lib/auth':{authOptions:{}},
 'next/navigation':{redirect:href=>{throw Object.assign(new Error('REDIRECT'),{href})}},
 '@/lib/ui-next':{isUiNext:async()=>uiNext},
 './landing/page':{__esModule:true,default:()=>React.createElement('main',{'data-kind':'banner-lp'})},
 './dashboard/page':{__esModule:true,default:()=>React.createElement('main',{'data-kind':'banner-work'})},
};const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'src/app/(shell)/banner/page.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:id=>{if(id==='react'||id==='react/jsx-runtime')return require(id);if(id in mocks)return mocks[id];throw Error('Unmocked '+id)},console},{filename:'banner/page.tsx'});
const page=exports.default,render=require('react-dom/server').renderToStaticMarkup;
assert.match(render(await page()),/data-kind="banner-lp"/);session={user:{id:'actor'}};assert.match(render(await page()),/data-kind="banner-work"/);uiNext=true;await assert.rejects(page(),e=>e.href==='/banner/dashboard');
console.log('PASS Banner root guest LP, signed-in legacy work, signed-in uiNext redirect unchanged');

}
(async()=>{await checkUrl();await checkDashboard();await checkRoot();console.log(JSON.stringify({passed:6,scope:'Actual Banner URL and dashboard components with synthetic session/templates/decorative dependencies, actual Banner root decision. No OAuth/provider/DB/network writes.'}))})().catch(e=>{console.error(e);process.exitCode=1});
