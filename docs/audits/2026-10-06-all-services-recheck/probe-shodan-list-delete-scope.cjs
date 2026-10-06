// Actual list page; synthetic transport only. No production data or destructive request.
process.env.NODE_ENV='test'
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),root=process.cwd(),req=n=>require(path.join(root,'node_modules',n)),React=req('react'),ts=req('typescript'),{JSDOM}=req('jsdom'),{load}=require(path.join(root,'scripts/security-regression/load-typescript.cjs'))
const dom=new JSDOM('<body></body>',{url:'https://example.invalid'});global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true
const{createRoot}=req('react-dom/client');let org='alpha',writes=[],resolveDelete
const pendingDelete=new Promise(r=>resolveDelete=r),items=scope=>Array.from({length:100},(_,i)=>i+1).map(i=>({id:scope+'-'+i,targetUrl:'https://example.invalid',targetName:scope+' '+i,status:'done',createdAt:'2026-10-07T00:00:00.000Z',updatedAt:'2026-10-07T00:00:00.000Z'})),exportsPage={}
const source=fs.readFileSync('src/app/shodan/[orgSlug]/page.tsx','utf8')
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports:exportsPage,require:n=>{
 if(n==='react'||n==='react/jsx-runtime')return req(n)
 if(n==='next/link')return{__esModule:true,default:({children,href,...p})=>React.createElement('a',{href,...p},children)}
 if(n==='next/navigation')return{useParams:()=>({orgSlug:org})}
 if(n==='@/lib/shodan/client')return{shodanGet:async(url,scope)=>url.includes('company-profile')?{profile:{}}:{items:items(scope),nextCursor:scope+'-100',total:101},shodanSend:async(url,scope,method)=>{writes.push({url,scope,method});await pendingDelete;return{success:true}}}
 if(n==='@/lib/shodan/preparation-pages')return load('src/lib/shodan/preparation-pages.ts')
 if(n==='@/components/shodan/ui')return{DoyaKun:()=>null,sym:()=>null}
 if(n==='react-hot-toast')return{__esModule:true,default:{error:()=>{}}}
 throw Error(n)
},URL,Date,Set,Map,Error,confirm:()=>true,setInterval,clearInterval})
const c=document.createElement('div');document.body.append(c);const r=createRoot(c),Page=exportsPage.default
const act=fn=>React.act(async()=>{await fn();for(let i=0;i<10;i++)await new Promise(setImmediate)}),render=()=>r.render(React.createElement(Page)),props=e=>e[Object.keys(e).find(k=>k.startsWith('__reactProps$'))]
;(async()=>{await act(render);const old=props(c.querySelector('button[title="削除"]')).onClick;await act(()=>{void old()});org='beta';await act(render);const before=c.textContent;await act(()=>resolveDelete());const after=c.textContent;assert.match(before,/100 \/ 101/);assert.match(after,/100 \/ 100/);console.log(JSON.stringify({status:'confirmed-open',case:'Old org deletion completion corrupts current org total',deleteRequests:writes,currentScope:org,beforeTotal:'100 / 101',afterTotal:'100 / 100',scope:'Actual mounted list with synthetic HTTP/session; no actual DB deletion or private production request.'},null,2));await act(()=>r.unmount())})().catch(e=>{console.error(e);process.exitCode=1})
