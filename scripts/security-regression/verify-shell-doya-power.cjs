// 共通の枠のドヤパワー（残りのゲージ・ボタンの減る量）の置き場所の回帰テスト（2026-10-23）。
// - 旗（DOYA_POWER_ROLLOUT）が off の人・新しい見た目でない人には、何も描かない
// - 台帳の表が本番DBに入るまでは、残りを読まない（layout は null を渡す。部品は台帳・API・fetch を使わない）
// ⚠️ git のコマンドは使わない。ファイルは fs で読む。DB・課金・AI には触れない。
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{check}=require('./load-typescript.cjs');
const root=path.resolve(__dirname,'../..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
// コメント（// と /* */）を除いた本文。説明の文に出てくる API の名前などで誤って落ちないように
const code=f=>read(f).replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:])\/\/.*$/gm,'$1');
(async()=>{
  await check('Shell power parts never read the ledger, an API or the network',async()=>{
    const src=code('src/components/shell/power.tsx');
    assert.doesNotMatch(src,/fetch\(|@\/lib\/doya-power\/(ledger|index|memory-db)|prisma|\/api\/doya-power/);
    // 旗が off なら何も描かない（ゲージ）。札は CostBadge が旗を見る
    assert.match(src,/if \(!enabled \|\| !balance\) return null/);
    assert.match(read('src/components/ds/cost-badge.tsx'),/if \(!enabled\) return null/);
  });
  await check('Layout reads the balance only when the flag allows it, and the gate drops it when the flag is off',async()=>{
    // 台帳の表が本番DBに入った（2026-10-23）。旗が出すと決めた人だけ、charge.ts の shellState で読む
    const layout=code('src/app/(shell)/layout.tsx');
    assert.match(layout,/const doyaPowerState = doyaPower \? await doyaPowerCharger\.shellState\(\)\.catch\(\(\) => null\) : null/);
    assert.doesNotMatch(layout,/doya-power\/(ledger|index)'|\/api\/doya-power/);
    assert.match(read('src/components/shell/ShellGate.tsx'),/<ShellPowerProvider value=\{uiNext && doyaPower \? doyaPowerState : null\}>/);
    assert.match(read('src/components/shell/ShellGate.tsx'),/<DoyaPowerContext\.Provider value=\{Boolean\(uiNext && doyaPower\)\}>/);
  });
  await check('Balance API checks the flag before reading anything',async()=>{
    // 台帳の表が入ったので残りの API を作った。旗が off なら、何も読まずに 404（詳しくは verify-doya-power-charge-routes.cjs）
    assert.match(code('src/app/api/doya-power/balance/route.ts'),/if \(doyaPowerRollout\(\) === 'off'\) return NextResponse\.json/);
  });
  await check('Home power card and history page check the flag first and read only the session company',async()=>{
    // 経営ホームの欄・内訳と履歴の画面（2026-10-23）。旗が off なら何も読まない。会社はセッションの本人の会社だけ（charger.target）
    const loader=code('src/lib/doya-power/home.server.ts');
    assert.match(loader,/if \(doyaPowerRollout\(\) === 'off'\) return null\n  try \{\n    const who = await doyaPowerCharger\.target\(\)/);
    assert.doesNotMatch(loader,/companyId: (body|query|params|searchParams)/);
    const home=code('src/app/(shell)/home/page.tsx');
    assert.match(home,/const power = \(await isDoyaPowerEnabled\(\)\) \? await loadDoyaPowerHome\(\) : null/);
    const page=code('src/app/(shell)/home/doya-power/page.tsx');
    const flag=page.indexOf('if (!(await isDoyaPowerEnabled())) notFound()'),session=page.indexOf('getServerSession(');
    assert.ok(flag>0&&session>flag,'flag before session');
    // 履歴に操作の ID（会社やクライアントのキーを含む）を出さない
    assert.doesNotMatch(code('src/components/doya-power/DoyaPowerHome.tsx'),/operationId/);
    // 枠のゲージ（ドヤパワーの入口）は、内訳と履歴の画面へ
    assert.match(code('src/components/shell/power.tsx'),/href = '\/home\/doya-power'/);
  });
  await check('The shell passes the mascot and effects setting only when the flag allows it',async()=>{
    const layout=code('src/app/(shell)/layout.tsx');
    assert.match(layout,/const doyaPowerFx = doyaPower && userId \? /);
    assert.match(read('src/components/shell/ShellGate.tsx'),/<DoyaPowerFxProvider fx=\{uiNext && doyaPower \? doyaPowerFx : undefined\}>/);
  });
  console.log(JSON.stringify({scope:'Shell DoyaPower placement: flag-off renders nothing and never reads the ledger. Static source checks only.'}));
})().catch(e=>{console.error(e);process.exitCode=1});
