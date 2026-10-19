// 新しい見た目のプレビュー（UI-QUALITY-CHECKLIST §5.1）のセキュリティの回帰テスト。
// - 許可されていないメールの人が cookie（doya_ui_next=1）を手で付けても、今の見た目のまま
// - 切り替えの API は、許可されていない人・未ログインの人には 403 で、cookie を立てない
// - 許可した人の cookie は httpOnly・secure・sameSite=lax・30日。戻る先は同じサイトの中だけ
// 合成のセッションと cookie だけを使う。DB・課金・AI には触れない。
const assert=require('node:assert/strict'),path=require('node:path'),{load,check}=require('./load-typescript.cjs');
const root=path.resolve(__dirname,'../..');
const nextServer=require(path.join(root,'node_modules/next/server'));
const ALLOWED='owner@example.invalid';
const env=(rollout='preview')=>({UI_NEXT_ROLLOUT:rollout,UI_PREVIEW_EMAILS:ALLOWED});
function loadUiNext({cookie,email,rollout}){
  return load('src/lib/ui-next.ts',{
    'next/headers':{cookies:async()=>({get:n=>n==='doya_ui_next'&&cookie!=null?{value:cookie}:undefined})},
    'next-auth':{getServerSession:async()=>email===undefined?null:{user:{email}}},
    '@/lib/auth':{authOptions:{}},
  },{process:{env:env(rollout)},Promise});
}
function loadRoute(email){
  const uiNext=loadUiNext({rollout:'preview'});
  return load('src/app/api/ui-preview/route.ts',{
    'next/server':nextServer,
    'next-auth':{getServerSession:async()=>email===undefined?null:{user:{email}}},
    '@/lib/auth':{authOptions:{}},
    '@/lib/ui-next':uiNext,
  },{process:{env:env()},Promise});
}
const req=(q,headers={})=>new nextServer.NextRequest('https://doya-ai.example.invalid/api/ui-preview'+q,{headers});
(async()=>{
  await check('Unallowed user with a forged cookie still gets the current UI',async()=>{
    for(const email of ['other@example.invalid','',null,undefined]){
      const m=loadUiNext({cookie:'1',email,rollout:'preview'});
      assert.equal(await m.uiNextMode(),null,String(email));
      assert.equal(await m.isUiNext(),false,String(email));
    }
  });
  await check('Allowed user needs the cookie; off overrides it; all shows everyone',async()=>{
    assert.equal(await loadUiNext({cookie:'1',email:ALLOWED,rollout:'preview'}).uiNextMode(),'preview');
    assert.equal(await loadUiNext({cookie:'1',email:'OWNER@EXAMPLE.INVALID',rollout:'preview'}).uiNextMode(),'preview');
    assert.equal(await loadUiNext({cookie:null,email:ALLOWED,rollout:'preview'}).uiNextMode(),null);
    assert.equal(await loadUiNext({cookie:'1',email:ALLOWED,rollout:'off'}).uiNextMode(),null);
    assert.equal(await loadUiNext({cookie:null,email:'other@example.invalid',rollout:'all'}).uiNextMode(),'all');
  });
  await check('Session lookup failure falls back to the current UI',async()=>{
    const m=load('src/lib/ui-next.ts',{'next/headers':{cookies:async()=>({get:()=>({value:'1'})})},'next-auth':{getServerSession:async()=>{throw Error('boom')}},'@/lib/auth':{authOptions:{}}},{process:{env:env()},Promise});
    assert.equal(await m.uiNextMode(),null);
  });
  await check('Preview API rejects unallowed and signed-out users without setting a cookie',async()=>{
    for(const email of ['other@example.invalid',undefined]){
      for(const q of ['?on=1','?on=0']){
        const res=await loadRoute(email).GET(req(q));
        assert.equal(res.status,403);
        assert.equal(res.headers.get('set-cookie'),null);
      }
    }
  });
  await check('Preview API sets a hardened 30-day cookie for the allowed user and clears it with on=0',async()=>{
    const on=await loadRoute(ALLOWED).GET(req('?on=1&next=/shodan/acme'));
    assert.equal(on.status,303);
    assert.equal(on.headers.get('location'),'https://doya-ai.example.invalid/shodan/acme');
    const c=on.headers.get('set-cookie')||'';
    assert.match(c,/doya_ui_next=1/);assert.match(c,/HttpOnly/i);assert.match(c,/Secure/i);assert.match(c,/SameSite=lax/i);assert.match(c,/Max-Age=2592000/);assert.match(c,/Path=\//);
    const off=await loadRoute(ALLOWED).GET(req('?on=0'));
    assert.match(off.headers.get('set-cookie')||'',/doya_ui_next=;.*Max-Age=0/i);
  });
  await check('Preview API never redirects to another site',async()=>{
    for(const next of ['https://evil.example/','//evil.example/','/\\evil.example','/\t/evil.example','/\n/evil.example']){
      const res=await loadRoute(ALLOWED).GET(req('?on=1&next='+encodeURIComponent(next)));
      assert.equal(new URL(res.headers.get('location')).origin,'https://doya-ai.example.invalid',next);
    }
    const ref=await loadRoute(ALLOWED).GET(req('?on=1',{referer:'https://evil.example/x'}));
    assert.equal(ref.headers.get('location'),'https://doya-ai.example.invalid/home');
  });
  await check('UI quality fixes stay behind the server-side preview decision',async()=>{
    const fs=require('node:fs'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
    assert.match(read('src/app/(shell)/layout.tsx'),/uiNext=\{uiNext\}/);
    assert.match(read('src/app/(shell)/layout.tsx'),/session\?\.user \? await uiNextMode\(\) : null/);
    // 会社の名前は、新しい見た目の人のときだけ読んで渡す
    assert.match(read('src/app/(shell)/layout.tsx'),/const company = uiNext \? await getAccountCompanyName\(\)/);
    assert.match(read('src/components/shell/ShellGate.tsx'),/AccountCompanyContext\.Provider value=\{uiNext \? company : undefined\}/);
    // 一覧はログイン中の人の所属だけを読む関数から作る（組織を作らない）
    const loader=read('src/lib/shell/company.server.ts');assert.doesNotMatch(loader,/prisma\.|create|upsert|ensure/);
    // AI検索対策の組織はブランドの一覧なので、会社名に使わない
    assert.doesNotMatch(loader,/lib\/aio\//);
    for(const f of ['src/app/(shell)/shodan/page.tsx','src/app/(shell)/aio/page.tsx'])assert.match(read(f),/&& \(await isUiNext\(\)\)\) \{/,f);
    assert.match(read('src/app/(shell)/home/page.tsx'),/uiNext \? <HomeDashboard/);
    assert.match(read('src/app/pricing/page.tsx'),/if \(!\(await isUiNext\(\)\)\) return <PricingLegacy \/>/);
    // 新しい料金ページも、購入は同じボタンと同じプラン ID を使う
    assert.match(read('src/components/pricing/PricingNext.tsx'),/<CheckoutButton planId=\{UNIFIED_PRO_PLAN_ID\}/);
    assert.match(read('src/components/DashboardLayout.tsx'),/if \(inShell && uiNext\)/);
    assert.match(read('src/components/shell/ShellLoading.tsx'),/if \(!uiNext\) return null/);
    const shell=read('src/components/shell/AppShell.tsx');
    assert.match(shell,/if \(!uiNext\) return \[\]/);
    assert.match(shell,/withIntents=\{uiNext\}/);
    assert.match(shell,/\{uiNext \? \(\s*<button type="button" className=\{styles\.tab\} onClick=\{openAccount\}>/);
    assert.match(read('src/components/DashboardSidebar.tsx'),/if \(inShell && uiNext\) return null/);
    assert.match(shell,/if \(!uiNext \|\| !el \|\| typeof MutationObserver === 'undefined'\) return/);
    // CSS の直しは data-ui-next の下だけ
    const css=read('src/components/shell/AppShell.module.css');
    for(const line of css.split('\n').filter(l=>/h-screen|min-h-screen|calc\(100vh/.test(l)&&!l.trim().startsWith('*')&&!l.trim().startsWith('/*')))assert.match(line,/\[data-ui-next='true'\]/,line);
    assert.match(read('src/app/(shell)/template.module.css'),/\[data-ui-next='true'\]\) \.enter \{/);
    assert.doesNotMatch(read('src/components/ds/tokens.module.css'),/^\.ds \{\s*word-break/m);
    // クライアントは cookie を読まない（判定はサーバーだけ）
    for(const f of ['src/components/shell/ui-next-context.tsx','src/components/shell/UiNextBadge.tsx','src/components/shell/ShellGate.tsx'])assert.doesNotMatch(read(f),/document\.cookie|doya_ui_next/,f);
  });
  console.log(JSON.stringify({scope:'ui-next preview gate and /api/ui-preview with synthetic sessions and cookies. No DB, billing or AI.'}));
})().catch(e=>{console.error(e);process.exitCode=1});
