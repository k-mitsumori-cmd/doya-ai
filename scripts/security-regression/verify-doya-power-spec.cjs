// ドヤパワーの仕様の確認（静的）: 作り直しは半分・毎日の回復は無料だけ・0のときの3択・表示の設定・成長の名前・絵文字なし。
// 中身の動作は src/lib/doya-power/charge.test.ts（npm run test:doyapower）が見る。
const fs = require('node:fs'); const path = require('node:path'); const assert = require('node:assert/strict');
const root = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const core = read('src/lib/doya-power/charge-core.ts');
// 5分と半分の決まりは retry.ts に移った（作り直しの配線、2026-10-24）。中心は retry.ts の定数と halfAmount を使う
const retry = read('src/lib/doya-power/retry.ts');
assert.match(retry, /RETRY_HALF_WINDOW_MS = 5 \* 60_000/); assert.match(retry, /Math\.ceil\(amount \/ 2\)/); assert.match(core, /from '\.\/retry'/); assert.match(core, /withinMs: RETRY_HALF_WINDOW_MS/); assert.match(core, /recentConsume/);
const ledger = read('src/lib/doya-power/ledger.ts');
assert.match(ledger, /paid \? 0 : dailyRecoveryToAdd/); assert.match(ledger, /isPaidCompany/);
assert.match(read('src/lib/doya-power/index.ts'), /isPaidPlan\(user\?\.plan\)/);
const ui = read('src/components/doya-power/DoyaPower.tsx');
for (const t of ['回復するのを待つ', '追加する', 'チームにする', "addHref = '/pricing'", "teamHref = '/pricing'"]) assert.ok(ui.includes(t), t);
assert.ok(ui.includes('size={64}'));
const cat = read('src/lib/collection/catalog.ts'); assert.match(cat, /label: '一人前'/); assert.ok(!cat.includes("label: 'プロ'"));
assert.match(read('src/lib/missions/rules.ts'), /company_profile.*reward: 50/); assert.match(read('src/lib/missions/rules.ts'), /invite_member.*reward: 100/);
assert.match(read('src/lib/collection/bonus-actions.ts'), /sourceKey: stampSetKey/);
for (const f of ['CollectionView', 'MissionsBoard', 'AnnualReportView']) {
  const p = f === 'CollectionView' ? 'collection' : f === 'MissionsBoard' ? 'missions' : 'annual-report';
  assert.ok(read(`src/components/${p}/${f}.tsx`).includes('DoyaPowerFxSettings'), f);
}
const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
for (const f of ['src/components/doya-power/DoyaPower.tsx', 'src/components/doya-power/DoyaPowerFxSettings.tsx', 'src/components/collection/CollectionView.tsx', 'src/components/missions/MissionsBoard.tsx', 'src/components/annual-report/AnnualReportView.tsx']) assert.ok(!emoji.test(read(f).split('\n').filter((l) => !/^\s*(\/\/|\/?\*|\{?\/\*)/.test(l)).join('\n').replace(/\/\/.*$/gm, '')), `絵文字: ${f}`);
console.log('verify-doya-power-spec: OK');
