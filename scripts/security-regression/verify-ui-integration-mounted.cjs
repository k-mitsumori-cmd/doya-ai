'use strict'
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const crypto = require('node:crypto')
const { createRequire } = require('node:module')
const repo = path.resolve(process.env.DOYA_TEST_ROOT || path.resolve(__dirname, '../..'))
const candidate = process.env.DOYA_TEST_BASELINE || repo
const localRequire = createRequire(path.join(repo, 'package.json'))
const ts = localRequire('typescript')
const React = localRequire('react')
const { JSDOM } = localRequire('jsdom')
const dom = new JSDOM('<!doctype html><html><body></body></html>', {url:'https://example.invalid/hr/employees/new'})
Object.assign(global, { window:dom.window, document:dom.window.document,
  HTMLElement:dom.window.HTMLElement, Event:dom.window.Event, MouseEvent:dom.window.MouseEvent,
  IS_REACT_ACT_ENVIRONMENT:true })
dom.window.HTMLElement.prototype.scrollIntoView = () => {}
const { createRoot } = localRequire('react-dom/client')
const { renderToStaticMarkup } = localRequire('react-dom/server')
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const used = new Set(), results = []
const check = async (label, fn) => { await fn(); results.push(label) }
const pas = () => null
const div = ({children,...props}) => React.createElement('div',props,children)
const icon = () => React.createElement('i')
const motion = new Proxy({}, {get:(_,tag) => ({children,initial,animate,transition,whileHover,whileTap,...props})=>React.createElement(tag,{...props,...(animate?.width ? {'data-animate-width':animate.width} : {})},children)})
const presentation = { CountUp:({value,format})=>React.createElement('span',null,format(value)),
  PageHeader:({eyebrow,title,desc})=>React.createElement('header',null,eyebrow,title,desc),cardIn:()=>({}) }
