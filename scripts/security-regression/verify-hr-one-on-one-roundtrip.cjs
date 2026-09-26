const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
const read=f=>fs.readFileSync(f,'utf8');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function load(f,deps){const exports={};vm.runInNewContext(compile(read(f)),{exports,Date,require:n=>{if(n in deps)return deps[n];throw Error(n)}});return exports;}
function callback(f,name){const s=read(f),a=ts.createSourceFile('x.tsx',s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let c;function walk(n){if(ts.isVariableDeclaration(n)&&n.name.getText(a)===name)c=n.initializer.getText(a);ts.forEachChild(n,walk)}walk(a);if(!c)throw Error(name);return compile('('+c+')');}
(async()=>{
let row={id:'one',organizationId:'o',employeeId:'employee',scheduledAt:new Date('2026-09-21T01:00:00Z'),conductedAt:null,duration:30,agenda:[],managerNotes:null,employeeNotes:null,privateNotes:null,aiActionItems:[],aiInsights:[],employee:{firstName:'太郎',lastName:'架空'},manager:{firstName:'花子',lastName:'合成'}},patchData,display={id:'one'},aiResult,modelCalls=0,usage=0;
const errors=[],statuses=[];
const deps={'next/server':{NextResponse:Response},'next-auth':{getServerSession:async()=>({user:{id:'u'}})},'@/lib/auth':{authOptions:{}},'@/lib/hr/one-on-one-access':{canAccessOneOnOne:async()=>true,getOneOnOneViewer:async()=>({employeeId:null}),canViewManagerNotes:()=>true,filterOneOnOneFields:r=>({...r,canViewManagerNotes:true})},'@/lib/hr/access':{getHrContext:async()=>({organizationId:'o'})},'@/lib/prisma':{prisma:{hrOneOnOne:{findFirst:async({where})=>where.id===row.id&&where.organizationId===row.organizationId?row:null,update:async({where,data})=>{if(where.id!==row.id)throw Error('wrong id');patchData=data;row={...row,...data};return row}}}},'@seo/lib/gemini':{GEMINI_TEXT_MODEL_DEFAULT:'synthetic',geminiGenerateText:async()=>{modelCalls++;return '合成要約'}},'@/lib/hr/prompts':load('src/lib/hr/prompts.ts',{}),'@/lib/hr/billing':{reserveAiUsage:async()=>{usage++;return{granted:true,reservation:{organizationId:'o',resetAt:new Date()}}},releaseAiUsage:async()=>{usage--}}};
const api=load('src/app/api/hr/one-on-one/[id]/route.ts',deps),ai=load('src/app/api/hr/one-on-one/[id]/ai-summary/route.ts',deps),ctx={params:Promise.resolve({id:'one'})};
const fetch=async(url,o)=>{const req={json:async()=>JSON.parse(o.body)};const res=await(url.endsWith('/ai-summary')?ai.POST(req,ctx):api.PATCH(req,ctx));statuses.push({url,status:res.status});return res;};
const pageSave=vm.runInNewContext(callback('src/app/hr/one-on-one/[id]/page.tsx','handleSave'),{id:'one',fetch,setRecord:x=>display=typeof x==='function'?x(display):x});
const state={canViewManagerNotes:true,readOnly:false,savingRef:{current:false},aiLoadingRef:{current:false},recordId:'one',employeeId:'employee',date:'2026-09-22T10:00',duration:45,agenda:[{id:'agenda',topic:'新しい議題',category:'BUSINESS'}],managerNote:'新しい上司メモ',sharedNote:'新しい共有メモ',actionItems:[{id:'action',content:'次回までの新しい宿題',assignee:'社員',dueDate:'2026-09-30',done:false}],onSave:pageSave,setSaving(){},toast:{error:m=>errors.push(m)},fetch,setAiResult:x=>aiResult=x,setAiLoading(){}};
state.handleSave=vm.runInNewContext(callback('src/components/hr/OneOnOneForm.tsx','handleSave'),state);
await state.handleSave();
const savedFields=Object.keys(patchData),saved=(await(await api.GET({},ctx)).json()).oneOnOne;
const results=[];function result(name,ok,details){results.push({name,outcome:ok?'PASS':'FAIL',...details});}
result('duration survives save and GET',saved.duration===45,{actual:saved.duration});
result('agenda survives save and GET',saved.agenda[0]?.topic==='新しい議題',{actual:saved.agenda});
result('date survives save and GET',saved.date===state.date||saved.scheduledAt?.startsWith('2026-09-22'),{submitted:state.date,actual:saved.scheduledAt,uiDate:saved.date??null});
for(const key of ['managerNote','sharedNote','actionItems']){const expected=key==='actionItems'?state[key][0].content:state[key];result(key+' survives save and GET',JSON.stringify(saved).includes(expected),{submitted:state[key],uiProp:saved[key]??null});}
await vm.runInNewContext(callback('src/components/hr/OneOnOneForm.tsx','handleAiSummary'),state)();
result('summary after saving nonempty notes',statuses.at(-1).status===200,{status:statuses.at(-1).status,aiResult,modelCalls,usage});
await api.PATCH({json:async()=>({managerNotes:'APIで保存した議事録'})},ctx);
await vm.runInNewContext(callback('src/components/hr/OneOnOneForm.tsx','handleAiSummary'),state)();
result('supported API note control permits summary',statuses.at(-1).status===200&&modelCalls===2,{status:statuses.at(-1).status,modelCalls,usage,aiResult});
const output={scope:'Actual form/page callbacks, PATCH, GET, AI route and prompt builder; synthetic auth/DB/model/billing. No browser or production changes.',savedFields,saveStatus:statuses[0].status,uiErrors:errors,results};
if(results.some(r=>r.outcome!=='PASS'))process.exitCode=1;console.log(JSON.stringify(output,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
