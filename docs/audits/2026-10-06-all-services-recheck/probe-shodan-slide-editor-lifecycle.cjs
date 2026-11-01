// Historical open-defect probe. Synthetic HTTP only, no image generation/provider call.
process.env.NODE_ENV='test'
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{createOrgClient}=require('../../../scripts/security-regression/org-client-test-loader.cjs'),{load:loadTS}=require('../../../scripts/security-regression/load-typescript.cjs')
const root=process.cwd(),req=n=>require(path.join(root,'node_modules',n)),React=req('react'),ts=req('typescript'),{JSDOM}=req('jsdom'),dom=new JSDOM('<body></body>',{url:'https://example.invalid'})
global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true
const {createRoot}=req('react-dom/client'),unmountOnly=process.argv.includes('--unmount'),pdfMode=process.argv.includes('--pdf'),Null=()=>null,writes=[],notices=[],downloads=[];let resolve
dom.window.Image=class { constructor(){this.naturalWidth=1920;this.naturalHeight=1080} set src(value){setImmediate(()=>this.onload?.())} };
const held=new Promise(r=>resolve=r),prep={id:'one',targetName:'Synthetic',slidesJson:[{title:'Slide',type:'cover'}],slideImages:[{title:'Slide',role:'cover',imageUrl:'https://images.example.invalid/original.png'}]}
const client=createOrgClient('shodan',{fetch:async(url,init={})=>{if(init.method==='POST'){writes.push({url,body:JSON.parse(init.body)});return held}return Response.json({item:prep})}}).client
function load(file){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:n=>{
 if(n==='react'||n==='react/jsx-runtime')return req(n)
 if(n==='jspdf')return{jsPDF:class {constructor(){this.internal={pageSize:{getWidth:()=>842,getHeight:()=>595}}}addPage(){}addImage(){}save(name){downloads.push(name)}}}
 if(n==='next/link')return{__esModule:true,default:({children,href,...p})=>React.createElement('a',{href,...p},children)}
 if(n==='next/navigation')return{useParams:()=>({orgSlug:'alpha',id:'one'})}
 if(n==='@/lib/shodan/client')return client
 if(n==='@/components/shodan/ui')return{DoyaKun:Null,sym:name=>React.createElement('span',null,name)}
 if(n==='@/lib/shodan/complete-slide-images')return loadTS('src/lib/shodan/complete-slide-images.ts')
 if(n==='react-hot-toast')return{__esModule:true,default:{success:m=>notices.push(m),error:m=>notices.push(m)}}
 if(n==='./ShodanSidebar')return{__esModule:true,default:Null}
 if(n==='lucide-react')return new Proxy({},{get:()=>Null})
 if(n==='framer-motion')return{AnimatePresence:({children})=>children,motion:new Proxy({},{get:(_,tag)=>({children})=>React.createElement(tag,null,children)})}
 throw Error(n)
 },window:dom.window,document:dom.window.document,FileReader:dom.window.FileReader,fetch:async()=>{await held;return{ok:true,blob:async()=>new dom.window.Blob(['synthetic'],{type:'image/png'})}},console,URL,Blob,setTimeout,clearTimeout},{filename:file});return exports}
const Page=load('src/app/shodan/[orgSlug]/p/[id]/slides/page.tsx').default,Layout=load('src/components/shodan/ShodanAppLayout.tsx').default,c=document.createElement('div');document.body.append(c);const r=createRoot(c),act=fn=>React.act(async()=>{await fn();for(let n=0;n<12;n++)await new Promise(setImmediate)}),props=e=>e[Object.keys(e).find(k=>k.startsWith('__reactProps$'))]
;(async()=>{await act(()=>r.render(React.createElement(React.StrictMode,null,React.createElement(Layout,{orgSlug:'alpha',organizationPlan:'PRO',canManageBilling:true},React.createElement(Page)))))
const button=[...c.querySelectorAll('button')].find(b=>b.textContent.includes(pdfMode?'PDF\u3067\u30c0\u30a6\u30f3\u30ed\u30fc\u30c9':'\u3053\u306e\u6307\u793a\u3067\u518d\u751f\u6210')),click=props(button).onClick
await act(()=>{click();if(!unmountOnly)click()});if(unmountOnly)await act(()=>r.unmount())
resolve(Response.json({success:true,data:{index:0,image:{title:'Slide',role:'cover',imageUrl:'https://images.example.invalid/updated.png'}}}));await act(()=>{})
const evidence={sourceCommit:'28ed5de2a33bb2cf7a20b3bc23c4995037525fa3',mode:pdfMode?(unmountOnly?'pdf-unmount':'pdf-same-turn'):unmountOnly?'unmount':'same-turn',writes,notices,downloads,scope:'Actual mounted editor and AppLayout with actual bounded client and synthetic HTTP. No paid providers, DB writes or customer data. Editor source unchanged in current detail candidate.'}
fs.writeFileSync(path.join(__dirname,pdfMode?(unmountOnly?'shodan-slide-editor-pdf-unmount-baseline.json':'shodan-slide-editor-pdf-double-baseline.json'):unmountOnly?'shodan-slide-editor-unmount-baseline.json':'shodan-slide-editor-double-baseline.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence))
if(!unmountOnly)await act(()=>r.unmount());dom.window.close();assert.equal(pdfMode?downloads.length:unmountOnly?notices.length:writes.length,unmountOnly?0:1,unmountOnly?'Unmounted editor must not announce old generation':'Same-turn regeneration must send one request')
})().catch(e=>{console.error(e);process.exitCode=1;dom.window.close()})
