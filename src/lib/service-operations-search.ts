import { GoogleAuth } from 'google-auth-library';
import { shiftDay } from './service-operations-data';
export async function searchTraffic(page: string, today: string): Promise<string[]> {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!raw) throw new Error('Search Consoleの接続設定がありません');
  let credentials;
  try { credentials = JSON.parse(raw); } catch { credentials = JSON.parse(raw.replace(/[\n\r\t]/g, m => m === '\n' ? '\\n' : m === '\r' ? '\\r' : '\\t')); }
  const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/webmasters.readonly'] });
  const token = await auth.getAccessToken();
  if (!token) throw new Error('Search Console認証に失敗しました');
  const date = shiftDay(today, -3), previous = shiftDay(date, -7);
  async function query(day: string, dimensions?: string[]) {
    const r = await fetch('https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Asurisuta.jp/searchAnalytics/query', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ startDate: day, endDate: day, dataState: 'final', dimensions, rowLimit: 10, dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'contains', expression: page }] }] }),
    });
    if (!r.ok) throw new Error(`Search Consoleの取得失敗（HTTP ${r.status}）`);
    return (await r.json()).rows || [];
  }
  const [totals, prior, terms] = await Promise.all([query(date), query(previous), query(date, ['query'])]);
  const a = totals[0], b = prior[0];
  if (!a) return [`Google検索の集計対象日：${date}（Google基準の集計日）`, 'この条件のデータ行はありません。未反映・対象外の可能性もあるため、流入0件とは断定しません。'];
  return [`Google検索の集計対象日：${date}（Google基準の集計日）`, `表示 ${a.impressions}回／クリック ${a.clicks}回${b ? `。前週同日（${previous}）のクリック：${b.clicks}回` : '。前週同日のデータは未確認'}`,
    ...terms.slice(0, 5).map((r: any) => `・「${String(r.keys?.[0] || '').replace(/[<>&]/g, '').slice(0, 120)}」：クリック ${r.clicks}回／表示 ${r.impressions}回`),
    'GoogleのWeb検索から公式サイトへの流入です。App Store内の検索語・ダウンロード数とは別の数字。検索語はプライバシー等により全件は開示されません。'];
}
