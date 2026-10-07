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
 const id=url.split('/').pop();if(delayOld&&id==='old')return new Promise(r=>resolveOld=()=>r(Response.json({employee:employee(id)})))
 return Response.json({employee:employee(id)})
}
const sourceFile=process.env.DOYA_TEST_BASELINE ? path.join(process.env.DOYA_TEST_BASELINE,file) : file;
const exportsObj={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(sourceFile,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports:exportsObj,require:n=>{
 if(n==='react'||n==='react/jsx-runtime')return req(n)
 if(n==='next/navigation')return{useParams:()=>({id:currentId}),useRouter:()=>({push:p=>navigations.push(p)})}
 if(n==='react-hot-toast')return{__esModule:true,default:{error:m=>errors.push(m),success:()=>{}}}
 if(n==='framer-motion')return{motion:new Proxy({},{get:(_,tag)=>({children,...props})=>React.createElement(tag,props,children)})}
 if(n==='next/link')return{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)}
 throw Error('Unmocked '+n)
},fetch,Date,console,AbortController,FileReader:dom.window.FileReader,window:dom.window,document:dom.window.document,setTimeout,clearTimeout})
const container=document.createElement('div');document.body.append(container);const root=createRoot(container),Page=exportsObj.default
const act=f=>React.act(async()=>{await f();for(let i=0;i<10;i++)await new Promise(setImmediate)}),props=e=>{assert(e);return e[Object.keys(e).find(k=>k.startsWith('__reactProps$'))]},render=()=>root.render(React.createElement(Page)),submit=()=>props(container.querySelector('form')).onSubmit({preventDefault(){}})
;(async()=>{const failures=[];try{await act(render);for(const scenario of ['missing-employee','wrong-employee','false-success','valid-acknowledgement']){try{const before=navigations.length;let promise;await act(()=>{promise=submit()});const next={id:scenario==='wrong-employee'?'foreign':'employee',updatedAt:'2026-10-07T00:00:01.000Z'};const body=scenario==='missing-employee'?{success:true}:{success:scenario!=='false-success',employee:next};await act(async()=>{pendingPatch(Response.json(body));await promise});assert.equal(navigations.length-before,scenario==='valid-acknowledgement'?1:0,'Unverified acknowledgement produced success navigation');cases.push(scenario)}catch(e){failures.push({scenario,error:e.message})}}
fs.writeFileSync('docs/audits/2026-10-06-all-services-recheck/hr-employee-editor-ack-results.json',JSON.stringify({checkedAt:new Date().toISOString(),passed:cases.length,cases,failures,sourceHashes:{[file]:crypto.createHash('sha256').update(fs.readFileSync(sourceFile)).digest('hex')},scope:'Mounted actual editor and synthetic 200 PATCH responses; malformed/wrong employee/false success and valid saved-version acknowledgement. No production operations.'},null,2)+'\n');console.log(JSON.stringify({cases,failures}));if(failures.length)process.exitCode=1
}finally{await act(()=>root.unmount());dom.window.close()}})().catch(e=>{console.error(e);process.exitCode=1})
