// Actual Mensetsu staff Tool/Compare/Template/Report clients -> actual GET route/access layer.
// Synthetic logged-in actor, memberships, and Prisma rows; no provider, AI, writes, or real network.
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module')
const root = path.resolve(__dirname, '../..')
const req = Module.createRequire(path.join(root,'package.json'))
const React = req('react'), { createRoot } = req('react-dom/client'), { JSDOM } = req('jsdom'), ts = req('typescript')
const { load } = req(path.join(root,'scripts/security-regression/load-typescript.cjs'))
const orgs = {
  A: {id:'org-A', name:'Organization A', slug:'A', recordAudio:false, retentionDays:180, discloseToCandidate:false},
  B: {id:'org-B', name:'Organization B', slug:'B', recordAudio:false, retentionDays:180, discloseToCandidate:false},
}
const membership = org => ({userId:'actor-1', organizationId:org.id, organization:org, role:'owner', status:'ACTIVE'})
const template = org => ({id:`template-${org.slug}`, organizationId:org.id, name:`Template ${org.slug}`,
  jobTitle:`Job ${org.slug}`, level:'mid', durationMin:10, status:'draft', intro:'', closing:'',
  questions:[], criteria:[], _count:{questions:0,criteria:0,sessions:1}})
let reportMode=false
const session = org => ({id:`session-${org.slug}`, organizationId:org.id, token:`token-${org.slug}`,
  candidateName:`Candidate ${org.slug}`, candidateEmail:null,status:reportMode?'evaluated':'pending',verdict:null,expiresAt:new Date('2030-01-01T00:00:00Z'),
  createdAt:new Date('2026-10-01T00:00:00Z'), startedAt:null,endedAt:null,evaluatedAt:reportMode?new Date('2026-10-01T00:00:00Z'):null,updatedAt:new Date('2026-10-01T00:00:00Z'),
  template:template(org),turns:[],scores:[],recordingPath:reportMode?`recording-${org.slug}`:null,overallComment:null,recruiterReport:null,candidateFeedback:null})
const profile = org => ({id:`profile-${org.slug}`,companyName:`Company ${org.slug}`,sourceUrl:`https://${org.slug.toLowerCase()}.example.invalid`,
  business:'Synthetic business',valueProp:null,culture:null,idealProfile:null,updatedAt:new Date('2026-10-01T00:00:00Z')})
