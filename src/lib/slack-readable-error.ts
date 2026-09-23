/** Explain observed symptoms without asserting unverified causes or recovery. */
export function errorGuide(input: string) {
  const rules = [
    [/日報.*(?:未着|遅延|停止)|通知.*(?:未着|未送信)|レポート.*(?:失敗|取得でき)/i, '定期レポートや通知の一部を確認できていません。', '数字の更新が遅れている可能性があります。サービス本体の停止とは限りません。', '最終成功時刻、定期実行ログ、接続先の認証を確認。欠測を0件として扱わず、送達済みか確認してから再実行してください。'],
    [/投稿.*失敗|配信.*失敗|返信.*失敗|画像.*(?:失敗|期限切れ)/i, '投稿・配信に関する処理が完了しなかった可能性があります。', '予約投稿やメッセージが相手に届いていない場合があります。この通知だけで実際の送信結果は確定できません。', '対象アカウントの送信結果・予約状態・接続権限を確認。二重投稿や二重配信を防ぐため、結果確認後に再実行してください。'],
    [/スキーマ未適用|does not exist|schema cache|pgrst|42p01|42703/i, 'データの保存先・読み取り設定に問題がある可能性があります。', '対象機能の保存や表示に失敗する可能性があります。データ消失は確認していません。', '対象テーブル・列・権限と適用済みの変更を確認。SQLを一括再実行せず、必要な差分だけ確認してください。'],
    [/429|rate.limit|too many requests|quota|上限/i, '処理量や利用回数の上限に達した可能性があります。', '対象の操作が一時的に受け付けられない場合があります。', '上限の対象サービスとリセット時刻を確認。利用者には時間を置いて再操作するよう案内してください。'],
    [/timeout|timed.out|network|fetch failed|failed to fetch|到達不可|到達でき|応答遅延|通信/i, '通信が完了しない、または応答に時間がかかっています。', '画面の読み込みや操作結果の確認ができない可能性があります。端末側・サーバー側のどちらが原因かは未確認です。', '稼働状況と同時刻のログを確認。購入・保存は完了履歴を確かめてから再操作を案内し、連打を避けてください。'],
    [/401|403|unauthor|forbidden|oauth|invalid.grant|jwt|認証|ログイン/i, 'ログイン情報やアクセス権限の確認で止まった可能性があります。', 'ログイン、またはログインが必要な操作を完了できない場合があります。', '認証設定・有効期限・権限を確認。利用者の再ログインで改善するか確認し、改善しなければ発生時刻とアプリ版を添えて調査してください。'],
    [/revenuecat|purchase|stripe|課金|決済|購入/i, '購入・決済に関する処理で問題を検知しました。', '購入結果の確認やマイル反映が遅れている可能性があります。請求の有無・二重課金は、この通知だけでは判断できません。', '本番／Sandbox、ストアの取引、購入記録、マイル反映を照合。購入をやり直す前に決済結果を確認してください。'],
    [/supabase|database|保存|postgres|データベース/i, 'データの保存・読み取りに関する処理で問題を検知しました。', '対象の記録が保存・表示できない可能性があります。保存済みかどうかは別途確認が必要です。', 'DBの稼働状況、権限、対象操作のログと保存結果を確認。重複登録を避けてから再操作を案内してください。'],
  ] as const;
  const r=rules.find(([pattern])=>pattern.test(input));
  return r ? {summary:r[1],impact:r[2],action:r[3]} : {
    summary:'アプリまたはサーバーの処理でエラーを検知しました。詳しい原因はまだ特定できていません。',
    impact:'対象の画面や操作を続けられない可能性があります。他の利用者への広がりやデータへの影響は未確認です。',
    action:'発生時刻、画面、アプリ版と技術情報を確認し、同じ操作で再現するか調べてください。復旧確認までは「解消済み」と案内しないでください。',
  };
}
export function redactErrorText(s: string): string {
  return s.replace(/https?:\/\/[^\s<>`]+/g,value=>{try{return new URL(value).origin+'/[URL詳細非表示]';}catch{return '[URL非表示]';}})
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[メール非表示]')
    .replace(/\bBearer\s+[^\s`]+/gi,'Bearer [非表示]')
    .replace(/\b(?:eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|(?:sk|pk)_(?:live|test)_[A-Za-z0-9]+)\b/g,'[認証情報非表示]')
    .replace(/((?:token|secret|password|api[_-]?key)\s*[=:]\s*)[^\s,;`]+/gi,'$1[非表示]')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,'[ID非表示]');
}
function isErrorPayload(p: Record<string,unknown>): boolean {
  const blocks=Array.isArray(p.blocks)?p.blocks as Array<Record<string,unknown>>:[];
  const header=blocks.filter(b=>b.type==='header').map(b=>JSON.stringify(b)).join(' ');
  const title=String(p.text||'').split('\n')[0]+' '+header;
  if (/復旧|正常に戻|recovered/i.test(title) && !/復旧.*失敗/.test(title))return false;
  return /エラー|要対応|要確認|警告|重大|失敗|異常|到達不可|未着|未送信|遅延|ERROR|WARN|CRITICAL|障害|取得できません|スキーマ未適用/i.test(title);
}
export function readableErrorText(text: string): string {
  return (readableErrorPayload({text}) as {text:string}).text;
}
export function readableErrorPayload<T>(payload:T):T {
  if(!payload || typeof payload!=='object')return payload;
  const p=payload as Record<string,unknown>;
  if(!isErrorPayload(p))return payload;
  if(Array.isArray(p.blocks) ? JSON.stringify(p.blocks).includes('まず何が起きた？') : String(p.text).includes('まず何が起きた？'))return payload;
  const raw=(Array.isArray(p.blocks)?p.blocks:[]) as Array<Record<string,unknown>>;
  const filtered=raw.filter(b=>!JSON.stringify(b).includes('AIへの修正依頼')&&!JSON.stringify(b).includes('今日のひとこと'));
  const all=String(p.text||'')+' '+JSON.stringify(filtered);const guide=errorGuide(all);
  const first=String(p.text||'').split('\n')[0];
  const title=redactErrorText(first||'エラーのお知らせ').slice(0,140);
  const labels:Record<string,string>={platform:'端末・環境',appVersion:'アプリのバージョン',locale:'表示言語',screen:'発生した画面',fatal:'操作継続に関わる例外',production:'本番',preview:'プレビュー',development:'開発'};
  function clean(v:unknown):unknown {
    if(typeof v==='string'){let s=redactErrorText(v).replace(/アプリがクラッシュしました/g,'アプリから重大な例外の報告がありました');for(const [k,val] of Object.entries(labels))s=s.replace(new RegExp(`\\b${k}\\b`,'g'),val);return s;}
    if(Array.isArray(v))return v.map(clean);
    if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,clean(x)]));
    return v;
  }
  const summary=`*まず何が起きた？*\n${guide.summary}\n\n*利用者への影響*\n${guide.impact}\n\n*次にすること（運営・開発担当）*\n${guide.action}\n\n※原因・影響範囲・復旧は調査で確認します。`;
  const safe=clean(p) as Record<string,unknown>;
  const note=/通知テスト|\[TEST\]/.test(all)?'【通知テスト：実際の障害ではありません】\n':'';
  if(!raw.length)return {...safe,text:`${note}${title}\n\n${summary}\n\n*確認用の詳しい情報*\n${String(safe.text||'').split('\n').slice(1).join('\n')}`.slice(0,35000)} as T;
  return {...safe,text:`${note}${title}\n${guide.summary}\n${guide.action}`,blocks:[
    {type:'header',text:{type:'plain_text',text:(note.trim()||title).slice(0,150)}},
    {type:'section',text:{type:'mrkdwn',text:summary}},
    {type:'section',text:{type:'mrkdwn',text:'*確認用の詳しい情報（開発担当向け）*'}},
    ...filtered.map(clean),
  ].slice(0,50)} as T;
}
