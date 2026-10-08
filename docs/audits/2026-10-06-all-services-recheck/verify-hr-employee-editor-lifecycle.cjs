process.env.NODE_ENV='test'
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto')
const req=n=>require(path.join(process.cwd(),'node_modules',n)),React=req('react'),{JSDOM}=req('jsdom'),ts=req('typescript')
const dom=new JSDOM('<body></body>',{url:'https://example.invalid/hr/employees/employee/edit'});global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true
const {createRoot}=req('react-dom/client'),file='src/app/hr/employees/[id]/edit/page.tsx',version='2026-10-07T00:00:00.000Z',cases=[],errors=[],navigations=[],writes=[]
let pendingUpload;const readers=[];
let currentId='employee',pendingPatch,delayOld=false,resolveOld
const employee=id=>({id,updatedAt:version,firstName:'Synthetic',lastName:id,employmentType:'FULL_TIME'})
const fetch=async(url,init={})=>{
 if(url==='/api/hr/upload')return new Promise(r=>pendingUpload=r)
 if(init.method==='PATCH'){writes.push({url,body:JSON.parse(init.body)});return new Promise(r=>pendingPatch=r)}
 if(url==='/api/hr/departments')return Response.json({departments:[]})
 if(url==='/api/hr/departments?format=pages')return Response.json({success:true,format:'hr-department-page-v1',organizationId:'synthetic-org',revision:'a'.repeat(64),total:0,fragments:[],nextCursor:null})
 const id=url.split('/').pop();if(delayOld&&id==='old')return new Promise(r=>resolveOld=()=>r(Response.json({employee:employee(id)})))
 return Response.json({employee:employee(id)})
}
const sourceFile=process.env.DOYA_TEST_BASELINE ? path.join(process.env.DOYA_TEST_BASELINE,file) : file;
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
 },fetch,Date,console,AbortController,TextDecoder,Uint8Array,Response,URL,FormData:dom.window.FormData,FileReader:class{constructor(){readers.push(this)}readAsDataURL(){}},window:dom.window,document:dom.window.document,setTimeout,clearTimeout},{filename:moduleFile});return output
}
const exportsObj=loadPageModule(file)
const container=document.createElement('div');document.body.append(container);const root=createRoot(container),Page=exportsObj.default
const act=f=>React.act(async()=>{await f();for(let i=0;i<10;i++)await new Promise(setImmediate)}),props=e=>{assert(e);return e[Object.keys(e).find(k=>k.startsWith('__reactProps$'))]},render=()=>root.render(React.createElement(Page)),submit=()=>props(container.querySelector('form')).onSubmit({preventDefault(){}})
;(async()=>{try{
 await act(render);let promise;await act(()=>{promise=submit()});currentId='after-save';await act(render);await act(async()=>{pendingPatch(Response.json({success:true,employee:employee('employee')}));await promise});try{assert.equal(navigations.length,0);cases.push('late save response has no navigation after route change')}catch(e){errors.push({scenario:'late-save-route-change',error:e.message})}
 currentId='photo-source';await act(render);await act(()=>props(container.querySelector('input[type=file]')).onChange({target:{files:[new dom.window.File(['test'],'test.png',{type:'image/png'})]}}));currentId='photo-destination';await act(render);await act(()=>readers.at(-1).onload({target:{result:'data:image/png;base64,PRIVATE_OLD_PHOTO'}}));try{assert(!container.innerHTML.includes('PRIVATE_OLD_PHOTO'));cases.push('old photo read cannot populate another employee')}catch(e){errors.push({scenario:'late-photo-route-change',error:e.message})}
 currentId='upload-source';await act(render);await act(()=>props(container.querySelector('input[type=file]')).onChange({target:{files:[new dom.window.File(['test'],'test.png',{type:'image/png'})]}}));const before=writes.length;await act(()=>{promise=submit()});currentId='upload-destination';await act(render);await act(()=>pendingUpload(Response.json({url:'/api/hr/photos/org/00000000-0000-0000-0000-000000000000.png'})));if(writes.length>before)await act(async()=>{pendingPatch(Response.json({success:true,employee:employee('upload-source')}));await promise});else await act(()=>promise);try{assert.equal(writes.length,before);cases.push('upload response cannot start employee write after route change')}catch(e){errors.push({scenario:'late-upload-route-change',error:e.message})}
 const failures=errors.filter(e=>typeof e==='object');fs.writeFileSync('docs/audits/2026-10-06-all-services-recheck/hr-employee-editor-lifecycle-results.json',JSON.stringify({checkedAt:new Date().toISOString(),passed:cases.length,cases,failures,sourceHashes:{[file]:crypto.createHash('sha256').update(fs.readFileSync(sourceFile)).digest('hex')},scope:'Mounted actual page with deferred synthetic PATCH/upload/FileReader responses across employee route transitions. No customer data/provider or production writes.'},null,2)+'\n');console.log(JSON.stringify({cases,failures}));if(failures.length)process.exitCode=1
}finally{await act(()=>root.unmount());dom.window.close()}})().catch(e=>{console.error(e);process.exitCode=1})
