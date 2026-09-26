const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const {load,check,results}=require('./load-typescript.cjs');
const source=fs.readFileSync('src/components/hr/OneOnOneForm.tsx','utf8'),ast=ts.createSourceFile('form.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),callbacks={};
function visit(n){if(ts.isVariableDeclaration(n)&&['handleSave','handleAiSummary','handleManualSave'].includes(n.name.getText(ast)))callbacks[n.name.getText(ast)]=n.initializer.getText(ast);ts.forEachChild(n,visit)}visit(ast);
(async()=>{
 for(const mode of ['normal','save-failed','duplicate','readonly','saving'])await check('1on1 summary '+mode,async()=>{
  const order=[];let message,release;const gate=new Promise(r=>release=r);
  const env={canViewManagerNotes:true,readOnly:mode==='readonly',savingRef:{current:mode==='saving'},aiLoadingRef:{current:false},recordId:'r',date:'2026-09-20T10:00',duration:30,employeeId:'e',agenda:[],managerNote:'Current notes',sharedNote:'Shared',actionItems:[],setSaving(){},setAiLoading(){},setAiResult:v=>message=v,toast:{error(){}},onSave:async()=>{order.push('save');if(mode==='duplicate')await gate;if(mode==='save-failed')throw Error('Failed')},fetch:async()=>{order.push('ai');return Response.json({aiSummary:'Summary'})}};
  for(const [name,code]of Object.entries(callbacks))env[name]=vm.runInNewContext(ts.transpileModule('('+code+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,env);
  const first=env.handleAiSummary();
  if(mode==='duplicate'){await env.handleAiSummary();await env.handleManualSave();assert.deepEqual(order,['save']);release()}
  await first;
  assert.deepEqual(order,['readonly','saving'].includes(mode)?[]:mode==='save-failed'?['save']:['save','ai']);
  if(mode==='save-failed')assert.match(message,/保存できなかった/);
 });
 for(const endpoint of ['edit','ai'])for(const mode of ['completed','race','normal',...(endpoint==='ai'?['quota']:[])])await check(endpoint+' '+mode,async()=>{
  let writes=0,calls=0;
  const row={id:'r',status:mode==='completed'?'COMPLETED':'SCHEDULED',updatedAt:new Date('2026-09-20T00:00:00Z'),managerNotes:'Notes',employeeNotes:'Notes',agenda:[],employee:{firstName:'A',lastName:'E'},manager:{firstName:'B',lastName:'M'}};
  const deps={'next/server':{NextResponse:Response},'next-auth':{getServerSession:async()=>({user:{id:'u'}})},'@/lib/auth':{authOptions:{}},'@/lib/hr/one-on-one-access':{canAccessOneOnOne:async()=>true,getOneOnOneViewer:async()=>({employeeId:null}),canViewManagerNotes:()=>true,filterOneOnOneFields:r=>({...r,canViewManagerNotes:true})},'@/lib/hr/access':{getHrContext:async()=>({organizationId:'o',role:'ADMIN'})},'@/lib/prisma':{prisma:{hrOneOnOne:{findFirst:async()=>row,update:async({where,data})=>{assert.equal(where.status.not,'COMPLETED');if(endpoint==='ai')assert.equal(where.updatedAt.getTime(),row.updatedAt.getTime());if(mode==='race')throw Object.assign(Error('Changed'),{code:'P2025'});writes++;return{...row,...data}}}}},'@/lib/hr/prompts':{buildOneOnOneSummaryPrompt:()=>''},'@seo/lib/gemini':{GEMINI_TEXT_MODEL_DEFAULT:'synthetic',geminiGenerateText:async()=>{calls++;return'Summary'}},'@/lib/hr/billing':{reserveAiUsage:async()=>mode==='quota'?{granted:false,error:'limit'}:{granted:true,reservation:{organizationId:'o',resetAt:new Date()}},releaseAiUsage:async()=>{}}};
  const api=load('src/app/api/hr/one-on-one/[id]/'+(endpoint==='ai'?'ai-summary/':'')+'route.ts',deps);
  const response=await api[endpoint==='ai'?'POST':'PATCH']({json:async()=>({managerNotes:'Updated'})},{params:Promise.resolve({id:'r'})});
  assert.equal(response.status,mode==='normal'?200:mode==='quota'?403:409);assert.equal(writes,mode==='normal'?1:0);if(['completed','quota'].includes(mode))assert.equal(calls,0);
  if(mode==='quota'){const body=await response.json();assert.equal(body.code,'HR_ORG_AI_LIMIT');assert.equal(body.canManageBilling,false)}
 });
 console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
