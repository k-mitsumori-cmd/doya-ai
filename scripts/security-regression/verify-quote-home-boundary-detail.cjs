// Actual Home summary -> actual Quote Boundary -> actual detail hook/request/parser -> GET route.
// Synthetic session, membership read and Prisma. No network, DB, writes or production.
process.env.NODE_ENV='test'
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict')
const root=path.resolve(__dirname,'../..'), req=Module.createRequire(path.join(root,'package.json'))
const React=req('react'),ts=req('typescript'),{JSDOM}=req('jsdom')
const dom=new JSDOM('<main id="root"></main>',{url:'https://example.invalid/home'})
global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true
const {createRoot}=req('react-dom/client'),cache=new Map(),reads=[],writes=[]
let authStatus='authenticated', mounted=0, pendingWrite=null, pendingIssuer=null, membershipFailures=0
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return{promise,resolve}}
const doc={id:'docA',revision:'a'.repeat(64),quoteNo:'QA',title:'A document',status:'draft',clientCompany:'A customer',clientDept:null,clientPerson:null,issueDate:'2026-10-01T00:00:00Z',expiryDate:'2026-10-31T00:00:00Z',paymentTerms:null,deliveryTerms:null,notes:null,discountType:null,discountValue:0,totalExclTax:100,taxAmount:10,totalInclTax:110,lineItems:[{id:'lineA',itemName:'A item',spec:null,qty:1,unit:'unit',unitPrice:100,taxRate:10,priceSource:'manual',sourceRef:null,rangeMin:null,rangeMax:null}],organizationId:'orgA'}
const prisma=new Proxy({}, {get:(_,model)=>new Proxy({}, {get:(_,method)=>async args=>{
 if(!['findFirst','findUnique','findMany','count'].includes(method)){writes.push({model,method});throw Error('Write forbidden')}
 if(model==='user')return{name:'Synthetic',email:null,plan:'FREE',stripeCurrentPeriodEnd:null}
 if(model==='quoteMember')return {organizationId:'orgA',role:'owner',organization:{id:'orgA',name:'A',slug:'A'}}
 if(model==='quoteDocument'&&method==='findMany')return args.where.expiryDate?[{id:'docA',title:'A document',expiryDate:new Date(doc.expiryDate)}]:[]
 if(model==='quoteDocument'&&method==='findFirst'){reads.push(args.where);return args.where.id==='docA'&&args.where.organizationId==='orgA'?doc:null}
 return method==='findMany'?[]:method==='count'?0:null
}})})
const boundaryReads=[]
const organizations=['A','B'].map(slug=>({id:'org'+slug,slug,name:slug,role:'owner'}))
const router={replace:()=>{},push:()=>{}}
const recovery={manager:{inspectStored(){}},snapshot:{phase:'idle',handle:null}}
const selectedFromUrl=(raw,stored)=>{const parsed=load('src/lib/organization-workspace-selection.ts').organizationSelection(raw);return parsed.kind==='absent'&&stored?{kind:'selected',slug:stored}:parsed}
const mocks={
 '@/lib/prisma':{prisma},'next/server':{NextResponse:Response},
 'react':React,'react/jsx-runtime':req('react/jsx-runtime'),
 'next/link':{__esModule:true,default:({href,children,...props})=>React.createElement('a',{...props,href},children)},
 'next/navigation':{usePathname:()=>new URL(window.location.href).pathname,useSearchParams:()=>new URLSearchParams(new URL(window.location.href).search),useRouter:()=>router},
 'next-auth/react':{useSession:()=>({status:authStatus,data:authStatus==='authenticated'?{user:{id:'actor'}}:null})},
 '@/components/org/OrgSwitcher':{getSelectedOrg:()=>window.localStorage.getItem('doya.quote.org'),selectOrganization:(_service,slug)=>window.localStorage.setItem('doya.quote.org',slug)},
 '@/lib/ui/guest-path':{isGuestPath:()=>false},
 '@/lib/organization-workspace-client':{selectedWorkspaceFromUrl:selectedFromUrl,WorkspaceReadError:class WorkspaceReadError extends Error{},readOrganizationWorkspace:async(actor,selected,signal,service)=>{boundaryReads.push({actor,selected,service,signal});if(membershipFailures>0){membershipFailures--;throw Error('synthetic membership 503')}const current=organizations.find(o=>o.slug===(selected.kind==='selected'?selected.slug:'B'))||null;return{service,actorId:actor,memberships:organizations,current}}},
 '@/components/CheckoutRecoveryProvider':{useCheckoutRecovery:()=>recovery},
 '@/lib/checkout-recovery-client':{checkoutStoredIntent:()=>null},
 '@/lib/popup/popup-read':{getPopupSummary:async()=>({days:7,totals:{impressions:0,clicks:0,ctr:null},siteCount:0,liveCount:0})},
 '@/lib/tenjikai/saved-projects-read':{readSavedTenjikaiProjects:async()=>({state:'ready',items:[],href:'/tenjikai'})},
 './finance-read':{loadHomeFinance:async()=>({month:'2026-10',income:{state:'unused',organization:null,value:null},expense:{state:'unused',organization:null,value:null}})},
 '@/lib/plan-utils':{tierFrom:()=> 'FREE',planLabel:()=> 'Free',isPaidTier:()=>false},
 '@/lib/promane/labor-cost':{laborCostForEntry:()=>0},'@/lib/promane/time-entry-project':{timeEntryBelongsToProject:()=>false},
 '@/lib/quote/access':{orgSlugFrom:r=>new URL(r.url).searchParams.get('org'),getQuoteContext:async slug=>({userId:'actor',organizationId:slug==='A'?'orgA':'orgB',role:'owner'}),hasMinRole:()=>true},
 '@/lib/quote/document':{recalcDocument:async()=>{throw Error('Write forbidden')}},
 '@/lib/quote/document-revision':{withQuoteDocumentRevision:async(_db,d)=>d,QuoteDocumentRevisionError:class extends Error{}},
}
function load(relative){const file=path.join(root,relative);if(cache.has(file))return cache.get(file).exports;const m=new Module(file);m.filename=file;cache.set(file,m);m.require=id=>{if(mocks[id])return mocks[id];if(id.startsWith('@/')||id.startsWith('.')){const base=id.startsWith('@/')?path.join(root,'src',id.slice(2)):path.resolve(path.dirname(file),id);for(const ext of ['.ts','.tsx'])if(fs.existsSync(base+ext))return load(path.relative(root,base+ext))}return req(id)};m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);return m.exports}
const getHomeSummary=load('src/lib/home/summary.ts').getHomeSummary
const boundary=load('src/components/quote/QuoteWorkspaceBoundary.tsx')
const hook=load('src/lib/quote/use-document-detail.ts').useQuoteDocumentDetail
const issuerHook=load('src/lib/quote/use-issuer-settings.ts').useQuoteIssuerSettings
const route=load('src/app/api/quote/documents/[id]/route.ts')
global.fetch=async (url,init={})=>{const u=new URL(url,'https://example.invalid'),slug=u.searchParams.get('org')||'A';if(u.pathname==='/api/quote/organizations')return Response.json({memberships:organizations,current:organizations.find(o=>o.slug===slug)});if(u.pathname==='/api/quote/issuer'){if(init.method==='PUT'){writes.push({url,body:JSON.parse(init.body)});assert.ok(pendingIssuer);return pendingIssuer.promise}return Response.json({issuer:{companyName:'A issuer'}})}assert.equal(u.pathname,'/api/quote/documents/docA');if(init.method==='PATCH'){writes.push({url,body:JSON.parse(init.body)});assert.ok(pendingWrite);return pendingWrite.promise}assert.ok(!init.method||init.method==='GET');return route.GET({url:u.href},{params:Promise.resolve({id:'docA'})})}
let current
function Harness(){const id=React.useRef(0);if(!id.current)id.current=++mounted;current=hook('docA');return React.createElement('div',{'data-mount':id.current},current.doc?.quoteNo||current.error||'pending')}
let currentIssuer
function IssuerHarness(){const id=React.useRef(0);if(!id.current)id.current=++mounted;currentIssuer=issuerHook();return React.createElement('div',{'data-issuer-mount':id.current},currentIssuer.form.companyName||currentIssuer.error||'pending')}
async function test(storage,href){window.localStorage.clear();window.localStorage.setItem('doya.quote.org',storage);window.history.replaceState(null,'',href);reads.length=0;boundaryReads.length=0;const r=createRoot(document.getElementById('root'));try{await React.act(async()=>{r.render(React.createElement(boundary.QuoteWorkspaceBoundary,null,React.createElement(Harness)));for(let i=0;i<20;i++)await new Promise(setImmediate)});assert.equal(boundaryReads[0].actor,'actor');assert.deepEqual(boundaryReads[0].selected,{kind:'selected',slug:'A'});assert.equal(boundaryReads[0].service,'quote');assert.equal(reads.length,1);console.log('OBSERVED',JSON.stringify({storage,href,actualBoundaryOrg:boundaryReads[0].selected.slug,actualDocumentOrg:reads[0].organizationId,rendered:document.body.textContent}));assert.equal(current.doc?.id,'docA','Home document A must open under its own organization');assert.equal(reads[0].organizationId,'orgA')}finally{await React.act(async()=>r.unmount())}}
async function testRetainedPending(href){
  window.localStorage.setItem('doya.quote.org','B');window.history.replaceState(null,'',href)
  const r=createRoot(document.getElementById('root'))
  const render=()=>r.render(React.createElement(boundary.QuoteWorkspaceBoundary,null,React.createElement(Harness)))
  const flush=()=>React.act(async()=>{render();for(let i=0;i<20;i++)await new Promise(setImmediate)})
  try{
    await flush();const mount=document.querySelector('[data-mount]').dataset.mount
    await React.act(async()=>{current.setClientCompany('unsaved A draft');await new Promise(setImmediate)})
    assert.equal(current.clientCompany,'unsaved A draft')
    pendingWrite=deferred();await React.act(async()=>{void current.save();await new Promise(setImmediate)})
    assert.equal(writes.length,1);assert.equal(current.saving,true)
    authStatus='loading';await flush()
    assert.equal(document.querySelector('[data-mount]').dataset.mount,mount)
    assert.equal(document.querySelector('[data-mount]').closest('[hidden]')!==null,true)
    membershipFailures=1;authStatus='authenticated';await flush()
    assert.ok(document.querySelector('[role="alert"]')?.textContent.includes('組織を確認できませんでした'))
    assert.equal(document.querySelector('[data-mount]').dataset.mount,mount)
    assert.equal(document.querySelector('[data-mount]').closest('[hidden]')!==null,true)
    assert.equal(current.clientCompany,'unsaved A draft')
    await React.act(async()=>{document.querySelector('[role="alert"] button').click();for(let i=0;i<20;i++)await new Promise(setImmediate)})
    assert.equal(document.querySelector('[data-mount]').dataset.mount,mount)
    assert.equal(current.clientCompany,'unsaved A draft')
    await React.act(async()=>window.dispatchEvent(new dom.window.PageTransitionEvent('pagehide')))
    assert.equal(document.querySelector('[data-mount]').dataset.mount,mount)
    assert.equal(document.querySelector('[data-mount]').closest('[hidden]')!==null,true)
    await React.act(async()=>{window.dispatchEvent(new dom.window.PageTransitionEvent('pageshow',{persisted:true}));for(let i=0;i<20;i++)await new Promise(setImmediate)})
    assert.equal(document.querySelector('[data-mount]').dataset.mount,mount)
    assert.equal(current.clientCompany,'unsaved A draft')
    await React.act(async()=>{pendingWrite.resolve(Response.json({document:{...doc,clientCompany:'old response',revision:'b'.repeat(64)}}));await new Promise(setImmediate)})
    assert.equal(current.clientCompany,'unsaved A draft')
    assert.equal(current.unknown,true)
    await React.act(async()=>{void current.save();await new Promise(setImmediate)})
    assert.equal(writes.length,1)
    console.log('PASS actual Boundary + detail hook retains dirty/pending through same-actor failed membership retry and BFCache; late body ignored, explicit repeat write zero')
  }finally{authStatus='authenticated';pendingWrite=null;await React.act(async()=>r.unmount())}
}
async function testIssuerPending(){
  window.localStorage.setItem('doya.quote.org','B');window.history.replaceState(null,'','/quote/settings?org=A')
  const r=createRoot(document.getElementById('root'))
  const render=()=>r.render(React.createElement(boundary.QuoteWorkspaceBoundary,null,React.createElement(IssuerHarness)))
  const flush=()=>React.act(async()=>{render();for(let i=0;i<20;i++)await new Promise(setImmediate)})
  try{
    await flush();const mount=document.querySelector('[data-issuer-mount]').dataset.issuerMount
    await React.act(async()=>{currentIssuer.update('companyName','unsaved issuer');await new Promise(setImmediate)})
    assert.equal(currentIssuer.form.companyName,'unsaved issuer')
    pendingIssuer=deferred();const before=writes.length
    await React.act(async()=>{void currentIssuer.save();await new Promise(setImmediate)})
    assert.equal(writes.length,before+1);assert.equal(currentIssuer.saving,true)
    authStatus='loading';await flush()
    assert.equal(document.querySelector('[data-issuer-mount]').dataset.issuerMount,mount)
    assert.equal(document.querySelector('[data-issuer-mount]').closest('[hidden]')!==null,true)
    membershipFailures=1;authStatus='authenticated';await flush()
    assert.ok(document.querySelector('[role="alert"]')?.textContent.includes('組織を確認できませんでした'))
    assert.equal(document.querySelector('[data-issuer-mount]').dataset.issuerMount,mount)
    assert.equal(document.querySelector('[data-issuer-mount]').closest('[hidden]')!==null,true)
    assert.equal(currentIssuer.form.companyName,'unsaved issuer')
    await React.act(async()=>{document.querySelector('[role="alert"] button').click();for(let i=0;i<20;i++)await new Promise(setImmediate)})
    assert.equal(document.querySelector('[data-issuer-mount]').dataset.issuerMount,mount)
    assert.equal(currentIssuer.form.companyName,'unsaved issuer')
    await React.act(async()=>window.dispatchEvent(new dom.window.PageTransitionEvent('pagehide')))
    assert.equal(document.querySelector('[data-issuer-mount]').dataset.issuerMount,mount)
    assert.equal(document.querySelector('[data-issuer-mount]').closest('[hidden]')!==null,true)
    await React.act(async()=>{window.dispatchEvent(new dom.window.PageTransitionEvent('pageshow',{persisted:true}));for(let i=0;i<20;i++)await new Promise(setImmediate)})
    assert.equal(document.querySelector('[data-issuer-mount]').dataset.issuerMount,mount)
    assert.equal(currentIssuer.form.companyName,'unsaved issuer')
    await React.act(async()=>{pendingIssuer.resolve(Response.json({issuer:{id:'issuer-A',...writes.at(-1).body,companyName:'old response'}}));await new Promise(setImmediate)})
    assert.equal(currentIssuer.form.companyName,'unsaved issuer')
    assert.equal(currentIssuer.unknown,true)
    await React.act(async()=>{void currentIssuer.save();await new Promise(setImmediate)})
    assert.equal(writes.length,before+1)
    console.log('PASS actual Boundary + issuer hook retains dirty/pending through same-actor failed membership retry and BFCache; late body ignored, explicit repeat write zero')
  }finally{authStatus='authenticated';pendingIssuer=null;await React.act(async()=>r.unmount())}
}
;(async()=>{const summary=await getHomeSummary('actor',new Date('2026-10-21T00:00:00Z'));const href=summary.events.find(e=>e.id==='quote-docA').href;console.log('ACTUAL_HOME_HREF',href);for(const selected of ['A','B']){try{await test(selected,href);console.log('PASS Home link with stored '+selected)}catch(e){console.log('FAIL Home link with stored '+selected,e.message);process.exitCode=1}}assert.equal(writes.length,0);await testRetainedPending(href);await testIssuerPending();dom.window.close()})().catch(e=>{console.error(e);process.exitCode=1;dom.window.close()})
