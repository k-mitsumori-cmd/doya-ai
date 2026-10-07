// Actual list page, layout, lifecycle hook, validators and bounded HTTP; synthetic session/transport only.
process.env.NODE_ENV='test'
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{createOrgClient}=require('../../../scripts/security-regression/org-client-test-loader.cjs')
const root=process.cwd(),req=n=>require(path.join(root,'node_modules',n)),React=req('react'),ts=req('typescript'),{JSDOM}=req('jsdom'),dom=new JSDOM('<body></body>',{url:'https://example.invalid'})
global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true
const{createRoot}=req('react-dom/client'),modules=new Map(),intervals=new Map();let intervalId=0
let org,actor,auth,stored,readHook,writeHook,reads,writes,confirmed,confirms,c,r,mounted
const row=(scope,i,status='done')=>({id:scope+'-'+i,targetName:scope+' private '+i,targetUrl:'https://example.invalid/'+i,status,createdAt:'2026-10-07T00:00:00.000Z',updatedAt:'2026-10-07T00:00:00.000Z'})
const rows=scope=>Array.from({length:101},(_,i)=>row(scope,i+1)),page=(scope,cursor)=>{const items=stored[scope],start=cursor?items.findIndex(x=>x.id===cursor)+1:0,chunk=items.slice(start,start+100);return{items:chunk,total:items.length,nextCursor:start+100<items.length?chunk.at(-1).id:null}}
const fetch=async(url,init={})=>{const u=new URL(url,'https://example.invalid'),scope=u.searchParams.get('org');if(init.method&&init.method!=='GET'){const w={url,scope,method:init.method,body:JSON.parse(init.body)};writes.push(w);if(writeHook)return writeHook(w);const id=u.pathname.split('/').at(-1);stored[scope]=stored[scope].filter(x=>x.id!==id);return Response.json({ok:true})}reads.push({url,scope});if(readHook)return readHook(u,scope);if(u.pathname.includes('company-profile'))return Response.json({profile:{}});if(u.searchParams.has('watch'))return Response.json({items:stored[scope].filter(x=>u.searchParams.get('watch').split(',').includes(x.id))});return Response.json(page(scope,u.searchParams.get('cursor')))}
const client=createOrgClient('shodan',{fetch}).client
function load(file){if(modules.has(file))return modules.get(file);const exports={};modules.set(file,exports);vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:n=>{
 if(n==='react'||n==='react/jsx-runtime')return req(n)
 if(n==='next/link')return{__esModule:true,default:({children,href,...p})=>React.createElement('a',{href,...p},children)}
 if(n==='next/navigation')return{useParams:()=>({orgSlug:org}),useRouter:()=>({})}
 if(n==='next-auth/react')return{useSession:()=>({status:auth,data:auth==='unauthenticated'?null:{user:{id:actor}}})}
 if(n==='@/lib/shodan/client'||n==='./client')return client
 if(n==='@/components/shodan/ui')return{DoyaKun:()=>null,sym:()=>null}
 if(n==='./ShodanSidebar')return{__esModule:true,default:()=>null}
 if(n==='lucide-react')return new Proxy({},{get:()=>()=>null})
 if(n==='framer-motion')return{AnimatePresence:({children})=>children,motion:new Proxy({},{get:(_,tag)=>({children})=>React.createElement(tag,null,children)})}
 const resolved=n.startsWith('@/')?path.join('src',n.slice(2)):n.startsWith('.')?path.join(path.dirname(file),n):null
 if(resolved)for(const ext of ['.ts','.tsx'])if(fs.existsSync(path.join(root,resolved+ext)))return load(resolved+ext)
 throw Error('Unexpected '+n+' in '+file)
},window:dom.window,URL,Date,Map,Set,Error,AbortController,console,setInterval:(fn,ms)=>{assert.equal(ms,5000);const id=++intervalId;intervals.set(id,fn);return id},clearInterval:id=>intervals.delete(id)},{filename:file});return exports}
const Page=load('src/app/shodan/[orgSlug]/page.tsx').default,Layout=load('src/components/shodan/ShodanAppLayout.tsx').default,render=()=>r.render(React.createElement(React.StrictMode,null,React.createElement(Layout,{orgSlug:org,organizationPlan:'PRO',canManageBilling:true},React.createElement(Page))))
const act=fn=>React.act(async()=>{await fn();for(let i=0;i<16;i++)await new Promise(setImmediate)}),props=e=>{assert.ok(e);return e[Object.keys(e).find(k=>k.startsWith('__reactProps$'))]},button=text=>[...c.querySelectorAll('button')].find(b=>b.textContent.includes(text)),del=()=>c.querySelector('button[title="削除"]'),deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}},cases=[]
dom.window.confirm=()=>{confirms++;return confirmed}
async function test(name,fn,configure=()=>{}){org='alpha';actor='a';auth='authenticated';stored={alpha:rows('alpha'),beta:rows('beta')};reads=[];writes=[];readHook=null;writeHook=null;confirmed=true;confirms=0;await configure();c=document.createElement('div');document.body.append(c);r=createRoot(c);mounted=true;await act(render);try{await fn();cases.push(name);console.log('PASS '+name)}finally{if(mounted)await act(()=>r.unmount());c.remove();assert.equal(intervals.size,0)}}
const change=async mode=>act(()=>{if(mode==='org')org='beta';else if(mode==='actor')actor='b';else if(mode==='auth')auth='loading';else if(mode==='unmount'){r.unmount();mounted=false;return}render()})
;(async()=>{await test('idle researched row is labeled as creating despite no list work',async()=>{assert.match(c.textContent,/作成中/);assert.equal(intervals.size,0);assert.equal(writes.length,0);console.log(JSON.stringify({status:'confirmed-open',case:'Idle researched list row is labeled 作成中 without running list job or polling',polling:false,writes:0,scope:'Actual StrictMode list/layout/controller; synthetic researched row. Does not prove absence of a job on the real server. Type specification says researched is also a stable proposal-waiting state.'},null,2))},()=>{stored.alpha=[row('alpha',1,'researched')]})})().catch(e=>{console.error(e);process.exitCode=1});
