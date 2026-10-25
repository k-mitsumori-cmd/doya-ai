// 複数ツールを同時に動かすエージェント（旗 AGENT_ORCHESTRATION_ROLLOUT）の回帰テスト。
// - 旗が off（既定・値なし・知らない値）のとき: セッションを読まない。作業の API は 404 で、どのツールも呼ばない
// - preview のとき: UI_PREVIEW_EMAILS で許可した人だけ。all でも未ログインには出さない
// - 作業の API は、画面から届いた答えをサーバーで確かめ、決まった作業だけを動かす（知らない作業・壊れた答えは 400）
// - 各ツールは、決まった5つのルートの export された POST（ドヤパワーの包みの外側）だけを、本人の cookie を付けて呼ぶ
// - 見本の結果への差し替えは、本番（NODE_ENV=production）では値があっても効かない
// - 作戦の API は、質問 → 作戦（減るドヤパワーは costs.ts から）を返し、AI を呼ばない
// - 経営ホームの画面のファイルには、まだつながない（UIリニューアルが型でつなぐ）。見本の画面は開発の確認ページだけ
// 値はすべてテストの中で渡す。git・DB・課金・外部 API・AI には触れない。
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{load,check}=require('./load-typescript.cjs');
const root=path.resolve(__dirname,'../..');
const ts=require(path.join(root,'node_modules/typescript'));
const nextServer=require(path.join(root,'node_modules/next/server'));
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const ALLOWED='owner@example.invalid';
const OFF_VALUES=[undefined,'','off','OFF',' on ','true','1','yes'];

