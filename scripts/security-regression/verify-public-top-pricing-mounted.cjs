'use strict';
process.env.NODE_ENV='test';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=process.cwd(),base=process.env.PUBLIC_TOP_PRICING_BASELINE||root,dep=n=>require(path.join(base,'node_modules',n));
const React=dep('react'),{JSDOM}=dep('jsdom'),ts=dep('typescript');
const dom=new JSDOM('<body></body>',{url:'https://synthetic.invalid/'});global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=dep('react-dom/client'),{renderToStaticMarkup}=dep('react-dom/server');
let modules,sourceHashes={},actor,status,plan,serverUser,rollout,serverReads,handler,requests,container,reactRoot;const results=[];
const componentFile='src/components/lp/renewal/Renewal.tsx';
const unused={'@/lib/services':{SERVICES:[],HIDDEN_SERVICE_IDS:new Set(),getListedServices:()=>[]},'@/components/shell/tools':{SHELL_GROUPS:[]},'./ProductPreview':{},'./HeroMotion':{MotionContext:React.createContext(false)},'./OperationDemo':{DEMOS:{}},'./ServiceCinematicHero':{},'./cinematic-scenes':{CINEMATIC_SCENES:{}},'./OpeningCurtain':{OPENING_COPY:{}},'./renewal.css':{},'./hero-motion.css':{}};
function load(file){if(modules.has(file))return modules.get(file);const preferred=file===componentFile&&process.env.PUBLIC_TOP_PRICING_COMPONENT_SOURCE?process.env.PUBLIC_TOP_PRICING_COMPONENT_SOURCE:path.join(root,file);const full=fs.existsSync(preferred)?preferred:path.join(base,file);const bytes=fs.readFileSync(full);sourceHashes[file]=crypto.createHash('sha256').update(bytes).digest('hex');const exports={};modules.set(file,exports);const js=ts.transpileModule(bytes.toString(),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;vm.runInNewContext(js,{exports,require:n=>{
 if(n==='react'||n==='react/jsx-runtime')return dep(n);
 if(n==='next/link')return{__esModule:true,default:({href,children,...props})=>React.createElement('a',{href,...props},children)};
 if(n==='next/image')return{__esModule:true,default:()=>null};
 if(n==='lucide-react')return Object.fromEntries(['ArrowRight','Check','ChevronDown','FileText','Layers','Play','Pause','Sparkles','MousePointer2','ShieldCheck'].map(k=>[k,()=>React.createElement('svg',{'aria-hidden':true})]));
 if(n==='next-auth/react')return{useSession:()=>({status,data:status==='unauthenticated'?null:{user:{id:actor,email:actor+'@synthetic.invalid',plan}}})};
 if(n==='@/components/pricing/useNewPricing')return load('src/components/pricing/useNewPricing.ts');
 if(n==='@/lib/unified-plan')return load('src/lib/unified-plan.ts');
 if(n==='@/lib/pricing-v2/plans')return load('src/lib/pricing-v2/plans.ts');
 if(n==='next/server')return{NextResponse:{json:(data,init)=>Response.json(data,init)}};
 if(n==='next-auth')return{getServerSession:async()=>status==='unauthenticated'?null:{user:{email:actor+'@synthetic.invalid'}}};
 if(n==='@/lib/auth')return{authOptions:{synthetic:true}};
 if(n==='@/lib/pricing-v2/rollout'||n==='./rollout')return{isNewPricingEnabledFor:()=>rollout};
 if(n==='@/lib/prisma')return{prisma:{user:{findUnique:async args=>{serverReads++;assert.equal(args.where.email,actor+'@synthetic.invalid');return serverUser}}}};
 if(n==='@/lib/pricing-v2/view.server')return load('src/lib/pricing-v2/view.server.ts');
 if(n==='./view')return load('src/lib/pricing-v2/view.ts');
 if(n==='./prices')return{newPricingPriceIds:()=>new Set(['price_team_synthetic'])};
 if(Object.hasOwn(unused,n))return unused[n];throw Error('Unexpected import '+n);
 },fetch:async(url,options)=>{assert.equal(url,'/api/pricing/status');assert.equal(options.cache,'no-store');requests.push({url,cache:options.cache});return handler();},Response,URL,console,window:dom.window,document:dom.window.document,process:{env:{NODE_ENV:'test'}}},{filename:file});return exports;}
function deferred(){let resolve;return{promise:new Promise(r=>{resolve=r}),resolve:v=>resolve(v)}}
async function act(fn){await React.act(async()=>{await fn();await new Promise(setImmediate)})}
function render(){reactRoot.render(React.createElement(React.StrictMode,null,React.createElement(load(componentFile).PriceSummary)))}
function common(){const link=container.querySelector('a');assert.equal(link.getAttribute('href'),'/pricing');assert.match(link.textContent,/料金・利用枠を確認する/)}
function neutral(){common();assert(!container.textContent.includes('9,980'));assert(!container.textContent.includes('14,058'));assert.equal(container.querySelector('strong').textContent,'—')}
function legacy(){common();assert.match(container.textContent,/¥9,980/);assert(!container.textContent.includes('14,058'));assert.match(container.textContent,/プロプラン/)}
function team(){common();assert.match(container.textContent,/¥14,058〜/);assert(!container.textContent.includes('9,980'));assert.match(container.textContent,/チーム \/ 1人利用時の月額（税込）/);assert.match(container.textContent,/会社の基本料と1人分/);assert.match(container.textContent,/人数により変わります/);assert.match(container.textContent,/フリーは3人まで無料/)}
async function test(name,fn){modules=new Map();actor='a';status='authenticated';plan='FREE';serverUser=null;rollout=true;serverReads=0;requests=[];container=dom.window.document.createElement('div');dom.window.document.body.appendChild(container);reactRoot=createRoot(container);try{await fn();results.push({name,passed:true})}finally{await act(()=>reactRoot.unmount());container.remove()}}
const timeout=setTimeout(()=>{console.error('Public top pricing regression exceeded deadline');process.exit(1)},45000);
(async()=>{
 await test('server rendering never publishes an unclassified legacy price',async()=>{const html=renderToStaticMarkup(React.createElement(load(componentFile).PriceSummary));assert(!html.includes('9,980'));assert(!html.includes('14,058'));assert(html.includes('/pricing'))});
 await test('unresolved request is neutral under StrictMode and coalesces reads',async()=>{handler=()=>deferred().promise;await act(render);neutral();assert.equal(requests.length,1)});
 for(const [name,body,expected] of [['new',{newPricing:true,pricingView:'new'},team],['team',{newPricing:true,pricingView:'team'},team],['legacy',{newPricing:true,pricingView:'legacy'},legacy],['off',{newPricing:false,pricingView:'current'},legacy]])await test('explicit canonical '+name,async()=>{handler=async()=>Response.json(body);await act(render);expected();assert.equal(requests.length,1)});
 for(const [name,p,price,expected] of [['legacy PRO','PRO','price_old_synthetic',legacy],['manual PRO','PRO',null,legacy],['TEAM PRO','PRO','price_team_synthetic',team],['FREE','FREE',null,team]])await test('actual GET and contract resolver '+name,async()=>{plan=p;serverUser={plan:p,stripePriceId:price};handler=()=>load('src/app/api/pricing/status/route.ts').GET();await act(render);expected();assert.equal(serverReads,1)});
 await test('anonymous actual GET is new with no account DB read',async()=>{status='unauthenticated';handler=()=>load('src/app/api/pricing/status/route.ts').GET();await act(render);team();assert.equal(serverReads,0)});
 await test('actual rollout off keeps legacy with no contract DB read',async()=>{rollout=false;handler=()=>load('src/app/api/pricing/status/route.ts').GET();await act(render);legacy();assert.equal(serverReads,0)});
 for(const [name,fn] of [['HTTP503',()=>Response.json({newPricing:false},{status:503})],['invalid JSON',()=>new Response('not-json')],['missing verdict',()=>Response.json({newPricing:true})],['unavailable verdict',()=>Response.json({newPricing:true,pricingView:'current'})],['string boolean',()=>Response.json({newPricing:'false'})],['inconsistent legacy',()=>Response.json({newPricing:false,pricingView:'legacy'})]])await test(name+' never falls back to legacy price',async()=>{handler=async()=>fn();await act(render);neutral()});
 await test('network failure stays neutral',async()=>{handler=async()=>{throw Error('Synthetic offline')};await act(render);neutral()});
 await test('late old legacy response cannot overwrite a new identity verdict',async()=>{const old=deferred();let n=0;handler=()=>++n===1?old.promise:Promise.resolve(Response.json({newPricing:true,pricingView:'new'}));await act(render);neutral();actor='b';await act(render);team();await act(()=>old.resolve(Response.json({newPricing:true,pricingView:'legacy'})));team();assert.equal(requests.length,2)});
 await test('old resolved legacy price clears while next identity is unresolved',async()=>{const next=deferred();let n=0;handler=()=>++n===1?Promise.resolve(Response.json({newPricing:true,pricingView:'legacy'})):next.promise;await act(render);legacy();actor='b';await act(render);neutral();await act(()=>next.resolve(Response.json({newPricing:true,pricingView:'team'})));team()});
 await test('logout clears old legacy price before anonymous resolution',async()=>{const next=deferred();let n=0;handler=()=>++n===1?Promise.resolve(Response.json({newPricing:true,pricingView:'legacy'})):next.promise;await act(render);legacy();status='unauthenticated';await act(render);neutral();await act(()=>next.resolve(Response.json({newPricing:true,pricingView:'new'})));team()});
 await test('same PRO tier remount rechecks a legacy-to-team contract change',async()=>{plan='PRO';serverUser={plan:'PRO',stripePriceId:'price_old_synthetic'};handler=()=>load('src/app/api/pricing/status/route.ts').GET();await act(render);legacy();await act(()=>reactRoot.unmount());reactRoot=createRoot(container);serverUser={plan:'PRO',stripePriceId:'price_team_synthetic'};await act(render);team();assert.equal(serverReads,2)});
 const report={marker:'public-top-pricing-mounted',checkedAt:new Date().toISOString(),conditions:results.length,passed:results.length,results,sourceHashes,productionApplied:false,providerRequests:0,productionWrites:0,scope:'Actual full PriceSummary module, pricing hook, plans table and canonical GET/resolver in React StrictMode/JSDOM. Session/Prisma/rollout/configured price IDs and unrelated presentation imports are synthetic. No actual OAuth, Stripe, layout or native-browser acceptance.'};if(process.env.PUBLIC_TOP_PRICING_RESULT)fs.writeFileSync(process.env.PUBLIC_TOP_PRICING_RESULT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({marker:report.marker,conditions:report.conditions,passed:report.passed,sourceHashes}));
})().catch(e=>{console.error(e.stack);process.exitCode=1}).finally(()=>{clearTimeout(timeout);dom.window.close()});
