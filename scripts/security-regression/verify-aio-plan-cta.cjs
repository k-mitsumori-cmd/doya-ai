const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const source=fs.readFileSync(path.resolve(__dirname,'../../src/components/aio/AioSidebar.tsx'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
const empty=()=>null,container=({children})=>React.createElement('div',null,children);let count=0;
for(const plan of [null,'FREE','LIGHT','PRO','ENTERPRISE','BASIC','STARTER','BUSINESS','BUNDLE'])for(const isMobile of [false,true]){
 const exports={}, session=plan?{user:{plan}}:null;
 const mocks={'@/lib/unified-plan':require('./load-typescript.cjs').load('src/lib/unified-plan.ts'),react:{...React,useState:v=>[v,()=>{}]},'next/link':({href,children})=>React.createElement('a',{href},children),'next/navigation':{usePathname:()=>'/aio/test'},'next-auth/react':{useSession:()=>({data:session,status:plan?'authenticated':'unauthenticated'}),signOut(){}},'lucide-react':{LayoutDashboard:empty,CreditCard:empty,Zap:empty,Eye:empty,ScanSearch:empty},'@/components/TrialCallout':{TrialInlineSuffix:()=>React.createElement('span',null,'TRIAL_MARKER')},'@/components/sidebar/themes':{aioTheme:{}},'@/components/sidebar':new Proxy({useSidebarState:()=>({isCollapsed:false,showLabel:true,toggle(){}}),SidebarShell:container},{get:(o,k)=>k in o?o[k]:empty}),'@/components/ToolSwitcherMenu':{ToolSwitcherMenu:empty}};
 vm.runInNewContext(compiled,{exports,require:n=>{if(n in mocks)return mocks[n];throw Error(n)}});const html=renderToStaticMarkup(React.createElement(exports.default,{isMobile,orgSlug:'test'}));const paid=plan&&!['FREE','LIGHT'].includes(plan);
 assert.ok(html.includes('href="/aio/pricing"'));
 if(paid){assert.ok(html.includes('プランを確認する'));assert.ok(!html.includes('プロにアップグレード')); assert.ok(!html.includes('TRIAL_MARKER'));assert.ok(!html.includes('→'));assert.ok(!html.includes('>UP<'));}
 else {assert.ok(html.includes('プロにアップグレード'));assert.ok(html.includes('TRIAL_MARKER'));}
 count++;console.log('PASS',plan||'GUEST',isMobile?'mobile':'desktop');
}
console.log(count+' rendered component checks passed');
