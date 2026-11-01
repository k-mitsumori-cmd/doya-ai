// ドヤパワーの減る量の表と、ボタンの札の回帰テスト（仮・2026-10-23）。
// - 表（src/lib/doya-power/costs.ts）の値が、指示どおり（1ポイント ≈ 3円）
// - 旗（DOYA_POWER_ROLLOUT）が off の人には、札を描かない（ボタンの見た目も幅も今と同じ）
// - 各ツールの札の操作の名前は、すべて表にある（表に無い名前は札が出ず、気づけないため）
// ⚠️ git のコマンドは使わない。ファイルは fs でたどる。DB・課金・AI には触れない。
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{load,check}=require('./load-typescript.cjs');
const root=path.resolve(__dirname,'../..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const code=f=>read(f).replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:])\/\/.*$/gm,'$1');
function walk(dir){return fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(path.join(dir,d.name)):/\.tsx?$/.test(d.name)?[path.join(dir,d.name)]:[])}
const costs=load('src/lib/doya-power/costs.ts',{});
(async()=>{
  await check('Cost table matches the agreed provisional values',async()=>{
    const expected={'text.generate':1,'banner.generate':10,'image.refine':7,'tenjikai.image':7,'transcribe.hour':10,'interview.article':20,'slide.generate':30,'seo.article':40,'persona.generate':50,'aio.scan.question':10,'agent.plan':5,kintai:0,promane:0,income:0,expense:0};
    for(const [k,v] of Object.entries(expected))assert.equal(costs.DOYA_POWER_COSTS[k],v,k);
    // 音声は1分 5（2026-10-23 ユーザー決定。既定は high）。定数で切り替えられる
    assert.equal(costs.VOICE_COST_MODE,'high');
    assert.equal(costs.DOYA_POWER_COSTS['voice.minute'],5);
    assert.equal(costs.VOICE_COST_PER_MINUTE.standard,3);
    assert.equal(costs.VOICE_COST_PER_MINUTE.high,5);
    assert.equal(costs.DOYA_POWER_COSTS['voice.minute'],costs.VOICE_COST_PER_MINUTE[costs.VOICE_COST_MODE]);
    assert.equal(costs.doyaPowerCost('aio.scan.question',3),30);
    assert.equal(costs.doyaPowerCost('banner.generate'),10);
    assert.equal(costs.doyaPowerCost('unknown.action'),null);
    assert.equal(costs.doyaPowerCost('tenjikai.image',0),7);
  });
  await check('Badges render nothing when the DoyaPower flag is off or the cost is zero',async()=>{
    const shell=code('src/components/shell/power.tsx');
    // 旗を最初に見て、off なら表も引かずに何も描かない
    assert.match(shell,/export function ShellCostBadge[\s\S]*?const enabled = useDoyaPower\(\)[\s\S]*?if \(!enabled\) return null/);
    assert.match(shell,/if \(cost === null \|\| !Number\.isFinite\(cost\) \|\| cost <= 0\) return null/);
    assert.match(code('src/components/ds/cost-badge.tsx'),/if \(!enabled\) return null/);
    // 旗の既定は off のまま
    const flag=load('src/lib/doya-power/flag.ts',{'@/lib/ui-next':{canPreviewUiNext:()=>false,uiPreviewEmails:()=>[]}},{process:{env:{}}});
    assert.equal(flag.doyaPowerRollout(undefined),'off');
  });
  await check('Every badge in the tools names an action that exists in the table',async()=>{
    const used=new Map();
    for(const f of [...walk('src/app'),...walk('src/components')]){
      const src=read(f);
      for(const m of src.matchAll(/<ShellCostBadge\s+action="([^"]+)"/g))used.set(m[1],[...(used.get(m[1])||[]),f]);
    }
    assert.ok(used.size>=10,'badges placed: '+used.size);
    for(const [action,files] of used)assert.ok(action in costs.DOYA_POWER_COSTS,`unknown action ${action} in ${files.join(', ')}`);
    // 減る量が 0 の操作には、各ツールの札を置かない（見本のページは「0 なら何も出ない」ことを見せるので除く）
    const isSample=f=>/DoyaPowerDemo\.tsx$|[\\/]ds-preview[\\/]/.test(f);
    for(const a of ['kintai','promane','income','expense'])assert.ok(!(used.get(a)||[]).some(f=>!isSample(f)),a);
  });
  console.log(JSON.stringify({scope:'DoyaPower provisional cost table and button badges. Static checks and pure functions only.'}));
})().catch(e=>{console.error(e);process.exitCode=1});
