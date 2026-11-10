process.env.NODE_ENV='development';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),base=process.env.DOYA_ADMIN_GOOGLE_BASELINE||root,dep=n=>require(path.join(base,'node_modules',n)),React=dep('react'),ts=dep('typescript'),{JSDOM}=dep('jsdom'),hashes={},rows=[];
function compile(file,imports,extra={}){const b=fs.readFileSync(path.join(root,file));hashes[file]=crypto.createHash('sha256').update(b).digest('hex');const mod={exports:{}};vm.runInNewContext(ts.transpileModule(b.toString(),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{module:mod,exports:mod.exports,require:n=>{assert(Object.hasOwn(imports,n),'Unexpected import '+n);return imports[n]},console,...extra});return mod.exports}
const policy=compile('src/lib/admin-google-policy.ts',{}),allowed={user:{email:'member@surisuta.jp'}},external={user:{email:'member@example.com'}};
const cases=[
 {name:'password first then Google',google:null,status:401,body:{authenticated:false,googleRequired:true},prompt:true},
 {name:'external Google denied',google:external,status:401,body:{authenticated:false,googleRequired:true},prompt:true},
 {name:'stale allowed client cannot override server',google:allowed,status:401,body:{authenticated:false,googleRequired:true},prompt:true},
 {name:'both sessions admitted',google:allowed,status:200,body:{authenticated:true},child:true},
 {name:'uppercase exact domain admitted',google:{user:{email:'member@SURISUTA.JP'}},status:200,body:{authenticated:true},child:true},
 {name:'no admin cannot bypass with Google',google:allowed,status:401,body:{authenticated:false},redirect:true},
 {name:'server error cannot become Google stage',google:allowed,status:500,body:{authenticated:false,googleRequired:true},redirect:true},
 {name:'request failure closed',google:allowed,throws:true,redirect:true},
 {name:'client no Google despite server success',google:null,status:200,body:{authenticated:true},prompt:true},
 {name:'external client despite server success',google:external,status:200,body:{authenticated:true},prompt:true},
 {name:'Google loading hides children',google:allowed,googleStatus:'loading',status:200,body:{authenticated:true},loading:true},
 {name:'password login page stays accessible',google:null,path:'/admin/login',child:true,noFetch:true},
];
async function scenario(spec,strict){const dom=new JSDOM('<div id="root"></div>',{url:'https://synthetic.invalid'+(spec.path||'/admin/stats')}),win=dom.window,prior=new Map();let rootHandle,fetches=0;const redirects=[];
for(const [k,v] of Object.entries({window:win,document:win.document,navigator:win.navigator,HTMLElement:win.HTMLElement,Element:win.Element,IS_REACT_ACT_ENVIRONMENT:true})){prior.set(k,Object.getOwnPropertyDescriptor(global,k));Object.defineProperty(global,k,{value:v,writable:true,configurable:true})}
try{const router={push:x=>redirects.push(x)},imports={'react':React,'react/jsx-runtime':dep('react/jsx-runtime'),'next/navigation':{usePathname:()=>spec.path||'/admin/stats',useRouter:()=>router},'next-auth/react':{useSession:()=>({data:spec.google,status:spec.googleStatus||'authenticated'})},'@/lib/admin-google-policy':policy,'@/lib/use-navigation-submission':{useNavigationSubmission:()=>({busy:false,run:()=>{throw Error('Unexpected login transmission')}}),startGoogleSignIn:()=>{throw Error('Unexpected Google request')},switchGoogleAccount:()=>{throw Error('Unexpected Google request')}}};
const mod=compile('src/components/AdminAuthWrapper.tsx',imports,{AbortController,fetch:async(url,init)=>{assert.equal(url,'/api/admin/auth/session');assert.equal(init.credentials,'include');assert.equal(init.cache,'no-store');fetches++;if(spec.throws)throw Error('Synthetic network error');return new Response(JSON.stringify(spec.body),{status:spec.status})}}),{createRoot}=dep('react-dom/client');rootHandle=createRoot(document.getElementById('root'));let view=React.createElement(mod.AdminAuthWrapper,{},React.createElement('div',{id:'protected-child'},'Sensitive synthetic child'));
await React.act(async()=>rootHandle.render(strict?React.createElement(React.StrictMode,{},view):view));assert.equal(!!document.getElementById('protected-child'),!!spec.child);
if(spec.prompt){assert(document.body.textContent.includes('Google認証が必要です'));assert.equal(redirects.length,0,'Password session caused login redirect loop')}
if(spec.redirect)assert(redirects.length>0&&redirects.every(x=>x==='/admin/login'));
if(spec.loading)assert(document.body.textContent.includes('認証確認中'));
if(spec.noFetch)assert.equal(fetches,0);else assert(fetches>=1&&fetches<=(strict?2:1),'Repeated bootstrap request loop');
return{name:spec.name,strict,passed:true,fetches,redirects:redirects.length};
}finally{if(rootHandle)await React.act(async()=>rootHandle.unmount());win.close();for(const [k,d] of prior){if(d)Object.defineProperty(global,k,d);else delete global[k]}}}
(async()=>{for(const strict of [false,true])for(const spec of cases){try{rows.push(await scenario(spec,strict))}catch(e){rows.push({name:spec.name,strict,passed:false,error:e.message.slice(0,300)})}}
const report={checkedAt:new Date().toISOString(),cases:rows.length,failed:rows.filter(x=>!x.passed).length,rows,sourceHashes:hashes,productionRequests:0,providerRequests:0,credentialChanges:0,scope:'Actual AdminAuthWrapper and domain helper mounted in JSDOM; synthetic Google hook, cookies/session API response and Next router. Login loop/child disclosure checks in normal and StrictMode. Not native OAuth/CAPTCHA or real browser/DB acceptance.'};if(process.env.DOYA_ADMIN_GOOGLE_UI_RESULT)fs.writeFileSync(process.env.DOYA_ADMIN_GOOGLE_UI_RESULT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({cases:report.cases,failed:report.failed,failures:rows.filter(x=>!x.passed)}));if(report.failed)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1});
