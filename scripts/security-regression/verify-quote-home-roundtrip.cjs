// Actual Home summary -> actual Quote hook/request/parser -> actual GET route.
// Synthetic session/context/Prisma/revision stamp. No network, DB, writes or production.
process.env.NODE_ENV='test'
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict')
const root=path.resolve(__dirname,'../..'), req=Module.createRequire(path.join(root,'package.json'))
const React=req('react'),ts=req('typescript'),{JSDOM}=req('jsdom')
const dom=new JSDOM('<main id="root"></main>',{url:'https://example.invalid/home'})
global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true
const {createRoot}=req('react-dom/client'),cache=new Map(),reads=[],writes=[]
const doc={id:'docA',revision:'a'.repeat(64),quoteNo:'QA',title:'A document',status:'draft',clientCompany:'A customer',clientDept:null,clientPerson:null,issueDate:'2026-10-01T00:00:00Z',expiryDate:'2026-10-31T00:00:00Z',paymentTerms:null,deliveryTerms:null,notes:null,discountType:null,discountValue:0,totalExclTax:100,taxAmount:10,totalInclTax:110,lineItems:[{id:'lineA',itemName:'A item',spec:null,qty:1,unit:'unit',unitPrice:100,taxRate:10,priceSource:'manual',sourceRef:null,rangeMin:null,rangeMax:null}],organizationId:'orgA'}
const prisma=new Proxy({}, {get:(_,model)=>new Proxy({}, {get:(_,method)=>async args=>{
 if(!['findFirst','findUnique','findMany','count'].includes(method)){writes.push({model,method});throw Error('Write forbidden')}
 if(model==='user')return{name:'Synthetic',email:null,plan:'FREE',stripeCurrentPeriodEnd:null}
 if(model==='quoteMember')return {organizationId:'orgA',role:'owner',organization:{id:'orgA',name:'A',slug:'A'}}
 if(model==='quoteDocument'&&method==='findMany')return args.where.expiryDate?[{id:'docA',title:'A document',expiryDate:new Date(doc.expiryDate)}]:[]
 if(model==='quoteDocument'&&method==='findFirst'){reads.push(args.where);return args.where.id==='docA'&&args.where.organizationId==='orgA'?doc:null}
 return method==='findMany'?[]:method==='count'?0:null
}})})
const proofs=new Map()
function proof(){const slug=new URL(window.location.href).searchParams.get('org')||window.localStorage.getItem('doya.quote.org');if(!slug)return null;if(!proofs.has(slug))proofs.set(slug,{actorId:'actor',organization:{id:`org${slug}`,slug,name:slug,role:'owner'},revision:1,current:()=>true});return proofs.get(slug)}
const mocks={
 '@/lib/prisma':{prisma},'next/server':{NextResponse:Response},
 'next-auth/react':{useSession:()=>({status:'authenticated',data:{user:{id:'actor'}}})},
 '@/lib/popup/popup-read':{getPopupSummary:async()=>({days:7,totals:{impressions:0,clicks:0,ctr:null},siteCount:0,liveCount:0})},
 '@/lib/tenjikai/saved-projects-read':{readSavedTenjikaiProjects:async()=>({state:'ready',items:[],href:'/tenjikai'})},
 './finance-read':{loadHomeFinance:async()=>({month:'2026-10',income:{state:'unused',organization:null,value:null},expense:{state:'unused',organization:null,value:null}})},
 '@/lib/plan-utils':{tierFrom:()=> 'FREE',planLabel:()=> 'Free',isPaidTier:()=>false},
 '@/lib/promane/labor-cost':{laborCostForEntry:()=>0},'@/lib/promane/time-entry-project':{timeEntryBelongsToProject:()=>false},
 '@/lib/quote/access':{orgSlugFrom:r=>new URL(r.url).searchParams.get('org'),getQuoteContext:async slug=>({userId:'actor',organizationId:slug==='A'?'orgA':'orgB',role:'owner'}),hasMinRole:()=>true},
 '@/lib/quote/document':{recalcDocument:async()=>{throw Error('Write forbidden')}},
 '@/lib/quote/document-revision':{withQuoteDocumentRevision:async(_db,d)=>d,QuoteDocumentRevisionError:class extends Error{}},
 '@/components/quote/QuoteWorkspaceBoundary':{useQuoteWorkspace:()=>({scope:{kind:'ready',proof:proof()}})},
}
function load(relative){const file=path.join(root,relative);if(cache.has(file))return cache.get(file).exports;const m=new Module(file);m.filename=file;cache.set(file,m);m.require=id=>{if(mocks[id])return mocks[id];if(id.startsWith('@/')||id.startsWith('.')){const base=id.startsWith('@/')?path.join(root,'src',id.slice(2)):path.resolve(path.dirname(file),id);for(const ext of ['.ts','.tsx'])if(fs.existsSync(base+ext))return load(path.relative(root,base+ext))}return req(id)};m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);return m.exports}
const getHomeSummary=load('src/lib/home/summary.ts').getHomeSummary
const hook=load('src/lib/quote/use-document-detail.ts').useQuoteDocumentDetail
const route=load('src/app/api/quote/documents/[id]/route.ts')
global.fetch=async (url,init={})=>{assert.ok(!init.method||init.method==='GET');const u=new URL(url,'https://example.invalid'),slug=u.searchParams.get('org')||'A';if(u.pathname==='/api/quote/organizations')return Response.json({memberships:['A','B'].map(slug=>({slug,name:slug,role:'owner'})),current:{slug,name:slug,role:'owner'}});assert.equal(u.pathname,'/api/quote/documents/docA');return route.GET({url:u.href},{params:Promise.resolve({id:'docA'})})}
let current
function Harness(){current=hook('docA');return React.createElement('div',null,current.doc?.quoteNo||current.error||'pending')}
async function test(storage,href){window.localStorage.clear();window.localStorage.setItem('doya.quote.org',storage);window.history.replaceState(null,'',href);reads.length=0;const r=createRoot(document.getElementById('root'));try{await React.act(async()=>{r.render(React.createElement(Harness));for(let i=0;i<20;i++)await new Promise(setImmediate)});assert.equal(reads.length,1);console.log('OBSERVED',JSON.stringify({storage,href,actualDocumentOrg:reads[0].organizationId,rendered:document.body.textContent}));assert.equal(current.doc?.id,'docA','Home document A must open under its own organization');assert.equal(reads[0].organizationId,'orgA')}finally{await React.act(async()=>r.unmount())}}
;(async()=>{const summary=await getHomeSummary('actor',new Date('2026-10-21T00:00:00Z'));const href=summary.events.find(e=>e.id==='quote-docA').href;console.log('ACTUAL_HOME_HREF',href);for(const selected of ['A','B']){try{await test(selected,href);console.log('PASS Home link with stored '+selected)}catch(e){console.log('FAIL Home link with stored '+selected,e.message);process.exitCode=1}}assert.equal(writes.length,0);dom.window.close()})().catch(e=>{console.error(e);process.exitCode=1;dom.window.close()})
