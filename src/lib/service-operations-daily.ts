import { collectDownloadChanges } from './service-operations-downloads';
import { checkServiceLinks } from './service-operations-links';
import { OPS_SERVICES, jstDay, shiftDay, dayStart, collectUsage, rateLabel, serviceRows, type ServiceKey, type UsageSnapshot } from './service-operations-data';
import { readOps, writeOps, sendOps, claimOps, releaseOps } from './service-operations-state';
import { voiceComment, metricMood } from './slack-voice';
import { searchTraffic } from './service-operations-search';
import { paymentStatus } from './service-operations-payments';
import { prisma } from './prisma';
export type OperationsDaily = { day: string; collectedAt: string; usage: UsageSnapshot | null; sections: string[]; missing: string[] };
export function significantChange(current: number, history: number[]): 'up' | 'down' | null {
  if (history.length < 7 || history.some(x => !Number.isFinite(x))) return null;
  const average = history.reduce((a, b) => a + b, 0) / history.length;
  if (average < 10 || Math.abs(current - average) < 10) return null;
  return current >= average * 2 ? 'up' : current <= average * .5 ? 'down' : null;
}
export async function collectDailyOperations(dry = false) {
  const day = jstDay(1), results = [];
  if (!dry && !await claimOps('collect:' + day, 360000)) return { skipped: true };
  try {
    const downloads = await collectDownloadChanges(dry).catch(() => null);
    for (const service of OPS_SERVICES) {
      const report: OperationsDaily = { day, collectedAt: new Date().toISOString(), usage: null, sections: [], missing: [] };
      try { report.usage = await collectUsage(service, day); } catch (e: any) { report.missing.push('利用・継続率：' + e.message); }
      if (service.appId) { if (downloads?.[service.key]) report.sections.push('■ ダウンロードの変化\n' + downloads[service.key].join('\n')); else report.missing.push('ダウンロード急変：Appleの取得に失敗しました'); }
      const [search, payment] = await Promise.allSettled([
        service.key === 'heisha' ? Promise.reject(new Error('公式サイトの検索対象URLが未設定です')) : searchTraffic(service.path, jstDay()),
        paymentStatus(service, day, dry),
      ]);
      if (search.status === 'fulfilled') report.sections.push('■ Google検索から見つけてもらえた？\n' + search.value.join('\n'));
      else report.missing.push('Google検索：' + String(search.reason?.message || '取得失敗'));
      if (payment.status === 'fulfilled') report.sections.push('■ 本番購入・テスト・返金を分けてチェック\n' + payment.value.join('\n'));
      else report.missing.push('購入・付与照合：' + String(payment.reason?.message || '取得失敗'));
      if (['oshi', 'noroi'].includes(service.key) && service.prefix) {
        try {
          const errors = await serviceRows(service.prefix, 'client_errors', 'app_version,created_at', { and: `(created_at.gte.${dayStart(day)},created_at.lt.${dayStart(shiftDay(day, 1))})` });
          const versions: Record<string, number> = {};
          for (const row of errors) { const key = String(row.app_version || 'バージョン未記録').replace(/[<>&]/g, '').slice(0, 60); versions[key] = (versions[key] || 0) + 1; }
          report.sections.push('■ アプリの版ごとのエラー\n' + (errors.length ? Object.entries(versions).map(([v, n]) => `・${v}：${n}件`).join('\n') : '届いている端末エラー報告は0件だよ。') + '\n起動数をバージョン別に取得していないため、エラー率は未算出。エラー報告が届かない端末の状態は確認できません。');
        } catch { report.missing.push('版別エラー：データを取得できません'); }
      } else report.missing.push('版別エラー率：バージョン別の起動・失敗データが未接続です');
      // 対応状態のないご意見を「未対応」と決めつけない。別途登録された対応状態だけで判定する。
      if (service.key === 'doya') {
       try {
        const feedback = await prisma.serviceFeedback.findMany({ where: { createdAt: { gte: new Date(dayStart(shiftDay(day, -30))) } }, select: { id: true, createdAt: true } });
        const unresolved: typeof feedback = []; let unknown = 0;
        for (const item of feedback) {
          const state = await readOps<{ status: string }>('feedback:' + item.id);
          if (state?.status === 'open') unresolved.push(item); else if (!state) unknown++;
        }
        report.sections.push(`■ 問い合わせの確認\n対応管理で未完了：${unresolved.length}件／対応状態が未登録：${unknown}件（直近31日の受信分）。\n未登録のご意見を、未返信と決めつけてはいないよ。対応状況の記録が必要です。`);
        if (unresolved.length && !dry) await sendOps('doya', `【ドヤAI・要確認】対応管理に未完了の問い合わせがあるよ\n未完了：${unresolved.length}件。管理画面で内容と対応状況を確認してね。`, 'feedback:' + day, 'error');
       } catch { report.missing.push('問い合わせ：対応データを取得できません'); }
      }
      report.missing.push('ログイン成功率：開始・成功・失敗を同じ操作IDでつなぐ計測が未接続です');
      const affiliate = await readOps<{ period: string; generated: number; approved: number; approvedJpy: number; importedAt: string; source?: string; clicks?: number | null }>('affiliate:' + service.key);
      if (affiliate) report.sections.push(`■ アフィリエイト成果\nASP対象期間：${affiliate.period}\n${affiliate.clicks === null || affiliate.clicks === undefined ? '' : 'ASP側のクリック：' + affiliate.clicks + '回\n'}成果発生：${affiliate.generated}件／承認：${affiliate.approved}件／承認報酬：${affiliate.approvedJpy.toLocaleString('ja-JP')}円\nデータ取り込み日時：${affiliate.importedAt}。承認報酬と実際の入金は別だよ。${affiliate.source?.startsWith('A8-') ? 'A8の発生日基準・税抜き。確定した日別の金額ではありません。' : ''}${Date.now() - Date.parse(affiliate.importedAt) > 36 * 3600000 ? '\n【要確認】取り込みから36時間以上経過。最新の実績ではない可能性があります。' : ''}`);
      else if (['oshi', 'noroi', 'travel', 'heisha'].includes(service.key)) report.missing.push('アフィリエイト成果：ASPの成果レポート連携待ちです。クリックを成果に換算しません');
      try { report.sections.push('■ リンクの接続確認\n' + (await checkServiceLinks(service.key, dry)).join('\n')); } catch { report.missing.push('リンクの確認に失敗しました'); }
      if (!dry) {
        await writeOps(`daily:${service.key}:${day}`, report);
        if (report.usage) {
          const history = await Promise.all(Array.from({ length: 7 }, (_, i) => readOps<OperationsDaily>(`daily:${service.key}:${shiftDay(day, -i - 1)}`)));
          const values = history.flatMap(r => r?.usage ? [r.usage.active] : []);
          const movement = significantChange(report.usage.active, values);
          if (movement) await sendOps(service.key, `【${service.name}】利用人数に大きな変化があったよ\n対象日：${day}\n利用人数：${report.usage.active}人／直前7日平均：${(values.reduce((a, b) => a + b, 0) / 7).toFixed(1)}人\n集計に使う操作や対象者は日報の定義を確認してね。原因はまだ未確認です。`, `usage-change:${service.key}:${day}`, movement);
        }
      }
      results.push({ service: service.key, ...report });
    }
    return results;
  } finally { if (!dry) await releaseOps('collect:' + day); }
}
export async function dailyOperationsSection(key: ServiceKey): Promise<string> {
  const day = jstDay(1), report = await readOps<OperationsDaily>(`daily:${key}:${day}`);
  if (!report) return '\n■ 継続・集客の追加チェック\n今日の追加集計はまだ届いてないよ。0件として扱わず、集計ジョブの完了を待ってね。';
  const lines = ['\n■ 継続・集客の追加チェック', `対象日：${day}（日本時間 0:00〜翌0:00。Google・ASPは各欄の対象期間）`];
  const usage = report.usage;
  if (usage) {
    const previous = await readOps<OperationsDaily>(`daily:${key}:${shiftDay(day, -1)}`);
    lines.push(voiceComment(metricMood(usage.active, previous?.usage?.active), key + ':usage'),
      `利用した方：${usage.active}人／新規登録：${usage.registrations}人／主要操作：${usage.actions}件`,
      `登録から24時間以内の初回利用：${rateLabel(usage.firstUse)}（${shiftDay(day, -1)}登録の方）`,
      `24時間以内の初回利用が未確認：${usage.firstUse.eligible - usage.firstUse.users}人。退会や離脱の確定ではないよ。`,
      ...Object.entries(usage.retention).map(([name, rate]) => `${name === 'D1' ? '登録翌日' : name === 'D7' ? '登録7日後' : '登録30日後'}に利用した方：${rateLabel(rate)}`),
      ...usage.extra, ...usage.limitations);
  }
  lines.push(...report.sections);
  if (key === 'doya') {
    const cost = await readOps<{ amount: number | null; budget: number | null; projected: number | null; note: string; missing: string[] }>('cost-report:' + day);
    if (cost) lines.push('■ 費用と予算もチェック', `昨日の取得できた費用：${cost.amount === null ? '未取得' : Math.round(cost.amount).toLocaleString('ja-JP') + '円相当'}／月末見込み：${cost.projected === null ? '未算出' : Math.round(cost.projected).toLocaleString('ja-JP') + '円相当'}`, `月額予算：${cost.budget === null ? '未設定・上限金額の確認待ち' : cost.budget.toLocaleString('ja-JP') + '円'}`, cost.note, cost.missing.length ? '未取得の提供元：' + cost.missing.join('・') : '');
  }
  if (report.missing.length) lines.push('■ まだ数字にできない項目', ...report.missing.map(s => '・' + s));
  return lines.join('\n');
}
export async function weeklyOperations(dry = false) {
  const lines = ['【スリスタ全サービス】今週の数字、見比べてこ！', `対象：${jstDay(7)}〜${jstDay(1)}（日本時間）`];
  for (const service of OPS_SERVICES) {
    const days = await Promise.all(Array.from({ length: 7 }, (_, i) => readOps<OperationsDaily>(`daily:${service.key}:${jstDay(i + 1)}`)));
    const measured = days.filter((d): d is OperationsDaily & { usage: UsageSnapshot } => !!d?.usage);
    lines.push(`■ ${service.name}`, measured.length ? `取得できた日：${measured.length}/7日／利用人数の日別合計：${measured.reduce((a, d) => a + d.usage.active, 0)}人日／新規登録：${measured.reduce((a, d) => a + d.usage.registrations, 0)}人／主要操作：${measured.reduce((a, d) => a + d.usage.actions, 0)}件` : '比較用の利用データはまだそろっていません。');
  }
  lines.push('同じ方が複数日に使うと複数人日になります。週の実人数ではありません。欠測日は0で埋めていないよ。', 'サービス別の確定収益・費用配賦は未接続のため、利益順位は出していません。');
  const text = lines.join('\n'); if (!dry) await sendOps('doya', text, 'weekly:' + jstDay(), 'steady'); return text;
}