const reads=[], writes=[]
const db = {
  mensetsuMember: {
    findFirst: async ({where}) => { reads.push({table:'member',where}); const org = where.organization?.slug ? orgs[where.organization.slug] : orgs.A; return org ? membership(org) : null },
    findMany: async () => [membership(orgs.A),membership(orgs.B)],
  },
  mensetsuOrganization: {findUnique:async ({where}) => Object.values(orgs).find(o=>o.id===where.id)||null},
  mensetsuTemplate: {
    findMany:async ({where}) => {reads.push({table:'template',where});const o=Object.values(orgs).find(x=>x.id===where.organizationId);return o?[template(o)]:[]},
    findFirst:async ({where}) => {reads.push({table:'template',where});const o=Object.values(orgs).find(x=>x.id===where.organizationId);return o && (!where.id||where.id===`template-${o.slug}`)?template(o):null},
  },
  mensetsuCompanyProfile: {findFirst:async ({where}) => {reads.push({table:'company',where});return profile(Object.values(orgs).find(o=>o.id===where.organizationId))}},
  mensetsuSession: {
    findMany:async ({where}) => {reads.push({table:'session',where}); const o=Object.values(orgs).find(x=>x.id===where.organizationId);return o && where.status!=='evaluated'?[session(o)]:[]},
    count:async ({where}) => {reads.push({table:'sessionCount',where});return where.status==='evaluated'?0:1},
    findFirst:async ({where}) => {reads.push({table:'session',where});const o=Object.values(orgs).find(x=>x.id===where.organizationId);return o&&where.id===`session-${o.slug}`?session(o):null},
  },
}
const types=load('src/lib/mensetsu/types.ts')
const access=load('src/lib/mensetsu/access.ts',{
  'next-auth':{getServerSession:async()=>({user:{id:'actor-1'}})},'@/lib/auth':{authOptions:{}},
  '@/lib/prisma':{prisma:db},'@/lib/account-lifecycle/store':{},'./types':types,
})
const routeMocks={
  crypto:require('node:crypto'),
  'next/server':{NextResponse:Response},'@/lib/prisma':{prisma:db},'@/lib/mensetsu/access':access,
  '@/lib/account-lifecycle/state':{LifecycleError:class extends Error{}},
  '@/lib/organization-billing':{},'@/lib/mensetsu/interview-url':{},'@/lib/plan-limit':{},
  '@/lib/organization-quota-ledger':{},'@/lib/pricing':{},'@/lib/service-usage':{},
  '@/lib/mensetsu/template':{},'@/lib/mensetsu/guardrails':{},'@/lib/mensetsu/evaluate':{weightedAverage:()=>null},
}
const api={
  '/api/mensetsu/organizations':load('src/app/api/mensetsu/organizations/route.ts',routeMocks).GET,
  '/api/mensetsu/templates':load('src/app/api/mensetsu/templates/route.ts',routeMocks).GET,
  '/api/mensetsu/company':load('src/app/api/mensetsu/company/route.ts',routeMocks).GET,
  '/api/mensetsu/sessions':load('src/app/api/mensetsu/sessions/route.ts',routeMocks).GET,
  '/api/mensetsu/compare':load('src/app/api/mensetsu/compare/route.ts',routeMocks).GET,
  '/api/mensetsu/templates/[id]':load('src/app/api/mensetsu/templates/[id]/route.ts',routeMocks).GET,
  '/api/mensetsu/sessions/[id]':load('src/app/api/mensetsu/sessions/[id]/route.ts',routeMocks).GET,
}
const no=()=>null
const fetchOrgJson=load('src/lib/org-fetch.ts',{}, {fetch:(...args)=>global.fetch(...args)}).fetchOrgJson
const staffRequest=load('src/lib/mensetsu/staff-request-client.ts',{}, {fetch:(...args)=>global.fetch(...args),AbortController,setTimeout,clearTimeout})
const sessionPages=load('src/lib/mensetsu/session-pages.ts',{'@/lib/mensetsu/staff-request-client':staffRequest})
const selection=load('src/lib/organization-workspace-selection.ts')
const scopeCache=new Map()
function workspace(){
 const slug=new URL(window.location.href).searchParams.get('org')||'A'
 if(scopeCache.has(slug))return scopeCache.get(slug)
 const organization=orgs[slug]
 assert.ok(organization)
 const proof={actorId:'actor-1',organization:{...organization,role:'owner'},revision:1,current:()=>true,
   href:p=>selection.workspaceHref(p,slug,'mensetsu'),api:p=>selection.workspaceApi(p,slug,'mensetsu')}
 const value={scope:{kind:'ready',key:'fixture',proof,memberships:[proof.organization]},retry:()=>{}}
 scopeCache.set(slug,value)
 return value
}
const requestCache=new Map()
const scopedRequest=()=>{const proof=workspace().scope.proof;if(requestCache.has(proof.organization.slug))return requestCache.get(proof.organization.slug);const value={proof,request:(p,options)=>staffRequest.requestMensetsuStaff(proof,p,options)};requestCache.set(proof.organization.slug,value);return value}
const ui={PageTitle:({children,...props})=>React.createElement('h1',props,children),useToolUiNext:()=>false}
const ds={EmptyState:no,ErrorNotice:no,Skeleton:no,ToolHero:no}
let routeId=null
function component(file){
 const filename=path.join(root,file),mod=new Module(filename);mod.filename=filename
 const mocks={
  react:React,'react/jsx-runtime':req('react/jsx-runtime'),
  'next/link':{__esModule:true,default:({href,children,...props})=>React.createElement('a',{href,...props},children)},
  'next-auth/react':{useSession:()=>({data:{user:{id:'actor-1',name:'Actor'}}})},
  'next/navigation':{useParams:()=>({id:routeId}),useRouter:()=>({push:()=>{throw Error('navigation forbidden in before fixture')}})},
  '@/components/mensetsu/ui-next':ui,'@/components/ds':ds,
  '@/lib/ui/notify':{notifyError:(setter,message)=>setter(message)},
  '@/lib/org-fetch':{fetchOrgJson},'@/lib/mensetsu/session-pages':sessionPages,
  '@/components/LoadingProgress':{__esModule:true,default:no},'./Lp':{__esModule:true,default:no},
  '@/lib/mensetsu/types':types,
  '@/lib/mensetsu/staff-request-client':staffRequest,
  '@/components/mensetsu/MensetsuWorkspaceBoundary':{useMensetsuWorkspace:workspace},
  '@/components/mensetsu/useMensetsuRequest':{useMensetsuRequest:scopedRequest},
  '@/components/mensetsu/useMensetsuOperation':load('src/components/mensetsu/useMensetsuOperation.ts',{'react':React}),
 }
 mod.require=id=>id in mocks?mocks[id]:req(id)
 mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename)
 return mod.exports.default
}
const clients={
 Tool:component('src/app/(shell)/mensetsu/Tool.tsx'),
 Compare:component('src/app/(shell)/mensetsu/compare/page.tsx'),
 Template:component('src/app/(shell)/mensetsu/templates/[id]/page.tsx'),
 Report:component('src/app/(shell)/mensetsu/sessions/[id]/page.tsx'),
 Settings:component('src/app/(shell)/mensetsu/settings/page.tsx'),
}
const originalFetch=global.fetch
const requests=[]
const mediaCalls=[]
global.fetch=async (target,options={})=>{
 const url=new URL(String(target),'https://example.invalid'); const requestRow={url:url.pathname+url.search,method:options.method||'GET',status:0}; requests.push(requestRow)
 if((options.method||'GET')!=='GET'){writes.push({url:url.pathname,method:options.method});throw Error('write forbidden')}
 if(url.pathname.endsWith('/recording')) {requestRow.status=200;return Response.json({url:`https://recording.invalid/${url.searchParams.get('org')}`,expiresInSec:900})}
 const key=url.pathname.match(/^\/api\/mensetsu\/(templates|sessions)\/[^/]+$/)?.[1]
 if(url.pathname==='/api/mensetsu/members') { requestRow.status=200; return Response.json({myUserId:'actor-1',myRole:'owner',members:[{id:'member-'+url.searchParams.get('org'),name:null,inviteEmail:null,role:'owner',status:'ACTIVE',userId:'actor-1'}]}) }
 const handler=api[key?`/api/mensetsu/${key}/[id]`:url.pathname]
 if(!handler){ if(url.pathname.endsWith('/hr-handoff')) {requestRow.status=200;return Response.json({organizations:[],alreadyHandedOff:false})}throw Error('Unexpected URL '+url.pathname) }
 const response=await handler(new Request(url),key?{params:Promise.resolve({id:url.pathname.split('/').at(-1)})}:undefined)
 requestRow.status=response.status
 return response
}
async function mount(name,selected,org){
 reportMode=name==='Report'
 const dom=new JSDOM('<div id="root"></div>',{url:`https://example.invalid/mensetsu${name==='Tool'?'':name==='Compare'?'/compare':name==='Template'?`/templates/template-${org}`:name==='Settings'?'/settings':`/sessions/session-${org}`}?org=${selected}`})
 global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true
 routeId=name==='Template'?`template-${org}`:name==='Report'?`session-${org}`:null
 const before=requests.length,rootNode=createRoot(document.getElementById('root'))
 dom.window.HTMLMediaElement.prototype.pause=function(){mediaCalls.push('pause')}
 dom.window.HTMLMediaElement.prototype.load=function(){mediaCalls.push('load')}
 try{
  await React.act(async()=>{rootNode.render(React.createElement(clients[name]));for(let i=0;i<30;i++)await new Promise(setImmediate)})
  if(name==='Report') {
   const replay=[...document.querySelectorAll('button')].find(button=>button.textContent.includes('録音を再生'))
   assert.ok(replay)
   await React.act(async()=>{replay.click();await new Promise(setImmediate)})
   assert.equal(document.querySelector('audio')?.getAttribute('src'),`https://recording.invalid/${selected}`)
  }
  const html=document.getElementById('root').innerHTML,text=document.getElementById('root').textContent
  return {requests:requests.slice(before),text,html}
 }finally{await React.act(async()=>rootNode.unmount());if(name==='Report'){assert.ok(mediaCalls.includes('pause'));assert.ok(mediaCalls.includes('load'))}dom.window.close()}
}
;(async()=>{
 const rows=[]
 // The actual server routes can resolve explicit B. The mounted clients below omit that selection.
 const directB=[]
 for (const suffix of ['/templates','/templates/template-B','/sessions/session-B']) {
  const url=`/api/mensetsu${suffix}?org=B`
  const response=await global.fetch(url)
  const body=await response.json()
  assert.equal(response.status,200,`${url} server explicit-B control`)
  directB.push({url,status:response.status,orgId:body.templates?.[0]?.organizationId||body.template?.organizationId||body.session?.organizationId})
  assert.equal(directB.at(-1).orgId,'org-B',`${url} resolves B`)
 }
 console.log('PASS explicit-B actual GET route controls',JSON.stringify(directB))
 for(const name of ['Tool','Compare','Template','Report','Settings']){
  const control=await mount(name,'A','A'),wrong=await mount(name,'B','B')
  const hasA=(r)=>name==='Tool'?r.text.includes('Company A'):name==='Compare'?r.text.includes('Template A'):name==='Template'?r.html.includes('value="Template A"'):name==='Settings'?r.text.includes('Organization A'):r.text.includes('Candidate A')
  const hasB=(r)=>name==='Tool'?r.text.includes('Company B'):name==='Compare'?r.text.includes('Template B'):name==='Template'?r.html.includes('value="Template B"'):name==='Settings'?r.text.includes('Organization B'):r.text.includes('Candidate B')
  const row={name,controlA:{requests:control.requests,displayA:hasA(control),text:control.text.slice(0,180)},selectedB:{requests:wrong.requests,displayB:hasB(wrong),displayA:hasA(wrong),text:wrong.text.slice(0,180)}}
  rows.push(row)
  if(!row.controlA.displayA)console.log('DEBUG control',name,JSON.stringify(row.controlA))
  assert.equal(row.controlA.displayA,true,`${name} same-org A control must render`)
  assert.ok(row.controlA.requests.length>0)
  assert.ok(row.selectedB.requests.every(r=>new URL(r.url,'https://example.invalid').searchParams.get('org')==='B'),`${name} selected B must be sent in every staff GET`)
  assert.equal(row.selectedB.displayB,true,`${name} selected B must render B`)
  if(name==='Report') {
   const links=[...wrong.html.matchAll(/href="([^"]+)"/g)].map(match=>match[1].replace(/&amp;/g,'&'))
   assert.ok(links.some(link=>link.includes('/api/mensetsu/sessions/session-B/pdf?org=B')))
   assert.ok(links.some(link=>{const url=new URL(link,'https://example.invalid');return url.pathname==='/api/mensetsu/sessions/session-B/pdf'&&url.searchParams.get('org')==='B'&&url.searchParams.get('transcript')==='1'}))
  }
  console.log('PASS same-org A control',name)
  console.log('PASS selected B org roundtrip',name,JSON.stringify({requests:row.selectedB.requests,displayB:row.selectedB.displayB,displayA:row.selectedB.displayA}))
 }
 assert.equal(writes.length,0)
 console.log(JSON.stringify({ scope: 'Actual staff components and GET routes/access with synthetic actor, proof and Prisma; boundary mounted separately; no writes or external network', controls: directB.length, screens: rows.length, writes: writes.length }))
})().catch(error=>{console.error(error);process.exitCode=2}).finally(()=>{global.fetch=originalFetch})
