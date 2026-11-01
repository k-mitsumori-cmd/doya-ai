// ドヤパワーの旗（DOYA_POWER_ROLLOUT）の回帰テスト。
// - 旗が off（既定・値なし・知らない値）のとき: 台帳の表（doya_power_*）を読む Prisma の呼び出しが0回、
//   API は 404、ページは 404、部品（ゲージ・減る量の札など）は何も描かない
// - preview のとき: UI_PREVIEW_EMAILS で許可されていない人には出さない。許可した人には出す
// - 画面・API・台帳の入口が、すべて旗の内側にあること（新しく足したファイルが旗を見ていないと失敗する）
// 値はすべてテストの中で渡す（process.env の既定値に頼らない）。git を使わない。DB・課金・外部 API には触れない。
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{load,check}=require('./load-typescript.cjs');
const root=path.resolve(__dirname,'../..');
const ts=require(path.join(root,'node_modules/typescript'));
const React=require(path.join(root,'node_modules/react'));
const jsxRuntime=require(path.join(root,'node_modules/react/jsx-runtime'));
const {renderToStaticMarkup}=require(path.join(root,'node_modules/react-dom/server'));
const nextServer=require(path.join(root,'node_modules/next/server'));
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const ALLOWED='owner@example.invalid';

// .tsx も読める読み込み（JSX は react/jsx-runtime。書いていない import は、呼ばれたら数える空の部品にする）
function loadTsx(file,mocks={},env={},used=[]){
  const exports={};const module={exports};
  const out=ts.transpileModule(read(file),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const stub=name=>new Proxy(function(){},{get:(t,k)=>k==='__esModule'?true:k==='then'?undefined:stub(name+'.'+String(k)),apply:()=>{used.push(name);return null}});
  const req=n=>{if(n in mocks)return mocks[n];if(n==='react')return React;if(n==='react/jsx-runtime')return jsxRuntime;if(/\.css$/.test(n))return {};return stub(n)};
  vm.runInNewContext(out,{exports,module,require:req,URL,Request,Response,Headers,Buffer,Date,Set,Map,Error,Promise,Object,Array,Number,String,Math,JSON,Symbol,Proxy,process:{env},console:{log(){},warn(){},error(){}}},{filename:file});
  return module.exports;
}
// Prisma の代わり。どの表を何回さわったかを数える（台帳の表は doyaPower* のモデル）
function countingPrisma(){
  const calls=[];
  const model=name=>new Proxy({},{get:(t,op)=>(...args)=>{calls.push(name+'.'+String(op));return Promise.resolve(null)}});
  const prisma=new Proxy({},{get:(t,k)=>{if(k==='then')return undefined;if(k==='$transaction')return async fn=>{calls.push('$transaction');return typeof fn==='function'?fn(prisma):Promise.all(fn)};return model(String(k))}});
  return {prisma,calls,ledgerCalls:()=>calls.filter(c=>/^doyaPower|^\$transaction/.test(c))};
}
function sessionMock(email,counter){
  return {getServerSession:async()=>{counter&&counter.push('session');if(email===Symbol.for('throw'))throw Error('boom');return email===undefined?null:{user:{email,id:'u_1'}}}};
}
function loadUiNextLib(env){return load('src/lib/ui-next.ts',{'next/headers':{cookies:async()=>({get:()=>undefined})},'next-auth':sessionMock(undefined),'@/lib/auth':{authOptions:{}}},{process:{env},Promise})}
function loadFlag(env,email,counter){
  return load('src/lib/doya-power/flag.ts',{'@/lib/ui-next':loadUiNextLib(env),'next-auth':sessionMock(email,counter),'@/lib/auth':{authOptions:{}}},{process:{env},Promise});
}
const envOf=(rollout)=>{const e={UI_NEXT_ROLLOUT:'all',UI_PREVIEW_EMAILS:ALLOWED};if(rollout!==undefined)e.DOYA_POWER_ROLLOUT=rollout;return e};
const OFF_VALUES=[undefined,'','off','OFF',' on ','true','1','yes'];
const notFoundError=()=>{const e=Error('NEXT_NOT_FOUND');e.digest='NEXT_NOT_FOUND';return e};
const navigation=(log)=>({notFound:()=>{log.push('notFound');throw notFoundError()},redirect:(to)=>{log.push('redirect:'+to);const e=Error('NEXT_REDIRECT');e.digest='NEXT_REDIRECT';throw e}});

(async()=>{
  await check('Doya Power flag: off is the default; only preview and all turn it on',async()=>{
    for(const v of OFF_VALUES){
      const f=loadFlag(envOf(v),ALLOWED);
      assert.equal(f.doyaPowerRollout(),'off',String(v));
      assert.equal(f.doyaPowerLedgerAllowed(),false,String(v));
      assert.equal(f.doyaPowerSampleAllowed(),false,String(v));
    }
    assert.equal(loadFlag(envOf('preview')).doyaPowerRollout(),'preview');
    assert.equal(loadFlag(envOf(' ALL ')).doyaPowerRollout(),'all');
  });
  await check('Doya Power flag: off never reads the session; preview shows only allowed emails; all shows everyone',async()=>{
    for(const v of OFF_VALUES){
      const seen=[];
      assert.equal(await loadFlag(envOf(v),ALLOWED,seen).isDoyaPowerEnabled(),false,String(v));
      assert.equal(seen.length,0,'session must not be read when off: '+String(v));
    }
    for(const email of ['other@example.invalid','',null,undefined,Symbol.for('throw')]){
      assert.equal(await loadFlag(envOf('preview'),email).isDoyaPowerEnabled(),false,String(email));
    }
    assert.equal(await loadFlag(envOf('preview'),ALLOWED).isDoyaPowerEnabled(),true);
    assert.equal(await loadFlag(envOf('preview'),'OWNER@example.invalid').isDoyaPowerEnabled(),true);
    // 許可の一覧が空なら、preview でも誰にも出さない
    assert.equal(await loadFlag({DOYA_POWER_ROLLOUT:'preview',UI_PREVIEW_EMAILS:''},ALLOWED).isDoyaPowerEnabled(),false);
    assert.equal(await loadFlag(envOf('all'),'other@example.invalid').isDoyaPowerEnabled(),true);
  });

  function loadLedgerIndex(env,prisma){
    const rules=load('src/lib/doya-power/rules.ts',{});
    const plan=load('src/lib/unified-plan.ts',{});
    const ledger=load('src/lib/doya-power/ledger.ts',{'./rules':rules,'@/lib/unified-plan':plan},{Promise,Object,Array,Number,Math});
    const gate=load('src/lib/doya-power/gate.ts',{'./ledger':ledger},{Promise,Object,Array});
    const flag=loadFlag(env,ALLOWED);
    return load('src/lib/doya-power/index.ts',{'@/lib/prisma':{prisma},'@/lib/unified-plan':{isPaidPlan:(p)=>p==='banner-pro'},'./ledger':ledger,'./flag':flag,'./gate':gate,'./rules':rules},{Promise,Object,Array,process:{env}});
  }
  await check('Doya Power flag: when off, the ledger entry points touch no doya_power_* table (0 Prisma calls)',async()=>{
    for(const v of OFF_VALUES){
      const p=countingPrisma();
      const idx=loadLedgerIndex(envOf(v),p.prisma);
      const attempts=[
        ()=>idx.balanceForUser('u_1'),()=>idx.balance('co_1'),()=>idx.consume('co_1',10,'op-1'),
        ()=>idx.refund('op-1'),()=>idx.grant('co_1','bonus',10,null),()=>idx.grantMonthlyForPlan('co_1','banner-pro'),
      ];
      for(const a of attempts){
        await assert.rejects(a,e=>e&&e.name==='DoyaPowerDisabledError',String(v));
      }
      assert.deepEqual(p.calls,[],'Prisma must not be touched when off: '+String(v));
    }
  });
  await check('Doya Power flag: when on, the same entry points reach the ledger (the gate is not a dead end)',async()=>{
    const p=countingPrisma();
    const idx=loadLedgerIndex(envOf('all'),p.prisma);
    await idx.balanceForUser('u_1').catch(()=>null);
    assert.ok(p.calls.length>0,'ledger should be reached when the flag is on');
  });

  function loadAnnualRoute(env,email,p,log){
    const flag=loadFlag(env,email,log);
    return loadTsx('src/app/api/annual-report/image/route.ts',{
      'next/server':nextServer,
      '@/lib/prisma':{prisma:p.prisma},
      '@/lib/ui-next':{isUiNext:async()=>{log.push('isUiNext');return true}},
      '@/lib/doya-power/flag':flag,
      '@/lib/shell/company.server':{currentUserId:async()=>{log.push('currentUserId');return email?'u_1':null},getAccountCompanyName:async()=>{log.push('company');return null}},
      '@/lib/annual-report/report':{REVEAL_KEYS:[],allowedReveal:()=>[],buildAnnualReport:()=>{log.push('build');return {revealed:[]}},parseRevealRequest:()=>[],parseSize:()=>'wide',parseYear:()=>2026,resolveReveal:()=>[]},
      '@/lib/annual-report/load.server':{loadAnnualRawData:async()=>{log.push('loadRaw');return {}},resolveAnnualAccess:async()=>{log.push('access');return {}}},
      '@/lib/annual-report/sample':{sampleAnnualRawData:()=>{log.push('sample');return {}}},
      '@/lib/annual-report/render.server':{renderAnnualImage:async()=>{log.push('render');return Buffer.from('png')}},
    },env);
  }
  const apiReq=(q)=>new nextServer.NextRequest('https://doya-ai.example.invalid/api/annual-report/image'+q);
  await check('Doya Power flag: the annual-report API is 404 when off (sample too) and reads nothing',async()=>{
    for(const v of OFF_VALUES){
      for(const q of ['?year=2026','?sample=1','?show=company,customers,amounts,members']){
        const p=countingPrisma(),log=[];
        const res=await loadAnnualRoute({...envOf(v),NODE_ENV:'development'},ALLOWED,p,log).GET(apiReq(q));
        assert.equal(res.status,404,String(v)+q);
        assert.deepEqual(p.calls,[],String(v)+q);
        assert.deepEqual(log,[],String(v)+q);
      }
    }
  });
  await check('Doya Power flag: the annual-report API is 404 for unallowed preview users and open for allowed ones',async()=>{
    for(const email of ['other@example.invalid',undefined]){
      const p=countingPrisma(),log=[];
      const res=await loadAnnualRoute(envOf('preview'),email,p,log).GET(apiReq('?year=2026'));
      assert.equal(res.status,404,String(email));
      assert.deepEqual(p.calls,[]);
      assert.equal(log.includes('currentUserId'),false);
    }
    const p=countingPrisma(),log=[];
    const res=await loadAnnualRoute(envOf('preview'),ALLOWED,p,log).GET(apiReq('?year=2026'));
    assert.equal(res.status,200);
    assert.ok(log.includes('currentUserId')&&log.includes('render'));
  });

  // ページ: 旗が出さないと決めたら 404。読み込み（DB）の関数は呼ばない
  const PAGES=[
    {file:'src/app/(shell)/home/collection/page.tsx',loaders:{'@/lib/collection/facts.server':'loadCollectionFacts'}},
    {file:'src/app/(shell)/home/missions/page.tsx',loaders:{'@/lib/missions/load.server':'loadMissionsView'}},
    {file:'src/app/(shell)/home/annual/page.tsx',loaders:{'@/lib/annual-report/load.server':'resolveAnnualAccess'}},
  ];
  async function runPage(file,loaders,env,email){
    const p=countingPrisma(),log=[],used=[];
    const mocks={
      'next/navigation':navigation(log),
      'next-auth':sessionMock(email,log),'@/lib/auth':{authOptions:{}},
      '@/lib/prisma':{prisma:p.prisma},
      '@/lib/ui-next':{isUiNext:async()=>true},
      '@/lib/doya-power/fx.server':{loadDoyaPowerFxForUser:async()=>({fx:{},canEditOrg:false})},
      '@/lib/doya-power/flag':loadFlag(env,email),
      '@/lib/shell/company.server':{currentUserId:async()=>{log.push('currentUserId');return email?'u_1':null}},
    };
    for(const [mod,fn] of Object.entries(loaders))mocks[mod]=new Proxy({},{get:(t,k)=>k==='__esModule'?true:async()=>{log.push('loader:'+String(k));return {tools:{}}}});
    const page=loadTsx(file,mocks,env,used);
    let outcome='rendered';
    try{await page.default({searchParams:Promise.resolve({})})}catch(e){outcome=e.digest||String(e.message)}
    return {outcome,log,prismaCalls:p.calls};
  }
  await check('Doya Power flag: the Doya Power pages are 404 when off and read no data',async()=>{
    for(const {file,loaders} of PAGES){
      for(const v of OFF_VALUES){
        const r=await runPage(file,loaders,{...envOf(v),NODE_ENV:'production'},ALLOWED);
        assert.equal(r.outcome,'NEXT_NOT_FOUND',file+' '+String(v));
        assert.deepEqual(r.prismaCalls,[],file);
        assert.equal(r.log.some(x=>x.startsWith('loader:')||x==='currentUserId'||x==='session'),false,file+' '+r.log.join(','));
      }
    }
  });
  await check('Doya Power flag: in preview, unallowed users get 404 and allowed users get the page',async()=>{
    for(const {file,loaders} of PAGES){
      const denied=await runPage(file,loaders,{...envOf('preview'),NODE_ENV:'production'},'other@example.invalid');
      assert.equal(denied.outcome,'NEXT_NOT_FOUND',file);
      assert.equal(denied.log.some(x=>x.startsWith('loader:')),false,file);
      const allowed=await runPage(file,loaders,{...envOf('preview'),NODE_ENV:'production'},ALLOWED);
      assert.equal(allowed.outcome,'rendered',file+' '+allowed.log.join(','));
      assert.ok(allowed.log.some(x=>x.startsWith('loader:')),file);
    }
  });
  await check('Doya Power flag: sample pages stay closed when off, even in development',async()=>{
    const SAMPLES=['src/app/(shell)/home/collection/preview/page.tsx','src/app/(shell)/home/missions/preview/page.tsx','src/app/(shell)/home/annual/preview/page.tsx'];
    for(const file of SAMPLES){
      for(const env of [{NODE_ENV:'development'},{NODE_ENV:'production',COLLECTION_PREVIEW:'1'},{NODE_ENV:'development',DOYA_POWER_ROLLOUT:'off'}]){
        const r=await runPage(file,{},{UI_PREVIEW_EMAILS:ALLOWED,...env},ALLOWED);
        assert.equal(r.outcome,'NEXT_NOT_FOUND',file+' '+JSON.stringify(env));
      }
    }
    // 部品の見本（/ds-preview/doya-power）は ds-preview の決まり（本番では DS_PREVIEW=1 のときだけ）
    const ds='src/app/ds-preview/doya-power/page.tsx';
    assert.equal((await runPage(ds,{},{NODE_ENV:'production'},ALLOWED)).outcome,'NEXT_NOT_FOUND');
    assert.match(read(ds),/NODE_ENV === 'production' && process\.env\.DS_PREVIEW !== '1'\) notFound\(\)/);
    assert.match(read('src/app/ds-preview/layout.tsx'),/NODE_ENV === 'production' && process\.env\.DS_PREVIEW !== '1'\) notFound\(\)/);
  });

  // 部品: context が偽（既定）なら何も描かない
  function loadContext(){return loadTsx('src/components/doya-power/doya-power-context.tsx',{})}
  await check('Doya Power flag: the cost badge and gauges render nothing unless the server turned the flag on',async()=>{
    const ctx=loadContext();
    const badge=loadTsx('src/components/ds/cost-badge.tsx',{'@/components/doya-power/doya-power-context':ctx,'lucide-react':{Zap:()=>null}});
    const h=React.createElement;
    assert.equal(renderToStaticMarkup(h(badge.CostBadge,{cost:10})),'');
    assert.equal(renderToStaticMarkup(h(ctx.DoyaPowerProvider,{enabled:false},h(badge.CostBadge,{cost:10}))),'');
    assert.match(renderToStaticMarkup(h(ctx.DoyaPowerProvider,{enabled:true},h(badge.CostBadge,{cost:10}))),/ドヤパワーを10使います/);
    const used=[];
    const dp=loadTsx('src/components/doya-power/DoyaPower.tsx',{'./doya-power-context':ctx},{},used);
    for(const name of ['DoyaPowerGauge','PowerEquivalents','LowPowerNotice','MorningRecoveryToast']){
      const props={remaining:10,limit:100,conversions:[],recoveredAt:new Date(),now:new Date()};
      assert.equal(renderToStaticMarkup(h(dp[name],props)),'',name);
      assert.equal(renderToStaticMarkup(h(ctx.DoyaPowerProvider,{enabled:false},h(dp[name],props))),'',name);
    }
    assert.deepEqual(used,[],'the hidden parts must not run their inner code');
  });
  await check('Doya Power flag: the shell passes the flag only with the new look, decided on the server',async()=>{
    const layout=read('src/app/(shell)/layout.tsx'),gate=read('src/components/shell/ShellGate.tsx');
    assert.match(layout,/const doyaPower = signedIn \? await isDoyaPowerEnabled\(\) : false/);
    assert.match(layout,/doyaPower=\{doyaPower\}/);
    assert.match(gate,/doyaPower = false/);
    assert.match(gate,/<DoyaPowerContext\.Provider value=\{doyaPower\}>/);
    assert.doesNotMatch(read('src/components/doya-power/doya-power-context.tsx'),/process\.env|document\.cookie|cookies\(/);
  });
  await check('Doya Power flag: every page/API that uses Doya Power code checks the flag; nothing else touches the ledger tables',async()=>{
    const walk=(d)=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
    const rel=f=>path.relative(root,f).split(path.sep).join('/');
    const DOYA=/from ['"]@\/(lib\/doya-power(\/index)?|components\/doya-power[^'"]*|components\/ds\/cost-badge|lib\/collection\/[^'"]+|components\/collection\/[^'"]+|lib\/missions\/[^'"]+|components\/missions\/[^'"]+|lib\/annual-report\/[^'"]+|components\/annual-report\/[^'"]+)['"]/;
    const appFiles=walk(path.join(root,'src/app')).filter(f=>/\.(ts|tsx)$/.test(f));
    const found=[];
    for(const file of appFiles){
      const src=fs.readFileSync(file,'utf8');
      if(!DOYA.test(src))continue;
      found.push(rel(file));
      const ok=/isDoyaPowerEnabled\(\)/.test(src)||/doyaPowerSampleAllowed\(\)/.test(src)||(rel(file)==='src/app/ds-preview/doya-power/page.tsx');
      assert.ok(ok,'Doya Power code used without the flag: '+rel(file));
    }
    assert.ok(found.length>=7,'expected the Doya Power pages and API: '+found.join(','));
    // 台帳の表（doyaPower* のモデル）に直接さわるのは、台帳の本体とテスト用の DB だけ
    const srcFiles=walk(path.join(root,'src')).filter(f=>/\.(ts|tsx)$/.test(f));
    const allowedLedger=new Set(['src/lib/doya-power/ledger.ts','src/lib/doya-power/memory-db.ts','src/lib/doya-power/ledger.test.ts']);
    for(const file of srcFiles){
      if(allowedLedger.has(rel(file)))continue;
      assert.doesNotMatch(fs.readFileSync(file,'utf8'),/\.doyaPower(Account|Grant|Transaction)\b/,rel(file));
    }
    // 台帳の本体は、旗の入口（index.ts → gate.ts）を通してだけ使う
    for(const file of srcFiles){
      const r=rel(file);if(r.startsWith('src/lib/doya-power/'))continue;
      assert.doesNotMatch(fs.readFileSync(file,'utf8'),/from ['"]@\/lib\/doya-power\/(ledger|gate|memory-db)['"]/,r);
    }
  });
})().catch(e=>{console.error(e);process.exit(1)});
