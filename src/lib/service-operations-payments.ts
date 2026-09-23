import { OPS_SERVICES, serviceRows, dayStart, shiftDay, type Row } from './service-operations-data';
import { readOps, writeOps, sendOps } from './service-operations-state';
import { createHash } from 'node:crypto';
export function purchaseGroups(rows: Row[]) {
  return ['PRODUCTION', 'SANDBOX', 'UNKNOWN'].map(environment => {
    const selected = rows.filter(r => (['PRODUCTION', 'SANDBOX'].includes(String(r.environment).toUpperCase()) ? String(r.environment).toUpperCase() : 'UNKNOWN') === environment && r.status === 'completed');
    return { environment, count: selected.length, amount: selected.reduce((s, r) => s + (Number(r.amount_jpy) || 0), 0) };
  });
}
export function unmatchedPurchases(purchases: Row[], ledger: Row[]): Row[] {
  // 取引IDが台帳にないので、利用者・付与数・同時刻を一対一で照合する。確定的な未付与判定ではない。
  const available = [...ledger];
  return purchases.filter(p => {
    if (p.status !== 'completed' || !(Number(p.credits) > 0)) return false;
    const index = available.findIndex(l => l.user_id === p.user_id && Number(l.delta) === Number(p.credits) && Math.abs(Date.parse(l.created_at) - Date.parse(p.created_at)) < 1000);
    if (index < 0) return true;
    available.splice(index, 1); return false;
  });
}
export async function paymentStatus(service: typeof OPS_SERVICES[number], day: string, dry = false): Promise<string[]> {
  if (!['noroi', 'yurusen', 'oshi'].includes(service.key) || !service.prefix) return [service.key === 'doya' ? '本番Stripeとプラン反映の照合は既存の課金監査でチェック中だよ。' : '決済事業者と商品付与を結ぶ独立した購入照合データは未接続です。既存の決済処理エラー通知とは別に、照合設定が必要です。'];
  const start = dayStart(day), end = dayStart(shiftDay(day, 1));
  const [rows, ledger] = await Promise.all([
    serviceRows(service.prefix, 'purchases', 'id,user_id,amount_jpy,credits,environment,status,created_at', { and: `(created_at.gte.${dayStart(shiftDay(day, -30))},created_at.lt.${end})` }),
    serviceRows(service.prefix, service.key === 'oshi' ? 'miles_ledger' : 'credits_ledger', 'user_id,delta,created_at', { reason: 'eq.purchase', and: `(created_at.gte.${start},created_at.lt.${end})` }),
  ]);
  const today = rows.filter(r => Date.parse(r.created_at) >= Date.parse(start));
  const groups = purchaseGroups(today);
  const lines = groups.map(g => `${g.environment === 'PRODUCTION' ? '本番の購入記録' : g.environment === 'SANDBOX' ? 'テスト購入・売上に含めない分' : '区分未確認・売上に含めない分'}：${g.count}件／${g.amount.toLocaleString('ja-JP')}円`);
  const mismatch = unmatchedPurchases(today, ledger);
  lines.push(`購入と付与台帳の照合：${mismatch.length ? `確認が必要な購入 ${mismatch.length}件` : '取得した購入分に照合不一致なし'}。台帳に取引IDがないため、未付与の確定判定ではありません。`);
  if (mismatch.length && !dry) await sendOps(service.key, `【${service.name}・要確認】購入と商品付与の記録が一致していないよ\n対象日：${day}\n確認対象：${mismatch.length}件（テストを含む場合があります）\n確認すること：決済管理画面・購入記録・付与台帳を照合してね。二重付与を防ぐため、自動で再付与はしていないよ。`, `payment-mismatch:${service.key}:${day}`, 'error');
  const previous = await readOps<Record<string, string>>('purchase-status:' + service.key);
  const hash = (id: string) => createHash('sha256').update(id).digest('hex');
  const current = Object.fromEntries(rows.map(r => [hash(r.id), `${r.status}:${r.environment}`]));
  const changedRefunds = previous ? rows.filter(r => r.status === 'refunded' && String(r.environment).toUpperCase() === 'PRODUCTION' && previous[hash(r.id)] !== current[hash(r.id)]) : [];
  lines.push(`直近31日間の購入分で現在返金済み：${rows.filter(r => r.status === 'refunded' && String(r.environment).toUpperCase() === 'PRODUCTION').length}件（返金された日付別の件数ではありません）。`);
  if (changedRefunds.length && !dry) await sendOps(service.key, `【${service.name}】本番購入の返金を確認したよ\n前回確認から新しく返金済みになった購入：${changedRefunds.length}件\n対象は直近31日間の購入分。返金日そのものは取得していません。決済管理画面で理由と反映状況を確認してね。`, `refund:${service.key}:${day}`, 'steady');
  if (!dry) await writeOps('purchase-status:' + service.key, current);
  return [...lines, '購入記録の金額は入金額ではありません。決済通知そのものが届いていない購入は、このDB照合だけでは検出できません。'];
}
