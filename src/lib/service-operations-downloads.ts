import { getLatestDailyRows, makeJwt } from './appstore-sales-core';
import { OPS_SERVICES, shiftDay } from './service-operations-data';
import { readOps, writeOps, sendOps } from './service-operations-state';
export async function collectDownloadChanges(dry = false): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  const latest = await getLatestDailyRows(makeJwt());
  for (const service of OPS_SERVICES.filter(s => s.appId)) {
    if (!latest) { out[service.key] = ['Appleのレポート待ち。0件として扱っていないよ。']; continue; }
    const count = latest.rows.filter(r => r['Apple Identifier'] === service.appId && ['1','1F','1T','1E','1EP','1EU','F1'].includes(r['Product Type Identifier'])).reduce((a,r) => a + Math.max(0, Number(String(r.Units || '0').replace(/,/g,'')) || 0),0);
    const history = await Promise.all(Array.from({ length: 7 }, (_,i) => readOps<{ count: number }>(`downloads:${service.key}:${shiftDay(latest.reportDate,-i-1)}`)));
    out[service.key] = [`Apple対象日：${latest.reportDate}／初回ダウンロード：${count}件`, `急変の比較データ：直前7日分のうち${history.filter(Boolean).length}日。Apple対象日が同じレポートは重ねて数えていません。`];
    if (history.every(Boolean)) {
      const avg = history.reduce((a,v) => a + v!.count,0)/7;
      if (avg >= 10 && Math.abs(count-avg)>=10 && (count>=avg*2 || count<=avg*.5)) {
        out[service.key].push(`直前7日平均${avg.toFixed(1)}件から大きな変化あり。`);
        if (!dry) await sendOps(service.key, `【${service.name}】ダウンロード数に変化があったよ\nApple対象日：${latest.reportDate}\n初回ダウンロード：${count}件／直前7日平均：${avg.toFixed(1)}件\n流入経路や掲載状況を確認してね。原因はまだ未確認です。`, `download-change:${service.key}:${latest.reportDate}`, count>avg?'up':'down');
      }
    }
    if (!dry) await writeOps(`downloads:${service.key}:${latest.reportDate}`,{count});
  }
  return out;
}
