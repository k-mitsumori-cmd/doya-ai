// 複数ツールを同時に動かすエージェント（旗 AGENT_ORCHESTRATION_ROLLOUT）の回帰テスト。
// - 旗が off（既定・値なし・知らない値）のとき: セッションを読まない。作業の API は 404 で、どのツールも呼ばない
// - preview のとき: UI_PREVIEW_EMAILS で許可した人だけ。all でも未ログインには出さない
// - 作業の API は、画面から届いた答えをサーバーで確かめ、決まった作業だけを動かす（知らない作業・壊れた答えは 400）
// - 各ツールは、決まった5つのルートの export された POST（ドヤパワーの包みの外側）だけを、本人の cookie を付けて呼ぶ
// - 見本の結果への差し替えは、本番（NODE_ENV=production）では値があっても効かない
// - 作戦の API は、質問 → 作戦（減るドヤパワーは costs.ts から）を返し、AI を呼ばない
// - 経営ホームは、旗の内側だけでエージェントの画面を出す（off なら何も出さず、旗のためにセッションを読まない）
// - 画面の部品は、サーバーの部品（読み方・旗・ルート・DB）を読み込まない。見本の画面は本番で 404
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
  const execute=loadTs('src/lib/agent-orchestration/execute.ts',{'./runner':runner,'./recipes':recipes,'./tools':tools});
  return {runner,recipes,tools,execute};
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
    '@/lib/agent-orchestration/execute':core.execute,
    '@/lib/shell/company.server':{currentUserId:async()=>{log.push('user');return email?'u_1':null}},
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

  // 経営ホームの page.tsx を読み込む（JSX は react/jsx-runtime。画面の部品は印だけの関数にする）
  const React=require(path.join(root,'node_modules/react'));
  const jsxRuntime=require(path.join(root,'node_modules/react/jsx-runtime'));
  function loadPage(file,mocks,env){
    const exports={};const module={exports};
    const out=ts.transpileModule(read(file),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText;
    const req=n=>{if(n in mocks)return mocks[n];if(n==='react')return React;if(n==='react/jsx-runtime')return jsxRuntime;if(/\.css$/.test(n))return {};throw Error('Unmocked '+n)};
    vm.runInNewContext(out,{exports,module,require:req,URL,Response,Headers,Date,Set,Map,Error,Promise,Object,Array,Number,String,Math,JSON,Symbol,process:{env},console:{log(){},warn(){},error(){}}},{filename:file});
    return module.exports;
  }
  const exists=f=>fs.existsSync(path.join(root,f));
  const HOME='src/app/(shell)/home/page.tsx';
  await check('Agent orchestration: the home page shows the agent only behind the flag (off: nothing, and the session is not read for it)',async()=>{
    const src=read(HOME);
    if(!/agent-orchestration/.test(src)){
      // 経営ホームにまだつないでいない（このブランチだけのとき）。画面の部品も読み込まない
      assert.equal(/home-agent/.test(src),false);
      return;
    }
    const HomeAgent=function HomeAgent(){return null};
    const HomeDashboard=function HomeDashboard(){return null};
    const render=async(env,email)=>{
      const log=[];
      const page=loadPage(HOME,{
        'next/navigation':{redirect:(to)=>{throw Object.assign(Error('NEXT_REDIRECT'),{to})},notFound:()=>{throw Error('NEXT_NOT_FOUND')}},
        'next-auth':{getServerSession:async()=>({user:{id:'u_1',email,name:'テスト'}})},
        '@/lib/auth':{authOptions:{}},
        '@/lib/home/summary':{getHomeSummary:async()=>({})},
        'next/headers':{cookies:async()=>({get:()=>undefined})},
        './cookies':{SETUP_HIDE_COOKIE:'x'},
        '@/lib/doya-power/flag':{isDoyaPowerEnabled:async()=>false},
        '@/lib/doya-power/home.server':{loadDoyaPowerHome:async()=>null},
        '@/components/doya-power/DoyaPowerHome':{DoyaPowerHomeCard:()=>null},
        './HomeDashboard':{__esModule:true,default:HomeDashboard},
        '@/lib/agent-orchestration/flag':loadFlag(env,email,log),
        '@/components/home-agent/HomeAgent':{__esModule:true,default:HomeAgent},
      },env);
      const el=await page.default();
      assert.equal(el.type,HomeDashboard);
      // エージェントの部品を渡す props を探す（名前は画面の担当が決める）。HomeAgent の要素が入っているものだけを見る
      const stages=Object.values(el.props).filter(v=>v&&typeof v==='object'&&v.type===HomeAgent);
      return {stages,log};
    };
    for(const v of OFF_VALUES){
      const r=await render(envOf(v),ALLOWED);
      assert.equal(r.stages.length,0,'off must render no agent: '+String(v));
      assert.equal(r.log.includes('session'),false,'the flag must not read the session when off: '+String(v));
    }
    assert.equal((await render(envOf('preview'),'other@example.invalid')).stages.length,0);
    assert.equal((await render(envOf('preview'),ALLOWED)).stages.length,1);
    assert.equal((await render(envOf('all'),'other@example.invalid')).stages.length,1);
  });
  await check('Agent orchestration: the home screen part imports only client-safe pieces (no server readers, flag, routes or DB)',async()=>{
    const dir='src/components/home-agent';
    const files=exists(dir)?fs.readdirSync(path.join(root,dir)).filter(f=>/\.(tsx?|ts)$/.test(f)&&!/\.test\./.test(f)):[];
    for(const f of [...files.map(f=>dir+'/'+f),'src/components/agent-orchestration/AgentOrchestrator.tsx']){
      const src=read(f);
      for(const bad of [/agent-orchestration\/routes\.server/,/agent-orchestration\/sources\.server/,/agent-orchestration\/flag/,/@\/lib\/prisma/,/@\/app\/api\//]){
        assert.equal(bad.test(src),false,f+' must not import '+bad);
      }
    }
  });
  await check('Agent orchestration: the sample screens (agent-lab, agent-preview) are 404 in production',async()=>{
    for(const f of ['src/app/(shell)/home/agent-lab/page.tsx','src/app/(shell)/home/agent-preview/page.tsx'].filter(exists)){
      let notFound=0;
      const page=loadPage(f,{
        'next/navigation':{notFound:()=>{notFound++;throw Error('NEXT_NOT_FOUND')}},
        'next-auth':{getServerSession:async()=>null},'@/lib/auth':{authOptions:{}},
        '@/components/shell/AppShell':{__esModule:true,default:()=>null},
        '@/components/agent-orchestration/AgentOrchestrator':{__esModule:true,default:()=>null},
        '@/components/home-agent/HomeAgent':{__esModule:true,default:()=>null},
        '@/lib/agent-orchestration/flag':loadFlag(envOf('all'),ALLOWED),
        '@/lib/agent-orchestration/recipes':loadCore().recipes,
      },{NODE_ENV:'production',AGENT_ORCHESTRATION_ROLLOUT:'all'});
      await assert.rejects(()=>Promise.resolve().then(()=>page.default()),/NEXT_NOT_FOUND/,f);
      assert.equal(notFound,1,f);
    }
    // 見本の結果で動かすのは、見本の画面だけ（経営ホームの本物は API で動かす）
    assert.equal(/executor="sample"/.test(read(HOME)),false);
  });
  await check('Agent orchestration: the APIs read the flag before the body, and tool inputs come from checked answers',async()=>{
    for(const f of ['src/app/api/agent/tasks/route.ts','src/app/api/agent/plan/route.ts']){
      const src=read(f);
      assert.ok(src.indexOf('isAgentOrchestrationEnabled()')>0&&src.indexOf('isAgentOrchestrationEnabled()')<src.indexOf('readOperationalJson(req'),f);
    }
    const tools=read('src/lib/agent-orchestration/tools.ts');
    assert.equal(/from '@\/app\/api/.test(tools),false);
    assert.equal(/fetch\(/.test(tools),false);
  });
  // 実行の記録の API（/api/agent/runs…）
  function loadGate(env,email,log){
    const runner=loadCore().runner;
    return loadTs('src/lib/agent-orchestration/api.server.ts',{
      'next/server':nextServer,'./flag':loadFlag(env,email,log),'./store-flag':loadTs('src/lib/agent-orchestration/store-flag.ts',{},env),'./runner':runner,
      '@/lib/shell/company.server':{currentUserId:async()=>{log.push('user');return email?'u_1':null}},
    },env);
  }
  await check('Agent runs store: AGENT_RUNS_STORE=db only; the runs APIs need both flags (off: 404 without reading the session or the table)',async()=>{
    const sf=loadTs('src/lib/agent-orchestration/store-flag.ts');
    for(const v of [undefined,'','off','true','1','DBX']) assert.equal(sf.agentRunsStoreEnabled(v),false,String(v));
    assert.equal(sf.agentRunsStoreEnabled(' DB '),true);
    for(const v of OFF_VALUES){
      const log=[];
      const g=await loadGate({...envOf(v),AGENT_RUNS_STORE:'db'},ALLOWED,log).agentGate({store:true});
      assert.equal(g.response.status,404);
      assert.deepEqual(log,[],String(v));
    }
    let log=[];
    let g=await loadGate(envOf('preview'),ALLOWED,log).agentGate({store:true});
    assert.equal(g.response.status,404);
    assert.equal((await g.response.json()).store,'off');
    assert.equal(log.includes('user'),false,'store off must not read the user');
    g=await loadGate({...envOf('preview'),AGENT_RUNS_STORE:'db'},'other@example.invalid',[]).agentGate({store:true});
    assert.equal(g.response.status,404);
    g=await loadGate({...envOf('preview'),AGENT_RUNS_STORE:'db'},ALLOWED,[]).agentGate({store:true});
    assert.equal(g.userId,'u_1');
    // 記録を使わない API（/api/agent/tasks の入口）は、記録の設定を見ない
    g=await loadGate(envOf('preview'),ALLOWED,[]).agentGate({store:false});
    assert.equal(g.userId,'u_1');
    // 記録の API は、どれも入口（agentGate）を最初に通る。表（prismaRunRepo）や本文はそのあと
    for(const f of ['src/app/api/agent/runs/route.ts','src/app/api/agent/runs/active/route.ts','src/app/api/agent/runs/[id]/tasks/[taskId]/route.ts']){
      const src=read(f);
      const gate=src.indexOf('agentGate({ store: true })');
      assert.ok(gate>0,f);
      // 本文を読む呼び出し（readOperationalJson を直接、または会社名だけを読む companyNameFrom）も、入口のあと
      for(const later of [f.includes('[taskId]')?'await companyNameFrom(req)':'readOperationalJson(req','prismaRunRepo.','createRun(','latestOpenRun(','runStoredTask(']){
        const i=src.indexOf(later); if(i>0) assert.ok(i>gate,f+' '+later);
      }
    }
    // ToDo を動かす API が本文から読むのは、会社名だけ（会社の調査のやり直し）。ほかはすべて、保存した作戦と答えから作る
    const runTask=read('src/app/api/agent/runs/[id]/tasks/[taskId]/route.ts');
    assert.equal((runTask.match(/readOperationalJson\(/g)||[]).length,1);
    assert.match(runTask,/const raw = body\.companyName/);
    assert.equal(/body\.(?!companyName)\w+/.test(runTask),false);
    assert.equal(/req\.json\(/.test(runTask),false);
    // 表を読む・書くのは runs.prisma.ts だけで、どの読み書きも userId で絞る
    const repo=read('src/lib/agent-orchestration/runs.prisma.ts');
    const calls=repo.match(/prisma\.homeAgent(Run|Task)\.\w+\(\{[^]*?\}\)/g)||[];
    assert.ok(calls.length>=7);
    for(const c of calls) if(!/\.create\(/.test(c)) assert.match(c,/userId/,c.slice(0,80));
  });
  await check('Agent quote retry: when only the save failed, the kept draft is saved again without calling the AI, and nothing is refunded',async()=>{
    // 戻すのは、AI の生成そのものが失敗したときだけ（包みが行う）。エージェントの側に、台帳を戻す処理を置かない（2026-10-25 ユーザー決定）
    for(const f of ['src/lib/agent-orchestration/execute.ts','src/lib/agent-orchestration/routes.server.ts','src/app/api/agent/tasks/route.ts','src/app/api/agent/runs/[id]/tasks/[taskId]/route.ts']){
      assert.equal(/refund\(|refundKeptCharges|@\/lib\/doya-power'\)|from '@\/lib\/doya-power'/.test(read(f)),false,f);
    }
    let log=[];
    // 1回目: 保存（quote.create）だけが失敗 → 案を resume で返す
    const core=loadCore();
    const failing={shodanSlug:async()=>'acme',call:async(route,body)=>{log.push('call:'+route);if(route==='quote.create')return {status:402,data:{error:'無料プランは3件までです。',code:'LIMIT_REACHED'}};return core.tools.fakeToolDeps({delayMs:0}).call(route,body)}};
    const routeWith=(deps)=>loadTs('src/app/api/agent/tasks/route.ts',{
      'next/server':nextServer,'@/lib/agent-orchestration/flag':loadFlag(envOf('preview'),ALLOWED,log),'@/lib/agent-orchestration/recipes':core.recipes,'@/lib/agent-orchestration/runner':core.runner,
      '@/lib/agent-orchestration/tools':core.tools,'@/lib/agent-orchestration/routes.server':{toolDepsFor:()=>deps},'@/lib/agent-orchestration/execute':core.execute,
      '@/lib/shell/company.server':{currentUserId:async()=>'u_1'},'@/lib/operational-json':{readOperationalJson:async(r)=>r.json()},
    },envOf('preview'));
    let res=await routeWith(failing).POST(taskReq({recipeId:'sales-prep',taskId:'quote',answers}));
    assert.equal(res.status,422);
    const bad=await res.json();
    assert.equal(bad.kind,'limit');
    assert.ok(bad.resume&&typeof bad.resume.quoteDraft==='string');
    assert.deepEqual(log.filter(l=>l.startsWith('call:')),['call:quote.suggest','call:quote.create']);
    // 2回目: 残した案で、保存だけ（AI は呼ばない）
    log=[];
    const ok={shodanSlug:async()=>'acme',call:async(route,body)=>{log.push('call:'+route);return core.tools.fakeToolDeps({delayMs:0}).call(route,body)}};
    res=await routeWith(ok).POST(taskReq({recipeId:'sales-prep',taskId:'quote',answers,resume:bad.resume}));
    assert.equal(res.status,200);
    assert.deepEqual(log.filter(l=>l.startsWith('call:')),['call:quote.create']);
    // 大きすぎる案は受け取らない（AI で作り直す）
    log=[];
    res=await routeWith(ok).POST(taskReq({recipeId:'sales-prep',taskId:'quote',answers,resume:{quoteDraft:'['+'1,'.repeat(13000)+'1]'}}));
    assert.deepEqual(log.filter(l=>l.startsWith('call:')),['call:quote.suggest','call:quote.create']);
  });
  await check('Agent tasks API: one user runs at most 3 tasks at once, and failures return only user-facing fields',async()=>{
    const src=read('src/app/api/agent/tasks/route.ts');
    assert.match(src,/limiter\.acquire\(userId\)/);
    assert.match(src,/status: 429/);
    assert.match(src,/finally \{\s*release\(\)/);
    // 減ったままの操作（charges）は、画面への答えに入れない
    const core=loadCore();
    const api=loadTs('src/lib/agent-orchestration/api.server.ts',{'next/server':nextServer,'./flag':loadFlag(envOf('preview'),ALLOWED),'./store-flag':loadTs('src/lib/agent-orchestration/store-flag.ts'),'./runner':core.runner,'@/lib/shell/company.server':{currentUserId:async()=>'u_1'}},{});
    const failed=await api.taskFailure(new core.runner.AgentTaskError('保存できませんでした。','tool',undefined,undefined,{used:1,refunded:0})).json();
    assert.equal(failed.error,'保存できませんでした。');
    assert.deepEqual(failed.power,{used:1,refunded:0});
    assert.deepEqual(Object.keys(failed).sort(),['error','kind','power']);
    const log=[];
    const res=await loadTaskRoute(envOf('preview'),ALLOWED,log).POST(taskReq({recipeId:'sales-prep',taskId:'quote',answers}));
    assert.equal(res.status,200);
    assert.equal(JSON.stringify(await res.json()).includes('opKey'),false);
  });
})().catch(e=>{console.error(e);process.exit(1)});
