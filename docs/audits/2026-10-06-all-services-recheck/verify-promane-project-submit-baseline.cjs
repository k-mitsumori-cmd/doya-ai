process.env.NODE_ENV='test';
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict'),ts=require('typescript'),React=require('react'),{JSDOM}=require('jsdom');
const {load}=require('../../../scripts/security-regression/load-typescript.cjs');
const dom=new JSDOM('<body/>',{url:'https://example.invalid'});global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=require('react-dom/client');
let calls=[],successes=[],pushes=[],refreshes=0,createImpl,updateImpl;
const Noop=()=>null,element=tag=>({children,variant,...props})=>React.createElement(tag,props,children);
const Select=({name,defaultValue,children})=>React.createElement('div',null,name?React.createElement('input',{name,type:'hidden',value:defaultValue||'',readOnly:true}):null,children);
const mocks={'react':React,'react/jsx-runtime':require('react/jsx-runtime'),'@/lib/promane/time-input':load('src/lib/promane/time-input.ts'),
 'next/navigation':{useRouter:()=>({refresh:()=>refreshes++,push:path=>pushes.push(path),back(){}})},
 '@/lib/service-limit-ui':{showServiceLimit(){}},'@/lib/promane/actions-projects':{createProject:async(...args)=>{calls.push({kind:'create',args});return createImpl(...args)},updateProject:async(...args)=>{calls.push({kind:'update',args});return updateImpl(...args)}},
 '@/components/promane/ui/button':{Button:element('button')},'@/components/promane/ui/input':{Input:element('input')},'@/components/promane/ui/label':{Label:element('label')},'@/components/promane/ui/textarea':{Textarea:element('textarea')},
 '@/components/promane/ui/select':{Select,...Object.fromEntries(['SelectContent','SelectItem','SelectTrigger','SelectValue'].map(n=>[n,Noop]))},
 '@/components/promane/ui/card':{Card:element('div'),CardContent:element('div')},'@/lib/promane/format':{PROJECT_STATUS_LABELS:{draft:'Draft'},BILLING_TYPE_LABELS:{fixed:'Fixed'}},sonner:{toast:{success:m=>successes.push(m),error(){}}},'next/image':{__esModule:true,default:Noop},'lucide-react':{AlertCircle:Noop}};
const file='src/components/promane/project-form.tsx',exportsForView={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports:exportsForView,require:n=>{if(n in mocks)return mocks[n];throw Error(n)},FormData:dom.window.FormData,console},{filename:file});
const props=e=>e[Object.keys(e).find(k=>k.startsWith('__reactProps$'))];
const act=fn=>React.act(async()=>{await fn();for(let i=0;i<6;i++)await new Promise(setImmediate)});
const project=id=>({id,updatedAt:new Date('2026-09-01T00:00:00.000Z'),name:'Project '+id,clientId:null,description:null,status:'draft',billingType:'fixed',contractAmount:0,monthlyAmount:null,hourlyRate:null,estimatedHours:null,startDate:null,endDate:null,tags:null});
async function mount(initial){calls=[];successes=[];pushes=[];refreshes=0;const div=document.createElement('div');document.body.append(div);const root=createRoot(div);let current=initial;
 const render=()=>root.render(React.createElement(React.StrictMode,null,React.createElement(exportsForView.ProjectForm,{workspaceSlug:'synthetic',clients:[],project:current})));await act(render);
 const form=div.querySelector('form');if(!initial)form.querySelector('[name=name]').value='Synthetic project';
 return{div,form,render,setProject(p){current=p},async close(){await act(()=>root.unmount());div.remove()}};
}
(async()=>{let item;const cases=[];try{
 item=await mount();let resolvers=[];createImpl=()=>new Promise(resolve=>resolvers.push(resolve));const submit=props(item.form).onSubmit,waits=[];
 await act(()=>{waits.push(submit({preventDefault(){},currentTarget:item.form}));waits.push(submit({preventDefault(){},currentTarget:item.form}))});assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);
 await act(async()=>{resolvers.forEach((resolve,i)=>resolve({id:'created-'+i}));await Promise.all(waits)});assert.equal(successes.length,2);assert.equal(pushes.length,2);cases.push({finding:'same-frame project creation sends two identical actions',actionCalls:2,successToasts:2});
 await item.close();item=await mount();createImpl=async()=>({});await act(()=>props(item.form).onSubmit({preventDefault(){},currentTarget:item.form}));assert.equal(successes.length,1);assert.equal(pushes[0],'/promane/synthetic/projects/undefined');cases.push({finding:'empty create acknowledgement reports success and navigates to undefined project',path:pushes[0]});
 await item.close();item=await mount(project('a'));updateImpl=async()=>null;await act(()=>props(item.form).onSubmit({preventDefault(){},currentTarget:item.form}));assert.equal(successes.length,1);assert.equal(pushes[0],'/promane/synthetic/projects/a');cases.push({finding:'null update acknowledgement still reports success and leaves form',successToasts:1});
 await item.close();item=await mount(project('a'));item.form.querySelector('[name=name]').value='Private draft A';item.setProject(project('b'));await act(item.render);updateImpl=async()=>project('b');await act(()=>props(item.form).onSubmit({preventDefault(){},currentTarget:item.form}));assert.equal(calls[0].args[1],'b');assert.equal(calls[0].args[2].name,'Private draft A');cases.push({finding:'same-mounted project change submits prior uncontrolled draft under new project ID',conditional:'Actual Next navigation remount behavior not established'});
 const report={checkedAt:new Date().toISOString(),expected:4,passed:cases.length,cases,sourceHashes:{[file]:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')},scope:'Actual ProjectForm in React StrictMode, real FormData, synthetic actions/navigation and select shells. Does not establish database duplicates, real Next transport, authenticated production impact or production remount behavior.'};
 fs.writeFileSync('docs/audits/2026-10-06-all-services-recheck/promane-project-submit-baseline.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{if(item)await item.close();dom.window.close()}})().catch(e=>{console.error(e);process.exitCode=1});
