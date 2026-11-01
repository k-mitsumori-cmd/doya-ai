const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),React=require('react'),ts=require('typescript'),{renderToStaticMarkup}=require('react-dom/server');
const root=process.env.DOYA_TEST_BASELINE||path.resolve(__dirname,'../..');let pathname='',mode='development';
const fixture=()=>React.createElement('p',null,'Synthetic fixture');
const ToolFrame=({serviceId,children})=>React.createElement('section',{'data-tool-frame':serviceId},React.createElement('h1',null,serviceId),children);
function load(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:name=>{assert(name in mocks,'Unmocked '+name);return mocks[name]},process:{env:new Proxy({},{get:(_,key)=>key==='NODE_ENV'?mode:undefined})}},{filename:file});return exports}
const common={react:React,'react/jsx-runtime':require('react/jsx-runtime'),'next/navigation':{usePathname:()=>pathname,notFound:()=>{throw Error('SYNTHETIC_NOT_FOUND')}},'@/components/shell/ToolFrame':{default:ToolFrame,__esModule:true}};
const guest=load('src/lib/ui/guest-path.ts',{});
const popup=load('src/components/popup/PopupShellFrame.tsx',{...common,'./shell-context':load('src/components/popup/shell-context.ts',common)}).default;
const shanai=load('src/components/shanai/ShanaiFrame.tsx',{...common,'@/lib/ui/guest-path':guest,'./shell-context':load('src/components/shanai/shell-context.ts',common),'@/lib/shanai/nav':{SHANAI_NAV:[]}}).default;
const stub={default:fixture,__esModule:true},AppShell={default:({children})=>React.createElement('main',{'data-app-shell':true},children),__esModule:true};
const popupPage=load('src/app/(shell)/popup/dev/states/page.tsx',{...common,'@/lib/popup/dev-fixtures':{DETAIL:{},EDIT_SITE:{},POPUPS:[{}],SITES:[]},'@/components/shell/AppShell':AppShell,'@/components/popup/PopupShellFrame':{default:popup,__esModule:true},'@/lib/popup/nav':{POPUP_NAV:[]},'@/components/popup/ui':{ErrorState:fixture,ForbiddenState:fixture,ProcessingSteps:fixture,SkeletonDetail:fixture,SkeletonSiteCards:fixture},'../../Tool':stub,'../../sites/[id]/SiteDetailClient':stub,'../../edit/[id]/EditClient':stub}).default;
const shanaiPage=load('src/app/(shell)/shanai/dev/states/page.tsx',{...common,'@/components/shell/AppShell':AppShell,'@/components/shanai/ShanaiFrame':{default:shanai,__esModule:true},'@/components/shanai/ui':{ProgressSteps:fixture},'../../Tool':stub,'../../new/page':stub,'../../company/page':stub,'../../interviews/[id]/page':stub,'./DevRoot':{default:({children})=>children,LimitPreview:fixture,__esModule:true}}).default;
let passed=0;const count=html=>(html.match(/data-tool-frame=/g)||[]).length;
(async()=>{
 for(const[service,Frame,Page]of[['popup',popup,popupPage],['shanai',shanai,shanaiPage]]){
  pathname='/'+service+'/normal';let html=renderToStaticMarkup(React.createElement(Frame,{nav:[]},React.createElement(fixture)));assert.equal(count(html),1);passed++;
  pathname='/'+service+'/dev/states';
  const preview=await Page({searchParams:Promise.resolve({s:'forbidden',shell:'1'})});html=renderToStaticMarkup(React.createElement(Frame,{nav:[]},preview));assert.equal(count(html),1,'Authenticated parent plus explicit preview must render exactly one ToolFrame: '+service);assert(html.includes('Synthetic fixture'));passed++;
  const bare=await Page({searchParams:Promise.resolve({s:'forbidden',shell:'0'})});html=renderToStaticMarkup(React.createElement(Frame,{nav:[]},bare));assert.equal(count(html),0,'shell=0 must not inherit the parent frame');passed++;
  pathname='/'+service+'/development';html=renderToStaticMarkup(React.createElement(Frame,{nav:[]},React.createElement(fixture)));assert.equal(count(html),1,'Only /dev/ route segment is excluded');passed++;
  pathname=null;html=renderToStaticMarkup(React.createElement(Frame,{nav:[]},React.createElement(fixture)));assert.equal(count(html),1);passed++;
  mode='production';await assert.rejects(Page({searchParams:Promise.resolve({s:'forbidden',shell:'1'})}),/SYNTHETIC_NOT_FOUND/);mode='development';passed++;
 }
 pathname='/shanai/answer/synthetic';for(const preview of [false,true]){assert.equal(count(renderToStaticMarkup(React.createElement(shanai,{preview},React.createElement(fixture)))),0);passed++}
 console.log(JSON.stringify({passed,scope:'Actual popup/shanai Frame and async dev page functions with real shell contexts/guest-path; synthetic pathname/AppShell/ToolFrame/fixture leaves. No DB/auth/provider calls. Real-browser layout checked separately.'}));
})().catch(error=>{console.error(error);process.exitCode=1});
