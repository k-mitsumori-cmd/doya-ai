import { sendAppStoreSourceReport, type SourceReportResult } from './appstore-source-report';

export const OSHI_KEYWORDS = ['推しにマイル', '推し活', '推し活 記録', '遠征', 'ライブ 記録'];
const labels: Record<string, string> = {
  'app store search': 'App Store内の検索から',
  'app store browse': 'App Storeのおすすめ・一覧から',
  'app referrer': 'ほかのアプリのリンクから',
  'web referrer': 'Webサイトのリンクから',
  'institutional purchase': '法人・学校の一括購入から',
  unavailable: 'Appleが経路を特定できなかった分',
};
export function sourceSummary(source: SourceReportResult): string {
  if (source.status !== 'ok') return '■ どこから見つけられたか\n' + (source.status === 'no-request'
    ? '取得できていません。Appleの継続レポート設定を確認する必要があります。'
    : 'Appleが流入経路のレポートを生成中です。数値が届き次第、この欄に表示します。');
  const dates = (values?: string[]) => values?.length ? values.join('・') : 'データ行なし（対象日を確認できません）';
  const lines = ['■ どこから見つけられたか',
    `表示・閲覧の対象日：${dates(source.engagementDates)}`,
    `経路別ダウンロードの対象日：${source.downloadsAvailable ? dates(source.downloadDates) : '集計待ち'}`,
    `Appleがレポートを処理した日：${source.processingDate}`];
  const entries = Object.entries(source.bySourceType).sort((a, b) => b[1].downloads - a[1].downloads);
  for (const [key, value] of entries) {
    lines.push(`・${labels[key.toLowerCase()] || key}`,
      `  表示 ${value.impressions}回／紹介ページの閲覧 ${value.ppViews}回`,
      `  初回ダウンロード ${source.downloadsAvailable ? value.downloads + '件' : '未集計'}／再ダウンロード ${source.downloadsAvailable ? value.redownloads + '件' : '未集計'}`);
  }
  if (!entries.length) lines.push('Appleから経路別のデータ行が届いていません。流入がなかったとは断定できません。');
  lines.push('表示・閲覧は回数です。同じ方の複数回の操作を含みます。',
    '上のダウンロード報告とは集計元・対象日が異なるため、件数が一致しない場合があります。',
    'このレポートでは、Xなどの具体的なサイト名や実際に入力された検索語までは分かりません。');
  return lines.join('\n');
}

export async function keywordCheck(term: string): Promise<string> {
  try {
    const params = new URLSearchParams({ term, country: 'jp', entity: 'software', limit: '200' });
    const response = await fetch(`https://itunes.apple.com/search?${params}`, { signal: AbortSignal.timeout(10000), cache: 'no-store' });
    if (!response.ok) throw new Error('search unavailable');
    const json = await response.json();
    if (!Array.isArray(json.results)) throw new Error('invalid search response');
    const index = json.results.findIndex((app: { trackId?: number }) => String(app.trackId) === '6808881452');
    return `・「${term}」：${index < 0 ? `取得した検索結果 ${json.results.length}件の中では見つかりませんでした` : `取得した検索結果の ${index + 1}番目に表示されました`}`;
  } catch { return `・「${term}」：検索結果を取得できませんでした（順位は未確認）`; }
}

export async function oshiAcquisitionMessage(): Promise<string> {
  const [source, keywords] = await Promise.all([
    sendAppStoreSourceReport({ deliver: false, appId: '6808881452', appLabel: '推しにマイル' })
      .then(sourceSummary).catch(() => '■ どこから見つけられたか\nAppleのデータ取得に失敗しました。流入0件という意味ではありません。通信・認証状態の確認が必要です。'),
    Promise.all(OSHI_KEYWORDS.map(keywordCheck)),
  ]);
  return [source, '', '■ 指定キーワードでの見つかりやすさ（参考）',
    `確認日時：${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}（日本時間）`,
    ...keywords, '日本向けのApple公開検索APIで、あらかじめ指定した語を毎日確認しています。',
    '実際の利用者の検索語・その語からの流入数・App Store画面での確定順位ではありません。',
    '', '■ この報告の見方',
    'まず初回ダウンロード数をご確認ください。次に経路別の数字で、検索・外部リンクのどちらから見つけられているかを確認できます。',
    '「集計待ち」はAppleのデータ待ちです。「取得失敗」が続く場合は接続設定の確認が必要です。'].join('\n');
}