function loadTs(file,mocks={},env={}){
  const exports={};const module={exports};
  const out=ts.transpileModule(read(file),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const req=n=>{if(n in mocks)return mocks[n];throw Error('Unmocked '+n)};
  vm.runInNewContext(out,{exports,module,require:req,URL,Request,Response,Headers,Buffer,Date,Set,Map,Error,Promise,Object,Array,Number,String,Math,JSON,Symbol,Proxy,AbortController,setTimeout,clearTimeout,TextEncoder,TextDecoder,ReadableStream,process:{env},console:{log(){},warn(){},error(){}}},{filename:file});
  return module.exports;
}
function sessionMock(email,counter){
  return {getServerSession:async()=>{counter&&counter.push('session');if(email===Symbol.for('throw'))throw Error('boom');return email===undefined?null:{user:{email,id:'u_1'}}}};
}
function loadFlag(env,email,counter){
  const uiNext=load('src/lib/ui-next.ts',{},{process:{env},Promise});
  return loadTs('src/lib/agent-orchestration/flag.ts',{'@/lib/ui-next':uiNext,'next-auth':sessionMock(email,counter),'@/lib/auth':{authOptions:{}}},env);
}
const envOf=(rollout)=>{const e={UI_NEXT_ROLLOUT:'all',UI_PREVIEW_EMAILS:ALLOWED,UI_SHELL_SERVICES:'all'};if(rollout!==undefined)e.AGENT_ORCHESTRATION_ROLLOUT=rollout;return e};

function loadCore(){
  const runner=loadTs('src/lib/agent-orchestration/runner.ts');
  const recipes=loadTs('src/lib/agent-orchestration/recipes.ts');
  const tools=loadTs('src/lib/agent-orchestration/tools.ts',{'./runner':runner,'./recipes':recipes,'@/lib/doya-power/costs':loadTs('src/lib/doya-power/costs.ts')});
  return {runner,recipes,tools};
}
function loadTaskRoute(env,email,log){
  const core=loadCore();
  const flag=loadFlag(env,email,log);
  const deps={shodanSlug:async()=>'acme',call:async(route,body)=>{log.push('call:'+route);if(route==='slide.structure')return {status:502,data:{error:'構成の生成に失敗しました。もう一度お試しください。'}};return core.tools.fakeToolDeps({delayMs:0}).call(route,body)}};
  return loadTs('src/app/api/agent/tasks/route.ts',{
    'next/server':nextServer,
    '@/lib/agent-orchestration/flag':flag,
    '@/lib/agent-orchestration/recipes':core.recipes,
    '@/lib/agent-orchestration/runner':core.runner,
    '@/lib/agent-orchestration/tools':core.tools,
    '@/lib/agent-orchestration/routes.server':{toolDepsFor:()=>{log.push('deps');return deps}},
    '@/lib/operational-json':{readOperationalJson:async(r)=>{log.push('body');return r.json()}},
  },env);
}
const answers={url:'https://example.co.jp',offer:'web',budget:'50to200',stage:'proposal'};
const taskReq=(body)=>new nextServer.NextRequest('https://doya-ai.example.invalid/api/agent/tasks',{method:'POST',headers:{'content-type':'application/json',cookie:'next-auth.session-token=s'},body:JSON.stringify(body)});

(async()=>{
  await check('Agent orchestration flag: off is the default; only preview and all turn it on',async()=>{
    for(const v of OFF_VALUES)assert.equal(loadFlag(envOf(v)).agentOrchestrationRollout(),'off',String(v));
    assert.equal(loadFlag(envOf('preview')).agentOrchestrationRollout(),'preview');
    assert.equal(loadFlag(envOf(' ALL ')).agentOrchestrationRollout(),'all');
  });
  await check('Agent orchestration flag: off never reads the session; preview shows only allowed emails; all still needs a signed-in user',async()=>{
    for(const v of OFF_VALUES){
      const seen=[];
      assert.equal(await loadFlag(envOf(v),ALLOWED,seen).isAgentOrchestrationEnabled(),false,String(v));
      assert.equal(seen.length,0,'session must not be read when off: '+String(v));
    }
    for(const email of ['other@example.invalid','',undefined,Symbol.for('throw')]){
      assert.equal(await loadFlag(envOf('preview'),email).isAgentOrchestrationEnabled(),false,String(email));
    }
    assert.equal(await loadFlag(envOf('preview'),'OWNER@example.invalid').isAgentOrchestrationEnabled(),true);
    assert.equal(await loadFlag({AGENT_ORCHESTRATION_ROLLOUT:'preview',UI_PREVIEW_EMAILS:''},ALLOWED).isAgentOrchestrationEnabled(),false);
    assert.equal(await loadFlag(envOf('all'),'other@example.invalid').isAgentOrchestrationEnabled(),true);
    assert.equal(await loadFlag(envOf('all'),undefined).isAgentOrchestrationEnabled(),false);
  });

  await check('Agent tasks API: 404 when off or not allowed, without reading the body or calling any tool',async()=>{
    for(const [env,email] of [...OFF_VALUES.map(v=>[envOf(v),ALLOWED]),[envOf('preview'),'other@example.invalid'],[envOf('preview'),undefined]]){
      const log=[];
      const res=await loadTaskRoute(env,email,log).POST(taskReq({recipeId:'sales-prep',taskId:'research',answers}));
      assert.equal(res.status,404);
      assert.deepEqual(log.filter(l=>l!=='session'),[],JSON.stringify(log));
    }
  });
  await check('Agent tasks API: rejects unknown work and broken answers before calling a tool',async()=>{
    for(const body of [{recipeId:'x',taskId:'research',answers},{recipeId:'sales-prep',taskId:'banner',answers},{recipeId:'sales-prep',taskId:'research',answers:{...answers,url:'javascript:alert(1)'}},{recipeId:'sales-prep',taskId:'quote',answers:{...answers,budget:'9999'}}]){
      const log=[];
      const res=await loadTaskRoute(envOf('preview'),ALLOWED,log).POST(taskReq(body));
      assert.equal(res.status,400,JSON.stringify(body));
      assert.equal(log.some(l=>l.startsWith('call:')||l==='deps'),false);
    }
  });
  await check('Agent tasks API: runs one tool per request and returns the result or a user-facing failure',async()=>{
    let log=[];
    let res=await loadTaskRoute(envOf('preview'),ALLOWED,log).POST(taskReq({recipeId:'sales-prep',taskId:'quote',answers}));
    assert.equal(res.status,200);
    const ok=await res.json();
    assert.equal(ok.result.href,'/quote/documents/quote_sample');
    assert.deepEqual(log.filter(l=>l.startsWith('call:')),['call:quote.suggest','call:quote.create']);
    log=[];
    res=await loadTaskRoute(envOf('all'),ALLOWED,log).POST(taskReq({recipeId:'sales-prep',taskId:'slides',answers,resume:{projectId:'p_1',route:'../x'}}));
    assert.equal(res.status,422);
    const bad=await res.json();
    assert.equal(bad.error,'構成の生成に失敗しました。もう一度お試しください。');
    assert.deepEqual(bad.resume,{projectId:'p_1'});
    // やり直しの材料があるときは、プロジェクトを作り直さない
    assert.deepEqual(log.filter(l=>l.startsWith('call:')),['call:slide.structure']);
    // やり直しの材料の id は決まった形だけ
    log=[];
    await loadTaskRoute(envOf('all'),ALLOWED,log).POST(taskReq({recipeId:'sales-prep',taskId:'slides',answers,resume:{projectId:'../../etc'}}));
    assert.deepEqual(log.filter(l=>l.startsWith('call:')),['call:slide.project','call:slide.structure']);
  });

  await check('Agent tool routes: only the five fixed routes, called through their exported POST with the same cookie',async()=>{
    const seen=[];
    const mod=(name)=>({POST:async(req)=>{seen.push({name,path:new URL(req.url).pathname,cookie:req.headers.get('cookie'),body:await req.json()});return Response.json({ok:true},{status:201,headers:name==='suggest'?{'x-doya-power-op':'op-1'}:{}})}});
    const tools=loadCore().tools;
    const rs=loadTs('src/lib/agent-orchestration/routes.server.ts',{
      'next/server':nextServer,'./tools':tools,
      '@/app/api/shodan/preparations/route':mod('shodan'),
      '@/app/api/quote/documents/suggest/route':mod('suggest'),
      '@/app/api/quote/documents/route':mod('quote'),
      '@/app/api/doyaslide/projects/route':mod('project'),
      '@/app/api/doyaslide/structure/route':mod('structure'),
      '@/lib/shodan/access':{getShodanContext:async()=>({organizationSlug:'acme'})},
      '@/lib/doya-power/retry':{DOYA_POWER_OP_HEADER:'x-doya-power-op'},
      './sources.server':{doyaPowerOnForRequest:async()=>true},
    },{NODE_ENV:'production',AGENT_ORCHESTRATION_FAKE_TOOLS:'1'});
    const outer=new nextServer.NextRequest('https://doya-ai.example.invalid/api/agent/tasks',{method:'POST',headers:{cookie:'next-auth.session-token=s'}});
    const keys=[];
    for(const id of ['shodan.prepare','quote.suggest','quote.create','slide.project','slide.structure']){
      const r=await rs.callToolRoute(outer,id,{a:1});
      assert.equal(r.status,201);
      keys.push(r.opKey);
    }
    // ドヤパワーの包みが付けた操作のキーを、そのまま返す（減ったままかどうかを数えるため）
    assert.deepEqual(keys,[null,'op-1',null,null,null]);
    assert.deepEqual(seen.map(s=>s.path),['/api/shodan/preparations','/api/quote/documents/suggest','/api/quote/documents','/api/doyaslide/projects','/api/doyaslide/structure']);
    assert.ok(seen.every(s=>s.cookie==='next-auth.session-token=s'&&s.body.a===1));
    await assert.rejects(()=>rs.callToolRoute(outer,'../admin',{}));
    // 本番では、見本の結果に差し替えない（値があっても）
    assert.equal(rs.fakeToolsEnabled({NODE_ENV:'production',AGENT_ORCHESTRATION_FAKE_TOOLS:'1'}),false);
    assert.equal(rs.fakeToolsEnabled({NODE_ENV:'development',AGENT_ORCHESTRATION_FAKE_TOOLS:'1'}),true);
    assert.equal(rs.fakeToolsEnabled({NODE_ENV:'development'}),false);
    const deps=await rs.toolDepsFor(outer);
    assert.equal(await deps.shodanSlug(),'acme');
    assert.equal(deps.powerOn,true);
  });

  function loadPlanRoute(env,email,log,readers){
    const core=loadCore();
    const types=loadTs('src/lib/agent-orchestration/types.ts');
    const plan=loadTs('src/lib/agent-orchestration/plan.ts',{'@/lib/doya-power/costs':loadTs('src/lib/doya-power/costs.ts'),'./runner':core.runner,'./types':types});
    const sources=loadTs('src/lib/agent-orchestration/sources.ts');
    const fallback={company:async()=>{log.push('read:company');return 'サンプル株式会社'},toolOrgs:async()=>{log.push('read:tools');return {shodan:true,quote:false}},power:async()=>{log.push('read:power');return {enabled:true,remaining:120,nextRecoveryAt:null}}};
    return loadTs('src/app/api/agent/plan/route.ts',{
      'next/server':nextServer,
      '@/lib/agent-orchestration/flag':loadFlag(env,email,log),
      '@/lib/agent-orchestration/recipes':core.recipes,
      '@/lib/agent-orchestration/plan':plan,
      '@/lib/agent-orchestration/sources':sources,
      '@/lib/agent-orchestration/sources.server':{realSourceReaders:()=>readers||fallback},
      '@/lib/operational-json':{readOperationalJson:async(r)=>{log.push('body');return r.json()}},
    },env);
  }
  const planReq=(body)=>new nextServer.NextRequest('https://doya-ai.example.invalid/api/agent/plan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  await check('Agent plan API: 404 when off or not allowed; otherwise questions, then a plan with Doya Power from costs.ts (no AI)',async()=>{
    for(const [env,email] of [...OFF_VALUES.map(v=>[envOf(v),ALLOWED]),[envOf('preview'),'other@example.invalid']]){
      const log=[];
      const res=await loadPlanRoute(env,email,log).POST(planReq({recipeId:'sales-prep',answers}));
      assert.equal(res.status,404);
      assert.equal(log.some(l=>l==='body'||l.startsWith('read:')),false,JSON.stringify(log));
    }
    const route=loadPlanRoute(envOf('preview'),ALLOWED,[]);
    assert.deepEqual(await (await route.POST(planReq({text:'今月の売上は？'}))).json(),{kind:'none'});
    const q=await (await route.POST(planReq({text:'来週の商談の準備をしたい'}))).json();
    assert.equal(q.kind,'questions');
    assert.deepEqual(q.questions.map(x=>x.id),['url','offer','budget','stage']);
    const bad=await (await route.POST(planReq({recipeId:'sales-prep',answers:{...answers,url:''}}))).json();
    assert.equal(bad.kind,'questions');
    assert.equal(bad.error.questionId,'url');
    const ok=await (await route.POST(planReq({recipeId:'sales-prep',answers}))).json();
    assert.equal(ok.kind,'plan');
    assert.equal(ok.plan.version,2);
    const tasks=ok.plan.pillars.flatMap(p=>p.tasks);
    assert.deepEqual(tasks.map(t=>[t.id,t.action,t.power]),[['research','shodan.research',0],['quote','quote.draft',1],['slides','slide.structure',30]]);
    // 見積もりAIの組織が無い → その ToDo は任せない初期値。合計は任せる ToDo だけ
    assert.equal(tasks[1].delegate,false);
    assert.equal(tasks[1].ready.href,'/quote');
    assert.equal(ok.plan.totalPower,30);
    assert.deepEqual([ok.plan.goal.now,ok.plan.goal.target,ok.plan.goal.gap],[0,3,3]);
    assert.ok(ok.plan.reasons.length>=3);
    assert.ok(ok.plan.pillars.every(p=>p.teamGoal));
    assert.deepEqual(ok.sources.map(s=>[s.id,s.status]),[['request','read'],['company','read'],['tools','read'],['power','read']]);
    assert.deepEqual(ok.power,{enabled:true,remaining:120,nextRecoveryAt:null});
  });
  await check('Agent plan API: streams sources (reading → read), reasons and the result as NDJSON',async()=>{
    const route=loadPlanRoute(envOf('preview'),ALLOWED,[]);
    const res=await route.POST(new nextServer.NextRequest('https://doya-ai.example.invalid/api/agent/plan',{method:'POST',headers:{'content-type':'application/json',accept:'application/x-ndjson'},body:JSON.stringify({recipeId:'sales-prep',answers})}));
    assert.match(res.headers.get('content-type'),/application\/x-ndjson/);
    const events=(await res.text()).trim().split('\n').map(l=>JSON.parse(l));
    const src=events.filter(e=>e.type==='source');
    assert.equal(src.filter(e=>e.source.status==='reading').length,4);
    assert.equal(src.filter(e=>e.source.status==='read').length,4);
    assert.ok(events.findIndex(e=>e.type==='reason')>events.findIndex(e=>e.type==='source'&&e.source.status==='read'));
    assert.equal(events.at(-1).type,'result');
    assert.equal(events.at(-1).response.kind,'plan');
    // 作れなかったときは error で終わる（古い振り分けに黙って戻さない）
    const broken=loadPlanRoute(envOf('preview'),ALLOWED,[],{company:async()=>null,toolOrgs:async()=>({shodan:true,quote:true}),power:async()=>({enabled:false,remaining:null,nextRecoveryAt:null})});
    const ok2=(await (await broken.POST(new nextServer.NextRequest('https://doya-ai.example.invalid/api/agent/plan',{method:'POST',headers:{accept:'application/x-ndjson'},body:JSON.stringify({recipeId:'sales-prep',answers})}))).text()).trim().split('\n').map(l=>JSON.parse(l));
    assert.equal(ok2.at(-1).type,'result');
    assert.equal(ok2.find(e=>e.type==='source'&&e.source.id==='company'&&e.source.status!=='reading').source.status,'skipped');
  });

  await check('Agent orchestration: the home screen is left to the UI renewal; the sample screen is dev-only and behind the flag',async()=>{
    // 経営ホームの画面のファイルには、まだつながない（UIリニューアルの src/components/home-agent/ が型でつなぐ）
    for(const f of ['src/app/(shell)/home/HomeDashboard.tsx','src/app/(shell)/home/page.tsx']){
      assert.equal(/agent-orchestration/.test(read(f)),false,f);
    }
    const lab=read('src/app/(shell)/home/agent-lab/page.tsx');
    assert.match(lab,/process\.env\.NODE_ENV === 'production' \|\| agentOrchestrationRollout\(\) === 'off'\) notFound\(\)/);
    assert.match(lab,/executor="sample"/);
    // 作業と作戦の API は、旗を見てから本文を読む
    for(const f of ['src/app/api/agent/tasks/route.ts','src/app/api/agent/plan/route.ts']){
      const src=read(f);
      assert.ok(src.indexOf('isAgentOrchestrationEnabled()')>0&&src.indexOf('isAgentOrchestrationEnabled()')<src.indexOf('readOperationalJson(req'),f);
    }
    // ツールへの入力は、サーバーで確かめた答えから作る（画面の値で道すじを選ばない）
    const tools=read('src/lib/agent-orchestration/tools.ts');
    assert.equal(/from '@\/app\/api/.test(tools),false);
    assert.equal(/fetch\(/.test(tools),false);
  });
})().catch(e=>{console.error(e);process.exit(1)});