const moduleCache = new Map()
function load(file,mocks,key='base') {
  file=path.resolve(file); const cacheKey=key+file; if(moduleCache.has(cacheKey)) return moduleCache.get(cacheKey)
  assert(fs.existsSync(file),`missing actual source ${file}`); used.add(file)
  const out={}; moduleCache.set(cacheKey,out)
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
  vm.runInNewContext(code,{exports:out,require:name=>{
    if(Object.prototype.hasOwnProperty.call(mocks,name))return mocks[name]
    if(name==='react')return React
    if(name==='react/jsx-runtime')return localRequire('react/jsx-runtime')
    const stem=name.startsWith('@/')?path.join(repo,'src',name.slice(2)):path.resolve(path.dirname(file),name)
    const found=[stem+'.ts',stem+'.tsx',stem+'.js',stem+'.cjs'].find(fs.existsSync)
    assert(found,`unmocked ${name} in ${file}`)
    return load(found,mocks,key)
  },console,window:dom.window,document:dom.window.document,AbortController,FormData:dom.window.FormData,FileReader:dom.window.FileReader,
  setTimeout,clearTimeout,requestAnimationFrame:cb=>setTimeout(cb,0),URL,TextEncoder,TextDecoder}, {filename:file})
  return out
}
function candidateFile(relative){const p=path.join(candidate,relative);return fs.existsSync(p)?p:path.join(repo,relative)}
function deferred(){let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j});return{promise,resolve,reject}}
async function mounted(Component, props){const host=document.createElement('div'); document.body.append(host);const root=createRoot(host)
  await React.act(async()=>root.render(React.createElement(Component,props)))
  return {host,root,render:async p=>React.act(async()=>root.render(React.createElement(Component,p))), close:async()=>{await React.act(async()=>root.unmount());host.remove()}}
}
async function expense(){
 let next=false, reduced=false, motionCalls=[], chart=[]
 const cash={months:['2026-10'],categories:['saas'],totals:{'2026-10':{amount:100}},cells:{saas:{'2026-10':{amount:100,estimated:40}}}}
 const mocks={'@/lib/expense/constants':{CATEGORY_LABEL:{saas:'SaaS'}},'@/components/ds/motion':{useInViewOnce:()=>{motionCalls.push('view');return{ref:()=>{},seen:true}},usePrefersReducedMotion:()=>{motionCalls.push('reduced');return reduced}},'@/components/shell/ui-next-context':{useUiNext:()=>{motionCalls.push('next');return next}},'@/components/ds/charts':{StackedColumnChart:p=>{chart.push(p);return React.createElement('div',{'data-chart':'columns'})}},'@/components/ds/chart-math':{formatCompactJa:n=>String(n),TONE_COLOR:{blue:'blue',pink:'pink',sky:'sky',yellow:'yellow',navy:'navy',cyan:'cyan',muted:'gray',blueDeep:'navy'}},'./ui':{formatYen:n=>`${n}円`}}
 const CashBars=load(candidateFile('src/components/expense/CashBars.tsx'),mocks,'expense').default
 const f=await mounted(CashBars,{cash,grow:false})
 try{
   await check('Expense legacy grow false to true preserves hooks and bar height',async()=>{assert.equal(f.host.querySelector('[title="2026-10 合計 100円"] .rounded-t-md').style.height,'160px'); const n=motionCalls.length;await f.render({cash,grow:true});assert.deepEqual(motionCalls.slice(n),['view','reduced','next']);assert.equal(f.host.querySelector('[title="2026-10 合計 100円"] .rounded-t-md').style.height,'160px')})
   await check('Expense uiNext new series 60 certain 40 estimated and back',async()=>{next=true;let n=motionCalls.length;await f.render({cash,grow:true});assert.deepEqual(motionCalls.slice(n),['view','reduced','next']);assert.deepEqual(chart.at(-1).series.map(s=>s.values[0]),[60,40]);assert.equal(f.host.querySelector('[data-chart="columns"]')!==null,true);next=false;await f.render({cash,grow:false});assert(f.host.querySelector('[title="2026-10 合計 100円"]'))})
   await check('Expense reduced motion retains nonanimated old bar',async()=>{reduced=true;await f.render({cash,grow:true});assert.equal(f.host.querySelector('[title="2026-10 合計 100円"] .rounded-t-md').style.height,'160px')})
 }finally{await f.close()}
}
async function tenjikai(){
 let next=false, charts=[]
 const engine={BUDGET_META:{booth:{label:'小間',color:'#123456'}},POSITION_LABEL:{corner:'角'},boothSize:()=>({venue:{name:'LIVE会場'},w:2,d:3}),daysUntil:()=>8,expectedVisitors:()=>77,man:n=>`${n}円`,yen:n=>`${n}円`}
 const mocks={'framer-motion':{motion},'lucide-react':new Proxy({},{get:()=>icon}),'./IsoBooth':{__esModule:true,default:pas},'./ui':presentation,'@/components/ds/charts':{StackedBar100:p=>{charts.push({kind:'stack',p});return React.createElement('div',{'data-chart':'stack'})},Bars:p=>{charts.push({kind:'bars',p});return React.createElement('div',{'data-chart':'bars'})},Donut:p=>{charts.push({kind:'donut',p});return React.createElement('div',{'data-chart':'donut'})}},'@/components/shell/ui-next-context':{useUiNext:()=>next},'@/lib/tenjikai/engine':engine,'@/lib/tenjikai/tokens':{ds:{track:'gray',sub:'gray',ink:'black'}},clsx:{clsx:(...x)=>x.filter(Boolean).join(' ')}}
 const Overview=load(candidateFile('src/components/tenjikai/Overview.tsx'),mocks,'tenjikai').default
 const Budget=load(candidateFile('src/components/tenjikai/BudgetPlanner.tsx'),mocks,'tenjikai').default
 const input={eventName:'Synthetic Event',eventStart:'2026-11-01',days:2,position:'corner',budgetYen:0}
 const analysis={brand:'Brand',category:'Category',valueProps:[],targets:[],tone:'plain',colors:{}}
 const plan={widthM:4,depthM:5,variant:'A',name:'Plan',concept:'Synthetic'}
 const common={input,analysis,plan,budget:[{category:'booth',amountYen:0,detail:'none'}],deadlines:[],creatives:[],go:()=>{}}
 await check('Tenjikai Overview saved workspace zero visitor versus live estimate in both UI modes',async()=>{
   for(next of [false,true]){
     const saved=renderToStaticMarkup(React.createElement(Overview,{...common,savedWorkspace:{venueSnapshot:{name:'SAVED会場'},projectedVisitors:0}}))
     const live=renderToStaticMarkup(React.createElement(Overview,common))
     assert(saved.includes('SAVED会場 / 角 / 4m × 5m'));assert(saved.includes('0人'))
     assert(!saved.includes('NaN'), `zero-budget Overview animation: ${(saved.match(/data-animate-width="[^"]+"/)||[])[0]}`)
     if(!next)assert(saved.includes('data-animate-width="0%"'))
     assert(live.includes('LIVE会場 / 角 / 2m × 3m'));assert(live.includes('77人'))
     if(next)assert(charts.some(c=>c.kind==='stack'))
   }
 })
 await check('Tenjikai Overview positive budget retains 25 percent legacy ratio',async()=>{
   next=false
   const html=renderToStaticMarkup(React.createElement(Overview,{...common,input:{...input,budgetYen:100},budget:[{category:'booth',amountYen:25,detail:'none'}]}))
   assert(html.includes('data-animate-width="25%"'))
 })
 await check('Tenjikai BudgetPlanner zero budget renders old and next safely',async()=>{
   for(next of [false,true]){
     const html=renderToStaticMarkup(React.createElement(Budget,{input,setInput:()=>{},budget:common.budget}))
     assert(!html.includes('NaN')); assert(html.includes('予算シミュレーター'))
     if(next){assert(charts.some(c=>c.kind==='donut'));assert(charts.some(c=>c.kind==='bars'))}
     else assert(html.includes('予算内訳の円グラフ'))
   }
 })
}
async function hr(){
 let next=false,current=true,requests=[],pushes=[],errors=[],successes=[],response=()=>({status:200,data:{employee:{id:'e1'}}})
 const orgScope={isCurrent:()=>current,request:async()=>{throw Error('unexpected direct org request')}}
 const mocks={'@/components/hr/ui-next':{PageTitle:({children})=>React.createElement('h1',null,children),useToolUiNext:()=>next},'@/components/ds':{Button:({children,href})=>React.createElement('a',{href},children),ErrorNotice:({what})=>React.createElement('p',{role:'alert'},what)},'@/components/hr/HrLoadError':{hrErrorKind:status=>status===403?'forbidden':status===401?'login':'other'},'@/components/hr/HrAuthenticatedScope':{__esModule:true,default:({children})=>children('synthetic-actor')},'@/components/hr/DepartmentListState':{__esModule:true,default:pas},'@/lib/hr/use-department-list':{useHrDepartmentList:()=>({status:'ready',rows:[],error:null,retry:()=>{}})},'@/components/hr/HrOrganizationScope':{useHrOrganizationRequest:()=>orgScope},'react-hot-toast':{__esModule:true,default:{error:x=>errors.push(x),success:x=>successes.push(x)}},'next/navigation':{useRouter:()=>({push:x=>pushes.push(x),back:()=>{}})},'@/lib/hr/department-settings-client':{readDepartmentSettingsResponse:async(url,init,signal)=>{requests.push({url,signal});return response(url,init,signal)}},'next/link':{__esModule:true,default:({href,children})=>React.createElement('a',{href},children)},'framer-motion':{motion}}
 const NewPage=load(candidateFile('src/app/(shell)/hr/employees/new/page.tsx'),mocks,'hr').default
 const f=await mounted(NewPage,{})
 try{
   await check('HR all three exit buttons current, then retired callbacks blocked',async()=>{
     const buttons=[...f.host.querySelectorAll('button')].filter(b=>/従業員一覧に戻る|キャンセル/.test(b.textContent))
     assert.equal(buttons.length,3)
     for(const b of buttons)await React.act(async()=>b.click())
     assert.deepEqual(pushes,['/hr/employees','/hr/employees','/hr/employees'])
     current=false;for(const b of buttons)await React.act(async()=>b.click());assert.equal(pushes.length,3);current=true
   })
   await check('HR uiNext required errors are field-bound and do not POST',async()=>{
     next=true;await f.render({});const form=f.host.querySelector('form');await React.act(async()=>form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})))
     assert.equal(requests.length,0);assert.equal(f.host.querySelector('input[name="lastName"]').getAttribute('aria-invalid'),'true');assert.equal(f.host.querySelector('input[name="firstName"]').getAttribute('aria-invalid'),'true');assert(f.host.textContent.includes('姓を入力してください。'))
   })
   await check('HR uiNext definite 403 keeps entered names and shows bounded form error',async()=>{
     const set=(name,value)=>{const input=f.host.querySelector(`input[name="${name}"]`);Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}))}
     await React.act(async()=>{set('lastName','山田');set('firstName','太郎')})
     response=()=>({status:403,data:{code:'HR_BILLING_OWNER_REQUIRED',error:'Raw private detail'}})
     await React.act(async()=>{f.host.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await Promise.resolve()})
     assert.equal(requests.length,1);assert(f.host.textContent.includes('従業員を登録する権限がありません。'))
     assert(!f.host.textContent.includes('Raw private detail'))
     assert.equal(f.host.querySelector('input[name="lastName"]').value,'山田')
   })
   await check('HR uiNext pending preserves names and disables submit; retired result causes no route or toast',async()=>{
     const set=(name,value)=>{const input=f.host.querySelector(`input[name="${name}"]`);Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}))}
     await React.act(async()=>{set('lastName','山田');set('firstName','太郎')})
     const last=f.host.querySelector('input[name="lastName"]');assert.equal(last.value,'山田')
     const d=deferred();response=()=>d.promise
     await React.act(async()=>{f.host.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await Promise.resolve()})
     assert.equal(requests.length,2);assert(f.host.textContent.includes('保存中...'));assert.equal(f.host.querySelector('input[name="lastName"]').value,'山田')
     const count=pushes.length,toastCount=successes.length+errors.length;current=false
     await React.act(async()=>{d.resolve({status:200,data:{employee:{id:'e1'}}});await Promise.resolve()})
     assert.equal(pushes.length,count);assert.equal(successes.length+errors.length,toastCount)
   })
 }finally{await f.close()}
}
;(async()=>{await expense();await tenjikai();await hr();const sourceHashes=Object.fromEntries([...used].sort().map(f=>[f.startsWith(candidate)?path.relative(candidate,f):path.relative(repo,f),sha(f)]));const result={checkedAt:new Date().toISOString(),passed:results.length,cases:results,sourceHashes,scope:'Actual Expense/Tenjikai/HR components, actual HR page-lifetime hook, React mounted/SSR with synthetic data. Presentation charts/icons, HR actor/departments/transport mocked. No actual chart renderer, auth, provider, DB, browser, network, or full type/build/security gates.'};console.log(JSON.stringify(result,null,2));dom.window.close()})().catch(e=>{console.error(e.stack||e);dom.window.close();process.exitCode=1})
