// ベータで非表示のサービス（ドヤカンニング。2026-10-19）の回帰テスト。
// - 一覧（ログイン後のツール・左のメニュー・公開の一覧・料金ページの数）に出ない。数は旗から数え直す
// - 許可されていない人は、画面（/cunning）も API（/api/cunning/*）も使えない。許可した人だけが使える
// ⚠️ git のコマンドは使わない（Vercel のビルドには .git が無い）。ファイルは fs で直接たどる。
// 合成のセッションだけを使う。DB・課金・AI には触れない。
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{load,check}=require('./load-typescript.cjs');
const root=path.resolve(__dirname,'../..');
const nextServer=require(path.join(root,'node_modules/next/server'));
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const ALLOWED='owner@example.invalid';
const services=load('src/lib/services.ts',{'./unified-plan':load('src/lib/unified-plan.ts',{})});
function guardModule(email,env={UI_PREVIEW_EMAILS:ALLOWED}){
  const uiNext=load('src/lib/ui-next.ts',{'next/headers':{cookies:async()=>({get:()=>undefined})},'next-auth':{getServerSession:async()=>null},'@/lib/auth':{authOptions:{}}},{process:{env},Promise});
  return load('src/lib/beta-services.ts',{
    'next/server':nextServer,
    '@/lib/services':services,
    '@/lib/ui-next':uiNext,
    'next-auth':{getServerSession:async()=>email===undefined?null:{user:{email}}},
    '@/lib/auth':{authOptions:{}},
  },{process:{env},Promise});
}
function walk(dir){return fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(path.join(dir,d.name)):d.name==='route.ts'?[path.join(dir,d.name)]:[])}
(async()=>{
  await check('Beta-hidden services are excluded from every derived list and counts',async()=>{
    assert.ok(services.BETA_HIDDEN_SERVICE_IDS.has('cunning'));
    const active=services.getActiveServices().map(s=>s.id), pub=services.getPublicServices().map(s=>s.id);
    assert.ok(!active.includes('cunning'));
    assert.ok(!pub.includes('cunning'));
    assert.ok(services.HIDDEN_SERVICE_IDS.has('cunning'));
    assert.equal(services.isServiceAvailable('cunning'),false);
    // 料金ページの数は、公開の一覧から数える（ベタ書きにしない）
    for(const f of ['src/components/pricing/PricingNext.tsx','src/components/UnifiedPricingPlans.tsx']){
      const src=read(f);
      assert.match(src,/getPublicServices\(\)/,f);
      assert.doesNotMatch(src,/全1[0-9]ツール|全2[0-9]ツール|1[0-9]サービス|2[0-9]サービス/,f);
    }
    // 左のメニュー・⌘K・すべての一覧は getActiveServices から作る
    assert.match(read('src/components/shell/tools.ts'),/getActiveServices\(\)/);
    // ホームの「やりたいこと」に入口が無い
    assert.doesNotMatch(read('src/app/(shell)/home/intents.ts'),/\/cunning/);
  });
  await check('Only allowlisted users may use a beta-hidden service',async()=>{
    const g=guardModule(undefined);
    assert.equal(g.canUseBetaService('cunning',ALLOWED,[ALLOWED]),true);
    assert.equal(g.canUseBetaService('cunning','OWNER@example.invalid',[ALLOWED]),true);
    for(const e of ['other@example.invalid','',null,undefined])assert.equal(g.canUseBetaService('cunning',e,[ALLOWED]),false,String(e));
    assert.equal(g.canUseBetaService('cunning',ALLOWED,[]),false);
    // ベータで非表示でないサービスは、いつでも使える
    assert.equal(g.canUseBetaService('sfa',null,[]),true);
  });
  await check('API guard returns 403 for others and nothing for allowlisted users',async()=>{
    for(const email of ['other@example.invalid',undefined]){
      const res=await guardModule(email).betaServiceGuard('cunning');
      assert.ok(res,'blocked '+email);
      assert.equal(res.status,403);
      assert.match(res.headers.get('cache-control')||'',/no-store/);
    }
    assert.equal(await guardModule(ALLOWED).betaServiceGuard('cunning'),null);
    // 許可リストが空なら、誰も使えない
    assert.ok(await guardModule(ALLOWED,{}).betaServiceGuard('cunning'));
  });
  await check('Every cunning API handler checks the beta guard first',async()=>{
    const files=walk('src/app/api/cunning');
    assert.ok(files.length>=17,'routes found: '+files.length);
    for(const f of files){
      const src=read(f);
      const handlers=[...src.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\(/g)].length;
      const guards=[...src.matchAll(/const betaBlocked = await betaServiceGuard\('cunning'\)\n\s*if \(betaBlocked\) return betaBlocked/g)].length;
      assert.ok(handlers>0,f);
      assert.equal(guards,handlers,f);
    }
  });
  await check('The cunning screens show only the beta notice to others and are not indexed',async()=>{
    const src=read('src/app/(shell)/cunning/layout.tsx');
    assert.match(src,/if \(!\(await betaServiceAllowed\('cunning'\)\)\) return <BetaServiceNotice/);
    assert.match(src,/robots: \{ index: false, follow: false \}/);
  });
  console.log(JSON.stringify({scope:'Beta-hidden service lists, counts and entry guards with synthetic sessions. No DB, billing or AI.'}));
})().catch(e=>{console.error(e);process.exitCode=1});
