// 新しい見た目（UI-QUALITY-CHECKLIST §5.1）を全員に出し終えたあと（2026-10-24 FRM-07）の回帰テスト。
// - 旗 UI_NEXT_ROLLOUT・プレビューの cookie（doya_ui_next）・切り替えの API（/api/ui-preview）・プレビュー中の札は無い
// - isUiNext() は環境変数・cookie・セッションを見ずにいつも true（読みに行かない）
// - ログインしている人のときだけ、枠の会社・リンクの行き先・最近使ったツールを読む。会社の読み込みは組織を作らない
// - 料金ページは PricingNext だけ。購入は同じボタンと同じプラン ID、トライアルの表示の決まりは変えない
// 合成の値と、ソースの静的な確認だけを使う。DB・課金・AI には触れない。
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{load,check}=require('./load-typescript.cjs');
const root=path.resolve(__dirname,'../..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const exists=f=>fs.existsSync(path.join(root,f));
(async()=>{
  await check('isUiNext() is always true without reading env, cookies or the session',async()=>{
    const touched=[];
    const trap=name=>new Proxy({},{get:()=>{touched.push(name);throw Error('must not read '+name)}});
    for(const UI_NEXT_ROLLOUT of ['off','preview','all',undefined]){
      const m=load('src/lib/ui-next.ts',{'next/headers':trap('next/headers'),'next-auth':trap('next-auth'),'@/lib/auth':trap('@/lib/auth')},{process:{env:{UI_NEXT_ROLLOUT,UI_PREVIEW_EMAILS:'owner@example.invalid'}},Promise});
      assert.equal(await m.isUiNext(),true,String(UI_NEXT_ROLLOUT));
      assert.equal(m.uiNextMode,undefined);assert.equal(m.uiNextRollout,undefined);assert.equal(m.decideUiNext,undefined);
      // ドヤパワーの preview が使う許可の一覧は残す
      assert.equal(m.canPreviewUiNext('OWNER@example.invalid'),true);assert.equal(m.canPreviewUiNext('other@example.invalid'),false);
    }
    assert.deepEqual(touched,[]);
    const lib=read('src/lib/ui-next.ts');
    assert.doesNotMatch(lib,/process\.env\.UI_NEXT_ROLLOUT|doya_ui_next|UI_NEXT_COOKIE|next\/headers|cookies\(/);
  });
  await check('The preview toggle API, cookie and badge are gone',async()=>{
    assert.equal(exists('src/app/api/ui-preview/route.ts'),false);
    assert.equal(exists('src/components/shell/UiNextBadge.tsx'),false);
    const walk=d=>fs.readdirSync(path.join(root,d),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):/\.(tsx?|jsx?)$/.test(e.name)?[path.join(d,e.name).split(path.sep).join('/')]:[]);
    // コメントの説明（やめた経緯）は除いて、コードに残っていないことを確かめる
    const code=f=>read(f).split('\n').filter(l=>!/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join('\n');
    for(const f of walk('src'))assert.doesNotMatch(code(f),/doya_ui_next|\/api\/ui-preview|UiNextBadge|UI_NEXT_ROLLOUT/,f);
    // クライアントの部品は cookie で見た目を決めない
    for(const f of ['src/components/shell/ui-next-context.tsx','src/components/shell/ShellGate.tsx'])assert.doesNotMatch(read(f),/document\.cookie/,f);
    assert.doesNotMatch(read('src/components/shell/ui-next-context.tsx'),/UiNextContext|useUiNextMode/);
  });
  await check('Shell data is read only for signed-in users and never creates organizations',async()=>{
    const layout=read('src/app/(shell)/layout.tsx');
    assert.match(layout,/const signedIn = Boolean\(session\?\.user\)/);
    // 組織のページへのリンクの行き先と会社の名前は、ログインしている人のときだけ読んで渡す
    assert.match(layout,/const \[company, toolHrefs\] = signedIn\n\s*\? await Promise\.all/);
    assert.match(layout,/getAccountCompanyName\(\)\.catch/);
    // 最近使ったツールは、ログインしている人のときだけ cookie から読んで渡す
    assert.match(layout,/const initialRecent = signedIn \? parseRecent/);
    assert.doesNotMatch(layout,/uiNext/);
    const gate=read('src/components/shell/ShellGate.tsx');
    assert.match(gate,/ShellToolHrefsContext\.Provider value=\{toolHrefs \?\? EMPTY\}/);
    assert.match(gate,/AccountCompanyContext\.Provider value=\{company\}/);
    assert.match(gate,/shouldShowShell\(pathname, \{ signedIn \}\)/);
    assert.match(gate,/return session\?\.user \? <SessionProvider session=\{session\}>/);
    assert.doesNotMatch(gate,/uiNext/);
    assert.doesNotMatch(read('src/lib/shell/tool-hrefs.server.ts'),/prisma\.|create|upsert|ensure\w*\(/);
    // 候補はログイン中の人の所属だけを読む関数から作る（組織を作らない）
    const loader=read('src/lib/shell/company.server.ts');
    // 書き込むのは本人の会社の表（accountCompany）だけ。各ツールの組織は読むだけ（詳しくは verify-account-company-scope.cjs）
    assert.doesNotMatch(loader,/prisma\.(?!accountCompany\b|user\.findUnique)\w+\.\w+/);assert.doesNotMatch(loader,/ensure\w*\(/);
    // AI検索対策の組織はブランドの一覧なので、会社名に使わない
    assert.doesNotMatch(loader,/lib\/aio\//);
    // 組織を選ぶツールの入口は、所属があれば組織のページへ移すだけ（ログインしている人だけ）
    for(const f of ['src/app/(shell)/shodan/page.tsx','src/app/(shell)/aio/page.tsx','src/app/(shell)/sfa/page.tsx']){
      const src=read(f);assert.match(src,/if \(!session\?\.user\) return <\w+Lp \/>/,f);assert.match(src,/if \(Object\.keys\(params\)\.length === 0\) \{/,f);assert.doesNotMatch(src,/isUiNext/,f);
    }
    // 経営ホームは入力が主役のホームだけ（旧来のホームは無い）
    assert.equal(exists('src/app/(shell)/home/HomeDashboardLegacy.tsx'),false);
    assert.match(read('src/app/(shell)/home/page.tsx'),/return <HomeDashboard initial=\{summary\}/);
  });
  await check('Pricing page, shell chrome and CSS use only the new look',async()=>{
    assert.equal(exists('src/app/pricing/PricingLegacy.tsx'),false);
    assert.doesNotMatch(read('src/app/pricing/page.tsx'),/PricingLegacy|uiNext/);
    // 旗 NEW_PRICING_ROLLOUT が off（view === 'current'）なら、ログインの有無にかかわらず PricingNext を出す（新しい料金は PricingV2。2026-10-25）
    const pricingPage=read('src/app/pricing/page.tsx');
    assert.match(pricingPage,/const view = await resolvePricingView\(/);
    assert.match(pricingPage,/view === 'current'\s*\? <PricingNext canceled=\{canceled\} serverSignedIn=\{false\} \/>/);
    assert.match(pricingPage,/view === 'current'\s*\? <PricingNext canceled=\{canceled\} inShell serverSignedIn /);
    // 新しい料金ページも、購入は同じボタンと同じプラン ID を使う
    assert.match(read('src/components/pricing/PricingNext.tsx'),/<CheckoutButton planId=\{UNIFIED_PRO_PLAN_ID\}/);
    // 有料のプランの人には、トライアルの表示を出さない（trial-eligibility の API と TrialCallout は変えない）
    assert.match(read('src/components/pricing/PricingNext.tsx'),/const trialEligible = trialEligibleRaw && !paid/);
    assert.match(read('src/components/pricing/PricingNext.tsx'),/const paid = authStatus === 'authenticated' && isPaidPlan\(accountPlan\)/);
    // 枠の中では、旧来のサイドバー付きの外枠を出さない（未ログインのバナーの画面だけが今の外枠）
    assert.match(read('src/components/DashboardLayout.tsx'),/if \(inShell\) return <>\{children\}<\/>/);
    // (shell) の下に、こちらで足した loading.tsx を置かない。template は中身の入れ替えの包みだけを出す
    // ⚠️ git ls-files は使わない（Vercel のビルドには .git が無く、失敗してデプロイが止まる。2026-10-19）
    const fsx=require('node:fs'),px=require('node:path');
    const walk=(d)=>fsx.readdirSync(px.join(root,d),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(px.join(d,e.name)):e.name==='loading.tsx'?[px.join(d,e.name).split(px.sep).join('/')]:[]);
    const loadings=walk('src/app/(shell)');
    assert.deepEqual(loadings.sort(),['src/app/(shell)/banner/dashboard/loading.tsx','src/app/(shell)/popup/edit/[id]/loading.tsx','src/app/(shell)/popup/sites/[id]/loading.tsx']);
    assert.match(read('src/app/(shell)/template.tsx'),/return <div className=\{styles\.enter\}>\{children\}<\/div>/);
    const shell=read('src/components/shell/AppShell.tsx');
    assert.doesNotMatch(shell,/uiNext|useUiNext/);
    assert.match(shell,/data-ui-next="true"/);
    assert.match(shell,/withIntents=\{true\}/);
    assert.match(shell,/<button type="button" className=\{styles\.tab\} onClick=\{openAccount\}>/);
    assert.match(read('src/components/DashboardSidebar.tsx'),/if \(inShell\) return null/);
    assert.match(shell,/if \(!el \|\| typeof MutationObserver === 'undefined'\) return/);
    // 2026-10-24 分かりやすさの点検（FRM-02・03）: 左のメニューの「最近使ったツール」と、
    // スマホの下のタブの入れ替わる枠を出さない（どの画面でも同じ並び）
    assert.match(shell,/const recentTools: ShellTool\[\] = \[\]/);
    assert.match(shell,/const tabTools: ShellTool\[\] = \[\]/);
    // CSS の直しは data-ui-next の下だけ
    const css=read('src/components/shell/AppShell.module.css');
    for(const line of css.split('\n').filter(l=>/h-screen|min-h-screen|calc\(100vh/.test(l)&&!l.trim().startsWith('*')&&!l.trim().startsWith('/*')))assert.match(line,/\[data-ui-next='true'\]/,line);
    assert.match(read('src/app/(shell)/template.module.css'),/\[data-ui-next='true'\]\) \.enter \{/);
    assert.doesNotMatch(read('src/components/ds/tokens.module.css'),/^\.ds \{\s*word-break/m);
  });
  console.log(JSON.stringify({scope:'ui-next is always on: no rollout flag, preview cookie, toggle API or badge; signed-in-only shell data; static source checks. No DB, billing or AI.'}));
})().catch(e=>{console.error(e);process.exitCode=1});
