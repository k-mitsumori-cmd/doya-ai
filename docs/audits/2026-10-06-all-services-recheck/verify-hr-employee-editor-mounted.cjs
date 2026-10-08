process.env.NODE_ENV='test'
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto')
const req=n=>require(path.join(process.cwd(),'node_modules',n)),React=req('react'),{JSDOM}=req('jsdom'),ts=req('typescript')
const dom=new JSDOM('<body></body>',{url:'https://example.invalid/hr/employees/employee/edit'});global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true
const {createRoot}=req('react-dom/client'),file='src/app/hr/employees/[id]/edit/page.tsx',version='2026-10-07T00:00:00.000Z',cases=[],errors=[],navigations=[],writes=[]
let currentId='employee',pendingPatch,delayOld=false,resolveOld
const employee=id=>({id,updatedAt:version,firstName:'Synthetic',lastName:id,employmentType:'FULL_TIME'})
const fetch=async(url,init={})=>{
 if(init.method==='PATCH'){writes.push({url,body:JSON.parse(init.body)});return new Promise(r=>pendingPatch=r)}
 if(url==='/api/hr/departments')return Response.json({departments:[]})
 if(url==='/api/hr/departments?format=pages')return Response.json({success:true,format:'hr-department-page-v1',organizationId:'synthetic-org',revision:'a'.repeat(64),total:0,fragments:[],nextCursor:null})
 const id=url.split('/').pop();if(delayOld&&id==='old')return new Promise(r=>resolveOld=()=>r(Response.json({employee:employee(id)})))
 return Response.json({employee:employee(id)})
}
const moduleCache=new Map(),moduleSources=new Set(),authSession={status:'authenticated',data:{user:{id:'synthetic-editor-actor'}}};
function loadPageModule(moduleFile){
 if(moduleCache.has(moduleFile))return moduleCache.get(moduleFile);
 const candidate=process.env.DOYA_TEST_BASELINE?path.join(process.env.DOYA_TEST_BASELINE,moduleFile):moduleFile;
 const selected=fs.existsSync(candidate)?candidate:moduleFile;moduleSources.add(selected);const output={};moduleCache.set(moduleFile,output);
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(selected,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports:output,require:n=>{
 if(n==='react'||n==='react/jsx-runtime')return req(n)
 if(n==='next-auth/react')return{useSession:()=>authSession}
 if(n==='next/navigation')return{useParams:()=>({id:currentId}),useRouter:()=>({push:p=>navigations.push(p),back:()=>navigations.push('back')})}
 if(n==='react-hot-toast')return{__esModule:true,default:{error:m=>errors.push(m),success:()=>{}}}
 if(n==='framer-motion')return{motion:new Proxy({},{get:(_,tag)=>({children,...props})=>React.createElement(tag,props,children)})}
 if(n==='next/link')return{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)}
 if(n.startsWith('@/')){const source='src/'+n.slice(2);return loadPageModule(fs.existsSync(source+'.tsx')?source+'.tsx':source+'.ts')}
 throw Error('Unmocked '+n)
 },fetch,Date,console,AbortController,TextDecoder,Uint8Array,Response,URL,FormData:dom.window.FormData,FileReader:dom.window.FileReader,window:dom.window,document:dom.window.document,setTimeout,clearTimeout},{filename:moduleFile});return output
}
const exportsObj=loadPageModule(file)
const container=document.createElement('div');document.body.append(container);const root=createRoot(container),Page=exportsObj.default
const act=f=>React.act(async()=>{await f();for(let i=0;i<10;i++)await new Promise(setImmediate)}),props=e=>{assert(e);return e[Object.keys(e).find(k=>k.startsWith('__reactProps$'))]},render=()=>root.render(React.createElement(Page)),submit=()=>props(container.querySelector('form')).onSubmit({preventDefault(){}})
;(async()=>{try{
 await act(render);let first,second;await act(()=>{first=submit();second=submit()});assert.equal(writes.length,1);assert.equal(writes[0].body.expectedUpdatedAt,version);cases.push('loaded version sent and same-turn duplicate submit blocked')
 await act(async()=>{pendingPatch(Response.json({error:'情報が更新されています'},{status:409}));await Promise.all([first,second])});assert.equal(navigations.length,0);assert(container.querySelector('form'));assert.equal(container.querySelector('input[placeholder="山田"]').value,'employee');assert(errors.includes('情報が更新されています'));cases.push('409 retains draft and never shows success navigation')
 delayOld=true;currentId='old';await act(render);assert(!container.querySelector('form'));currentId='new';await act(render);assert.equal(container.querySelector('input[placeholder="山田"]').value,'new');cases.push('route switch hides previous form and loads new employee')
 await act(()=>resolveOld());assert.equal(container.querySelector('input[placeholder="山田"]').value,'new');cases.push('late old employee response cannot replace new form or version')
 fs.writeFileSync('docs/audits/2026-10-06-all-services-recheck/hr-employee-editor-mounted-results.json',JSON.stringify({checkedAt:new Date().toISOString(),passed:cases.length,cases,sourceHashes:{[file]:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')},scope:'Actual React page mounted in jsdom with synthetic API. Conflict/double submit and route load lifecycle; authenticated production and photo/upload/lost response recovery remain unverified.'},null,2)+'\n');console.log('PASS',cases)
}finally{await act(()=>root.unmount());dom.window.close()}})().catch(e=>{console.error(e);process.exitCode=1})
