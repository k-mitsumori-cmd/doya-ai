process.env.DOYA_REFRESH_FIXED='1';
process.env.NODE_ENV='test';
const assert=require('node:assert/strict'),React=require('react'),{JSDOM}=require('jsdom');
const {load}=require('./load-typescript.cjs');
const dom=new JSDOM('<!doctype html><body></body>',{url:'https://example.invalid/banner/dashboard'});
global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=require('react-dom/client');
let used=3,quota,sidebarRequests=0;const tick=()=>new Promise(r=>setImmediate(r));
const useSession=()=>({status:'authenticated',data:{user:{id:'synthetic-alpha',plan:'FREE'}}});
const payload=()=>({signedIn:true,summary:{title:'生成したバナー',unit:'枚',total:used,planLabel:'無料',meters:[{label:'今月',used,limit:15}]}});
const browser={window,document,AbortController,console};
const hook=load('src/components/banner/useBannerQuota.ts',{'react':React,'next-auth/react':{useSession},'next/navigation':{usePathname:()=>window.location.pathname},'@/lib/banner-quota-response-client':{readBannerQuotaResponse:async()=>payload()}},browser);
const loadTsx=(file,mocks,globals)=>{const ts=require('typescript'),fs=require('fs'),vm=require('vm'),exports={};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;vm.runInNewContext(code,{exports,require:n=>{assert.ok(n in mocks,n);return mocks[n]},...globals});return exports};
const panel=loadTsx('src/components/sidebar/SidebarUsagePanel.tsx',{'react':React,'react/jsx-runtime':require('react/jsx-runtime'),'next-auth/react':{useSession},'next/navigation':{usePathname:()=>window.location.pathname},'@/lib/billing-response-client':{readBillingResponse:async()=>{sidebarRequests++;return{ok:true,data:payload()}}},'lucide-react':{Image:()=>null},'next/link':({children})=>React.createElement('a',null,children)},browser);
function View(){quota=hook.useBannerQuota(()=>{});return React.createElement(panel.SidebarUsagePanel,{service:'banner',show:true,...(process.env.DOYA_REFRESH_FIXED?{refreshEvent:'banner:usage-changed'}:{})})}
(async()=>{const container=document.createElement('div');document.body.append(container);const root=createRoot(container);const act=fn=>React.act(async()=>{await fn();await tick();await tick()});
try{await act(()=>root.render(React.createElement(View)));assert.ok(container.textContent.includes('3 / 15'));used=4;await act(()=>quota.refresh());assert.equal(quota.usage.used,4);const stale=container.textContent.includes('3 / 15');assert.equal(stale,!process.env.DOYA_REFRESH_FIXED);
if(process.env.DOYA_REFRESH_FIXED){assert.ok(container.textContent.includes('4 / 15'));const count=sidebarRequests;await act(()=>window.dispatchEvent(new window.CustomEvent('banner:usage-changed',{detail:{actor:'synthetic-other'}})));assert.equal(sidebarRequests,count);used=15;await act(()=>quota.acceptLimit({monthlyUsed:15,monthlyLimit:15}));assert.ok(container.textContent.includes('15 / 15'));}
console.log(JSON.stringify({status:process.env.DOYA_REFRESH_FIXED?'fixed':'reproduced',quotaUsed:quota.usage.used,sidebarStale:stale,sidebarRequests,scope:'Actual mounted quota hook and shared panel with current banner consumer props; synthetic successful quota refresh, not actual page generation or live account.'},null,2));
}finally{await act(()=>root.unmount());dom.window.close()}})().catch(e=>{console.error(e);process.exitCode=1});
