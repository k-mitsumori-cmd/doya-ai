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
  await check('Layout passes no balance until the ledger table exists, and the gate drops it when the flag is off',async()=>{
    const layout=code('src/app/(shell)/layout.tsx');
    assert.match(layout,/const doyaPowerState = null/);
    assert.doesNotMatch(layout,/doya-power\/(ledger|index)|getBalance|\/api\/doya-power/);
    assert.match(read('src/components/shell/ShellGate.tsx'),/<ShellPowerProvider value=\{uiNext && doyaPower \? doyaPowerState : null\}>/);
    assert.match(read('src/components/shell/ShellGate.tsx'),/<DoyaPowerContext\.Provider value=\{Boolean\(uiNext && doyaPower\)\}>/);
  });
  await check('No balance API route is added before the ledger table is in production',async()=>{
    assert.equal(fs.existsSync(path.join(root,'src/app/api/doya-power/balance/route.ts')),false);
  });
  console.log(JSON.stringify({scope:'Shell DoyaPower placement: flag-off renders nothing and never reads the ledger. Static source checks only.'}));
})().catch(e=>{console.error(e);process.exitCode=1});
