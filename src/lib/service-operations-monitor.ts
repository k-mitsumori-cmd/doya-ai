import { OPS_SERVICES, jstDay, type ServiceKey } from './service-operations-data';
import { readOps, writeOps, sendOps } from './service-operations-state';
export const REPORT_EXPECTATIONS: { id: string; service: ServiceKey; name: string; minutes: number }[] = [
  { id: 'hitorijime-daily', service: 'hitorijime', name: '利用日報', minutes: 7 * 60 + 10 },
  { id: 'doya-daily', service: 'doya', name: '利用日報', minutes: 9 * 60 },
  { id: 'noroi-daily', service: 'noroi', name: '朝刊', minutes: 9 * 60 },
  { id: 'oshi-daily', service: 'oshi', name: '利用日報', minutes: 9 * 60 },
  { id: 'heisha-daily', service: 'heisha', name: '開発・審査日報', minutes: 9 * 60 },
  { id: 'yurusen-daily', service: 'yurusen', name: '朝刊', minutes: 9 * 60 + 25 },
  ...(['oshi', 'hitorijime', 'heisha'] as ServiceKey[]).map(service => ({ id: service + '-downloads', service, name: 'ダウンロード日報', minutes: 9 * 60 + 15 })),
];
export async function reportWatchStatus() {
  const armed = await readOps<{ day: string }>('watch-enabled');
  const now = new Date(Date.now() + 9 * 3600000), minute = now.getUTCHours() * 60 + now.getUTCMinutes();
  const today = jstDay();
  const missing = [];
  for (const report of REPORT_EXPECTATIONS) {
    if (!armed || armed.day >= today || minute < report.minutes + 30) continue;
    const receipt = await readOps<{ day: string; at: string }>('receipt:' + report.id);
    if (receipt?.day !== today) missing.push({ ...report, serviceName: OPS_SERVICES.find(s => s.key === report.service)!.name, lastSuccess: receipt?.at ?? null, centralNotified: !!await readOps('sent:missing:' + report.id + ':' + today), overdueMinutes: minute - report.minutes });
  }
  return { checkedAt: new Date().toISOString(), day: today, armed: !!armed, missing };
}
export async function monitorReportDelivery() {
  const status = await reportWatchStatus();
  for (const report of status.missing) await sendOps(report.service, `【${report.serviceName}・要確認】${report.name}の送信完了が確認できないよ\n予定時刻から30分以上経過しています。\n最後の送信成功：${report.lastSuccess || 'まだ記録なし'}\n確認すること：定期実行ログ・Slack送信結果・受信記録の連携を確認してね。送信成功後に確認記録だけ失敗した可能性もあります。`, `missing:${report.id}:${status.day}`, 'error');
  return status;
}
export async function observeServiceHealth(key: string, name: string, ok: boolean): Promise<void> {
  const previous = await readOps<{ ok: boolean; since: string }>('health:' + key);
  const now = new Date().toISOString();
  if (previous && !previous.ok && ok) {
    const service = OPS_SERVICES.find(s => s.name === name);
    await sendOps(service?.key ?? 'doya', `【${name}・復旧確認】公開URLの応答が戻ったよ\n異常を最初に確認：${previous.since}\n正常応答の確認：${now}\n継続時間：約${Math.max(1, Math.round((Date.now() - Date.parse(previous.since)) / 60000))}分\n確認できた範囲：公開URLへのHTTP接続。ログインや購入を実行して確認したものではありません。`, `recovery:${key}:${previous.since}`, 'recovered');
  }
  await writeOps('health:' + key, { ok, since: previous?.ok === ok ? previous.since : now });
}
