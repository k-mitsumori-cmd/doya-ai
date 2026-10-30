process.env.NODE_ENV='test';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
if (!process.env.DOYA_STUDIO_SCENARIO) {
  const results = [];
  for (const scenario of ['actor-switch', 'after-one-image', 'unmount', 'same-actor', 'normal', 'aba']) {
    const child = require('node:child_process').spawnSync(process.execPath, [__filename], {
      env: { ...process.env, DOYA_STUDIO_SCENARIO: scenario }, encoding: 'utf8', timeout: 60000,
    });
    if (child.error || child.status !== 0) {
      process.stderr.write(child.stdout || ''); process.stderr.write(child.stderr || '');
      if (child.error) console.error(child.error);
      process.exit(child.status || 1);
    }
    const record = child.stdout.split('\n').find(line => line.startsWith('{'));
    assert(record, 'Mounted case must report its observations');
    results.push(JSON.parse(record));
    console.log('PASS Tenjikai export scope: ' + scenario);
  }
  const report = { passed: results.length, cases: results, scope: 'Actual BoothStudio and export callbacks mounted in React StrictMode. Real engine/graphics, synthetic decorative children, quota, timers and browser downloads; no providers or real accounts.' };
  const out = path.resolve(__dirname, '../../docs/audits/2026-10-06-all-services-recheck/tenjikai-export-scope-mounted-results.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: results.length, scope: report.scope }));
  process.exit(0);
}
const root=path.resolve(__dirname,'../..'),req=createRequire(root+'/package.json'),React=req('react'),{JSDOM}=req('jsdom'),ts=req('typescript'),{load}=req(root+'/scripts/security-regression/load-typescript.cjs');
const dom=new JSDOM('<body><main></main></body>',{url:'https://synthetic.invalid/tenjikai/booth'});global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true;const {createRoot}=req('react-dom/client');
const engine=load('src/lib/tenjikai/engine.ts'),kit=load('src/lib/tenjikai/design-kit.ts'),fit=load('src/lib/tenjikai/image-fit.ts'),image=load('src/lib/tenjikai/imagegen.ts',{'./design-kit':kit,'./image-fit':fit}),graphics=load('src/lib/tenjikai/graphics.ts',{'./design-kit':kit,'./imagegen':image,'./image-fit':fit}),batch=load('src/lib/tenjikai/batch.ts');
let actor='A',seq=0;const downloads=[],revoked=[],timers=new Map(),Null=()=>null;dom.window.HTMLAnchorElement.prototype.click=function(){downloads.push({actor,name:this.download,href:this.href})};
const schedule=(fn,ms)=>{const id=++seq;timers.set(id,{fn,ms});return id};
const mocks={react:React,'react/jsx-runtime':req('react/jsx-runtime'),'framer-motion':{AnimatePresence:({children})=>children,motion:new Proxy({},{get:(_,name)=>({children})=>React.createElement(name,null,children)})},clsx:req('clsx'),'lucide-react':new Proxy({},{get:()=>Null}),
 '@/lib/tenjikai/engine':engine,'@/lib/tenjikai/graphics':graphics,'@/lib/tenjikai/imagegen':image,'@/lib/tenjikai/image-fit':fit,'@/lib/tenjikai/batch':batch,'@/lib/tenjikai/tokens':load('src/lib/tenjikai/tokens.ts'),
 '@/components/one-button/context':{useOneButton:()=>false},'@/components/one-button/OneButtonBar':{OneButtonBar:Null},'@/components/shell/power':{ShellCostBadge:Null},'@/components/shell/DoyaWorking':{__esModule:true,default:Null},
 './ui':{CountUp:({value})=>React.createElement('span',null,String(value)),Modal:({open,children})=>open?children:null,PageHeader:Null},
 './useImageGen':{useImageQuota:()=>({quota:{remaining:99},refresh:()=>{}}),isImageGenDisabled:()=>false,remainingLabel:()=>'',requestImages:()=>{throw Error('No provider request allowed')},IMAGEGEN_DISABLED_MESSAGE:'disabled'},
 '@/components/ds/next-step':{FlowSteps:Null,NextStepAction:({children,onClick,disabled})=>React.createElement('button',{onClick,disabled},children),NextStepBar:({action})=>React.createElement('section',null,action)},'next/image':{__esModule:true,default:Null}};
for(const name of ['IsoBooth','Booth3D','GraphicPlanner','ImageGenModal','EmptyState','BoothSizeInput','DesignKitStudio'])mocks['./'+name]={__esModule:true,default:Null};
const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(process.env.DOYA_STUDIO_DRAFT||root+'/src/components/tenjikai/BoothStudio.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports:exportsObject,require:n=>{if(n in mocks)return mocks[n];throw Error('Unmocked '+n)},console,window:dom.window,document:dom.window.document,Blob,AbortController,URL:{createObjectURL:()=>`blob:synthetic-${seq}`,revokeObjectURL:url=>revoked.push(url)},setTimeout:schedule,clearTimeout:id=>timers.delete(id)});
const Component=exportsObject.default,input=engine.SAMPLE_INPUT,generated=engine.mockGeneratedPlan(input),plans=engine.generateBoothPlans(input),panels=graphics.generateGraphicPlan(plans[0],generated.analysis),designKit=kit.deriveKit(generated.analysis),host=document.querySelector('main'),mounted=createRoot(host);
const act=fn=>React.act(async()=>{await fn();for(let i=0;i<3;i++)await new Promise(setImmediate)});
const props=id=>({plans,variant:'A',setVariant(){},input,analysis:generated.analysis,panelImages:Object.fromEntries(panels.map(p=>[p.id,'data:image/png;base64,'+Buffer.from(id+'-private-image').toString('base64')])),setPanelImages(){},kit:designKit,kitConfirmed:true,onKitChange(){},onKitConfirm(){},onKitReopen(){}});
(async()=>{await act(()=>mounted.render(React.createElement(React.StrictMode,null,React.createElement(Component,{key:'A',...props('A')}))));const button=[...host.querySelectorAll('button')].find(b=>b.textContent.trim()==='書き出す');assert(button,'Actual CSV/export action visible');await act(()=>button.click());assert.equal(downloads.length,1,'CSV completes before actor transition');assert([...timers.values()].some(t=>t.ms===250),'Image download is waiting');const scenario=process.env.DOYA_STUDIO_SCENARIO||'actor-switch';
if(scenario==='after-one-image'){const [id,t]=[...timers].find(([,t])=>t.ms===250);await act(()=>{timers.delete(id);t.fn()})}
const beforeTransitionCount=downloads.length;
if(scenario==='unmount'){actor='none';await act(()=>mounted.render(null))}
else if(scenario==='same-actor'){await act(()=>mounted.render(React.createElement(React.StrictMode,null,React.createElement(Component,{key:'A',...props('A')}))))}
else if(scenario!=='normal'){actor='B';await act(()=>mounted.render(React.createElement(React.StrictMode,null,React.createElement(Component,{key:'B',...props('B')}))));if(scenario==='aba'){actor='A';await act(()=>mounted.render(React.createElement(React.StrictMode,null,React.createElement(Component,{key:'A',...props('A2')}))))}}
const pendingAfterTransition=[...timers.values()].filter(t=>t.ms===250).length;const revokedAfterTransition=revoked.length;
for(let i=0;i<panels.length+2;i++){const pending=[...timers].filter(([,t])=>t.ms===250);if(!pending.length)break;await act(()=>{for(const[id,t]of pending){timers.delete(id);t.fn()}})}
const switched=!['normal','same-actor'].includes(scenario);const foreign=switched?downloads.slice(beforeTransitionCount).filter(d=>Buffer.from(d.href.split(',')[1]||'','base64').toString().includes('A-private-image')):[];if(!switched)assert.equal(downloads.length,panels.length+1,'Normal and same-actor exports retain all images');const result={mountedActualBoothStudio:true,strictMode:true,scenario,revokedAfterTransition,actorRemount:'A -> B',csvBeforeSwitch:1,pendingAfterTransition,downloads:downloads.length,lateForeignImages:foreign.length,totalPanels:panels.length,providerCalls:0,scope:'Actual parent component/export callback mounted. Decorative children and quota/network are synthetic. Actor key remount matches actual TenjikaiApp boundary; real auth/browser files not used.'};if(process.env.DOYA_STUDIO_RESULT)fs.writeFileSync(process.env.DOYA_STUDIO_RESULT,JSON.stringify(result,null,2));console.log(JSON.stringify(result));await act(()=>mounted.unmount());assert.equal(foreign.length,0,'Previous actor images must not download after the component is replaced');assert.equal(pendingAfterTransition,switched?0:1,'Retired mount must clear its pending image timer, same actor keeps its pending export');assert.equal(revokedAfterTransition,switched?1:0,'Retired mount releases its CSV Blob URL immediately');assert.equal(timers.size,0,'Final unmount must release all export timers');})().catch(e=>{console.error(e);process.exitCode=1});
