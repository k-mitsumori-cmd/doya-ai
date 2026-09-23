import { buildSpendReport } from './spend-report';
import { jstDay } from './service-operations-data';
import { readOps, writeOps, sendOps } from './service-operations-state';
export async function monitorCost(dry = false) {
  const report = await buildSpendReport();
  const comparable = report.costs.filter(c => c.money !== null);
  const amount = comparable.reduce((s, c) => s + c.money!.jpy, 0);
  const sources = comparable.map(c => c.label).sort().join('|');
  const history = await Promise.all(Array.from({ length: 7 }, (_, i) => readOps<{ amount: number; sources: string }>('cost:' + jstDay(i + 2))));
  const values = history.filter((x): x is { amount: number; sources: string } => !!x && x.sources === sources).map(x => x.amount);
  const avg = values.length === 7 ? values.reduce((a, b) => a + b, 0) / 7 : null;
  const month = report.monthCosts.filter(c => c.money !== null).reduce((s, c) => s + c.money!.jpy, 0);
  const setting = await readOps<{ monthlyJpy: number }>('budget');
  const budget = setting?.monthlyJpy ?? Number(process.env.SLACK_MONTHLY_BUDGET_JPY || 0);
  const day = Number(jstDay().slice(8)), daysInMonth = new Date(Number(jstDay().slice(0, 4)), Number(jstDay().slice(5, 7)), 0).getDate();
  const projected = day > 1 && report.monthCosts.some(c => c.money !== null) ? month / (day - 1) * daysInMonth : null;
  const warnings = [];
  if (avg !== null && avg >= 100 && amount >= avg * 2 && amount - avg >= 1000) warnings.push(`昨日の取得可能な費用：${amount.toLocaleString('ja-JP')}円相当／直前7日平均：${Math.round(avg).toLocaleString('ja-JP')}円相当`);
  if (budget > 0 && projected !== null && projected >= budget) warnings.push(`月末見込み：${Math.round(projected).toLocaleString('ja-JP')}円相当／設定予算：${budget.toLocaleString('ja-JP')}円`);
  const note = `対象：${sources || '費用を取得できた提供元なし'}。円表示は既存レポートの換算値、月末見込みは単純な日割り予測です。取得できない提供元の費用は含みません。`;
  if (!dry) {
    await writeOps('cost-report:' + jstDay(1), { amount: comparable.length ? amount : null, budget: budget || null, projected, note, missing: report.costs.filter(c => c.money === null).map(c => c.label) });
    if (comparable.length) await writeOps('cost:' + jstDay(1), { amount, sources });
    if (warnings.length) await sendOps('doya', ['【ドヤAI・要確認】費用の増え方をチェックしてね', ...warnings, note, '設定変更やAPI停止は自動で行っていません。利用内容と請求画面を確認してね。'].join('\n'), 'cost-warning:' + jstDay(), 'error');
  }
  return { amount: comparable.length ? amount : null, budget: budget || null, projected, warnings, note, missing: report.costs.filter(c => c.money === null).map(c => c.label) };
}
