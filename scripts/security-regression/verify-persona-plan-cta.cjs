const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const unified=require('./load-typescript.cjs').load('src/lib/unified-plan.ts');
const source=fs.readFileSync(path.resolve(__dirname,'../../src/components/PersonaSidebar.tsx'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
const empty=()=>null,container=({children})=>React.createElement('div',null,children);let count=0;
for(const plan of [null,'FREE','LIGHT','PRO','ENTERPRISE','BASIC','STARTER','BUSINESS','BUNDLE'])for(const isMobile of [false,true]){
 const exports={}, session=plan?{user:{plan,personaPlan:plan==='FREE'?'PRO':'FREE'}}:null;
 const mocks={'@/lib/unified-plan':unified,react:{...React,useState:v=>[v,()=>{}]},'next/link':({href,children})=>React.createElement('a',{href},children),'next/navigation':{usePathname:()=>'/persona'},'next-auth/react':{useSession:()=>({data:session,status:plan?'authenticated':'unauthenticated'}),signOut(){}},'lucide-react':{Clock:empty,Zap:empty,Target:empty},'@/components/TrialCallout':{TrialInlineSuffix:()=>React.createElement('span',null,'TRIAL_MARKER')},'@/components/sidebar/themes':{personaTheme:{}},'@/components/sidebar':new Proxy({useSidebarState:()=>({isCollapsed:false,showLabel:true,toggle(){}}),SidebarShell:container},{get:(o,k)=>k in o?o[k]:empty}),'@/components/ToolSwitcherMenu':{ToolSwitcherMenu:empty}};
 vm.runInNewContext(compiled,{exports,require:n=>{if(n in mocks)return mocks[n];throw Error(n)}});const html=renderToStaticMarkup(React.createElement(exports.default,{isMobile}));const paid=plan&&unified.isPaidPlan(plan);
 assert.ok(html.includes('href="/persona/pricing"'));
 if(paid){assert.ok(html.includes('プランを確認する'));assert.ok(html.includes('プラン確認'));assert.ok(!html.includes('を始める'));assert.ok(!html.includes('TRIAL_MARKER'));assert.ok(!html.includes('→'));assert.ok(!html.includes('>UP<'));}
 else {assert.ok(html.includes('PROを始める'));assert.ok(html.includes('TRIAL_MARKER'));}
 assert.ok(!html.includes('ライト'));assert.ok(!html.includes('¥2,980'));
 count++;console.log('PASS',plan||'GUEST',isMobile?'mobile':'desktop');
}
console.log(count+' rendered component checks passed');
