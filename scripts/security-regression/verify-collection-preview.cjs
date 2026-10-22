process.env.NODE_ENV = 'test'
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict')
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),ts=require('typescript')
const root=path.resolve(process.env.DOYA_TEST_ROOT||path.resolve(__dirname,'../..')),overlay=process.env.DOYA_TEST_BASELINE,sources=new Map(),cases=[]
const env={NODE_ENV:'development',DOYA_POWER_ROLLOUT:'preview'}, cache=new Map();let actor='alpha',authCalls=0
function AppShell({children,userName,initialRecent}){return React.createElement('section',{'data-sample-shell':true,'data-user':userName,'data-recent':JSON.stringify(initialRecent??null)},children)}
const empty=()=>({tools:{},quotesSent:{count:0,firstAt:null},invoicesIssued:{count:0,firstAt:null},paymentsRecorded:{count:0,firstAt:null},cleanBillingMonths:[],articlesDone:{count:0,firstAt:null},dealsWon:{count:0,firstAt:null}})
const mocks={
 react:React,'react/jsx-runtime':require('react/jsx-runtime'),
 'next/navigation':{notFound:()=>{throw Error('SYNTHETIC_NOT_FOUND')},usePathname:()=>'/home/collection/preview'},
 'next-auth/react':{useSession:()=>{authCalls++;return actor?{status:'authenticated',data:{user:{id:actor}}}:{status:'unauthenticated',data:null}}},
 'next/link':{__esModule:true,default:({children})=>children},'lucide-react':{Zap:()=>null},'@/components/ds/cost-badge':{CostBadge:()=>null},'./power.module.css':{__esModule:true,default:{}},
 './UiNextBadge':{__esModule:true,default:()=>null},'./ShellVitals':{__esModule:true,default:()=>null},
 './AppShell':{__esModule:true,default:AppShell},'@/components/shell/AppShell':{__esModule:true,default:AppShell},
 '@/components/shell/tools':{shellGroups:()=>[]},'@/lib/collection/catalog':{buildCatalog:()=>[]},'@/lib/collection/badges':{evaluateBadges:f=>[{count:f.quotesSent.count}]},'@/lib/collection/types':{emptyFacts:empty},
 '@/components/collection/CollectionView':{__esModule:true,default:p=>React.createElement('article',{'data-sample-data':JSON.stringify(p)})},
}
function load(f){
 if(cache.has(f))return cache.get(f)
 const local=overlay&&path.join(overlay,f),p=local&&fs.existsSync(local)?local:path.join(root,f),bytes=fs.readFileSync(p);sources.set(f,crypto.createHash('sha256').update(bytes).digest('hex'))
 const out=ts.transpileModule(bytes.toString(),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},reportDiagnostics:true});assert.equal(out.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,f)
 const exports={};cache.set(f,exports)
 vm.runInNewContext(out.outputText,{exports,process:{env},console,window:{},require:n=>{
  if(n in mocks)return mocks[n]
  assert(n.startsWith('@/')||n.startsWith('.'),'Forbidden dependency '+n)
  const stem=n.startsWith('@/')?'src/'+n.slice(2):path.posix.normalize(path.posix.join(path.posix.dirname(f),n))
  const file=[stem+'.ts',stem+'.tsx'].find(p=>fs.existsSync(path.join(root,p))||(overlay&&fs.existsSync(path.join(overlay,p))))
  assert(file,'Missing actual source '+n);return load(file)
 }},{filename:f});return exports
}
async function check(name,fn){await fn();cases.push(name)}
;(async()=>{
 const frame=load('src/app/(shell)/home/collection/preview/PreviewFrame.tsx').default,page=load('src/app/(shell)/home/collection/preview/page.tsx').default
 const ui=load('src/components/shell/ui-next-context.tsx'),company=load('src/components/shell/company-context.tsx'),flag=load('src/components/doya-power/doya-power-context.tsx'),power=load('src/components/shell/power.tsx'),registry=load('src/components/shell/registry.ts'),Gate=load('src/components/shell/ShellGate.tsx').default
 let observed;function Probe(){observed={mode:ui.useUiNextMode(),company:company.useAccountCompany()??null,href:ui.useToolHref()('/sfa'),flag:flag.useDoyaPower(),power:React.useContext(power.ShellPowerContext)};return React.createElement('output',null,JSON.stringify(observed))}
 const neutral=()=>assert.deepEqual(JSON.parse(JSON.stringify(observed)),{mode:'preview',company:null,href:'/sfa',flag:false,power:{balance:null,costs:{}}})
 const poison=child=>React.createElement(ui.UiNextContext.Provider,{value:'all'},React.createElement(company.AccountCompanyContext.Provider,{value:{name:'PRIVATE_COMPANY'}},React.createElement(ui.ShellToolHrefsContext.Provider,{value:{sfa:'/sfa/PRIVATE_ORG'}},React.createElement(flag.DoyaPowerContext.Provider,{value:true},React.createElement(power.ShellPowerProvider,{value:{balance:{remaining:999,limit:999},costs:{PRIVATE:9}}},child)))))
 await check('sample subtree resets poisoned private contexts without session reads',()=>{const before=authCalls,html=renderToStaticMarkup(poison(React.createElement(frame,null,React.createElement(Probe))));assert.equal(authCalls,before);assert.match(html,/data-user="サンプル"/);assert(!html.includes('PRIVATE'));assert.match(html,/preview/);assert.match(html,/false/);neutral();assert.match(html,/data-recent="null"/);assert.equal((html.match(/data-sample-shell/g)||[]).length,1)})
 for(const signedIn of [true,false])await check('actual outer gate and registry compose one sample shell signedIn='+signedIn,()=>{actor=signedIn?'alpha':null;const html=renderToStaticMarkup(poison(React.createElement(Gate,{signedIn,serverActorId:actor,enabledIds:[],uiNext:'all',doyaPower:true,doyaPowerState:{balance:{remaining:999,limit:999},costs:{PRIVATE:9}},company:{name:'PRIVATE_COMPANY'},toolHrefs:{sfa:'/sfa/PRIVATE_ORG'},userName:'PRIVATE_USER',initialRecent:['PRIVATE']},React.createElement(frame,null,React.createElement(Probe)))));assert.equal((html.match(/data-sample-shell/g)||[]).length,1);assert(!html.includes('PRIVATE'));neutral();assert.match(html,/data-user="サンプル"/)})
 for(const [p,expected]of [['/home/collection/preview',false],['/home/collection',true],['/home/preview',false],['/home/collection/preview-other',true]])await check('actual registry '+p,()=>assert.equal(registry.shouldShowShell(p,{signedIn:true,enabledIds:[]}),expected))
 for(const prod of [false,true])for(const preview of [undefined,'1'])for(const rollout of [undefined,'unknown','off','preview','all'])await check('server 404 matrix '+[prod,preview,rollout].join('/'),async()=>{
  env.NODE_ENV=prod?'production':'development';if(preview===undefined)delete env.COLLECTION_PREVIEW;else env.COLLECTION_PREVIEW=preview;if(rollout===undefined)delete env.DOYA_POWER_ROLLOUT;else env.DOYA_POWER_ROLLOUT=rollout
  const allowed=(!prod||preview==='1')&&['preview','all'].includes(rollout)
  if(!allowed)await assert.rejects(()=>page({searchParams:Promise.resolve({})}),/SYNTHETIC_NOT_FOUND/)
  else{const element=await page({searchParams:Promise.resolve({})});assert.equal(element.type,frame);assert.equal(element.props.children.props.persistAreas,false)}
 })
 env.NODE_ENV='development';env.DOYA_POWER_ROLLOUT='preview'
 for(const state of ['sample','empty'])for(const areas of ['default','none'])await check('sample data '+state+'/'+areas,async()=>{const el=await page({searchParams:Promise.resolve({state,areas})}),p=el.props.children.props;assert.equal(p.persistAreas,false);assert.equal(p.initialAreas.length,areas==='none'?0:3);assert.equal(Object.keys(p.usage).length,state==='empty'?0:7);assert.equal(p.badges[0].count,state==='empty'?0:9)})
 for(const[f,h]of sources){const p=overlay&&fs.existsSync(path.join(overlay,f))?path.join(overlay,f):path.join(root,f);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),h,f)}
 console.log(JSON.stringify({passed:cases.length,failed:0,cases,sourceHashes:Object.fromEntries(sources),scope:'Actual server page/flag, PreviewFrame, registry, ShellGate and context providers. React SSR with synthetic auth, AppShell/CollectionView presentation and collection calculation stubs. No route-wide no-auth claim: parent layout reads and actual AppShell persistence remain outside this fixture. No actual browser or DB.'},null,2))
})().catch(e=>{console.error(e);process.exitCode=1})
