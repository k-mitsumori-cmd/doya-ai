import { oshiAcquisitionMessage } from './oshi-acquisition-report';
import { getLatestDailyRows, makeJwt, jstDate, type SalesRow } from './appstore-sales-core';
import { prisma } from './prisma';

export const DOWNLOAD_APPS = [
  { id: '6808881452', name: '推しにマイル', webhook: 'SLACK_OSHI_ERROR_WEBHOOK_URL' },
  { id: '6802064148', name: 'ヒトリジメ', webhook: 'SLACK_HITORIJIME_ERROR_WEBHOOK_URL' },
  { id: '6808880949', name: '弊社、限界につき。', webhook: 'HEISHA_SLACK_ERROR_WEBHOOK_URL' },
];
export function countDownloads(rows: SalesRow[], appId: string) {
  let first = 0, again = 0;
  for (const row of rows) {
    if (row['Apple Identifier'] !== appId) continue;
    const units = Number((row.Units || '0').replace(/,/g, ''));
    if (!Number.isFinite(units) || units <= 0) continue;
    const type = row['Product Type Identifier'];
    if (['1', '1F', '1T', '1E', '1EP', '1EU', 'F1'].includes(type)) first += units;
    else if (['3', '3F', '3T', 'F3'].includes(type)) again += units;
  }
  return { first, again };
}
export function downloadMessage(name: string, date: string | null, counts: { first: number; again: number } | null) {
  return [
    `【${name}】本日のダウンロード報告`,
    date ? `Appleの集計対象日：${date}` : '集計状態：Appleの直近3日分のレポートを取得できていません。',
    counts ? `初めてダウンロードされた回数：${counts.first}件` : 'ダウンロード数：未集計（0件とは扱いません）',
    counts ? `以前に入手した方の再ダウンロード：${counts.again}件` : '',
    counts ? `合計：${counts.first + counts.again}件` : '',
    'App Storeの実績です。アプリ更新・TestFlight・テスト購入はこの件数に含めません。',
    'Appleの集計は遅れて届くため、必ず上の対象日を確認してください。',
  ].filter(Boolean).join('\n');
}
export async function sendServiceDownloadReports(dryRun = false) {
  let latest: Awaited<ReturnType<typeof getLatestDailyRows>> = null;
  let fetchFailed = false;
  try { latest = await getLatestDailyRows(makeJwt()); }
  catch (error) { fetchFailed = true; console.error('[daily-downloads] Apple report fetch failed', error); }
  const today = jstDate(0);
  return Promise.all(DOWNLOAD_APPS.map(async app => {
    let text = downloadMessage(app.name, latest?.reportDate ?? null, latest ? countDownloads(latest.rows, app.id) : null);
    if (fetchFailed) text = text.replace('Appleの直近3日分のレポートを取得できていません。', 'Appleとの通信・認証で取得に失敗しました。数値は未確認です。');
    if (app.id === '6808881452') text += '\n\n' + await oshiAcquisitionMessage();
    if (dryRun) return { app: app.name, text, sent: false };
    try {
      const key = `slack:daily-downloads:${app.id}`;
      const previous = await prisma.systemSetting.findUnique({ where: { key } });
      if (previous?.value === today) return { app: app.name, skipped: true };
      const url = process.env[app.webhook];
      if (!url) throw new Error('Notification destination missing');
      const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`Slack HTTP ${response.status}`);
      await prisma.systemSetting.upsert({ where: { key }, create: { key, value: today }, update: { value: today } });
      return { app: app.name, sent: true, reportDate: latest?.reportDate ?? null };
    } catch (error) { console.error('[daily-downloads]', app.name, error); return { app: app.name, sent: false, error: 'notification_failed' }; }
  }));
}
