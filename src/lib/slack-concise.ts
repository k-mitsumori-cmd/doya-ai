/** Deterministic Slack summaries. Journal and customer text are never truncated. */
type Block = { type?: string; text?: string | {text?: string; type?: string}; fields?: Block[]; elements?: Block[]; [key: string]: unknown };
const flatten = (b: Block): string => [typeof b.text === 'string' ? b.text : b.text?.text || '', ...(b.fields || []).map(flatten), ...(b.elements || []).map(flatten)].filter(Boolean).join('\n');
const protectedEvent = (s: string) => /日記が書|新しい日記|綴じ込み|ご意見|お問い合わせ|フィードバック|メッセージ受信|メンション|ブランド言及|投稿を検知/.test(s.split('\n')[0] || '');
const chatter = /^(?:今日のひとこと|ひとこと)[：:]|^(?:伸びてる、|数字に動きあり！|前回よりアップ！|お、増えてる！|プラスの変化きた！|この伸び、|今日は控えめ。|前回よりダウン。|減少のサインあり。|ちょい落ち着いた|数字が下がった日は|今回はマイナス。|今回は0件。|この集計は0件|今日は静かな数字。|対象期間は0件。|今回はまだ動きなし。|0件の日もちゃんと|数字はこんな感じ！|今日の数字、|定点チェックの|数字そろったよ|今日も数字を確認|日々の積み重ね|初回の比較データ|まずは今回の数字|比較のスタート|ここはまだデータ待ち|集計が届くまで待機|まだ数字がそろって|審査と開発の進み具合、)/;
function cleanIntro(text: string): string {
  // For journal/feedback events remove only the known inserted introduction.
  if (protectedEvent(text)) return text.replace(/^(.*\n)(?:今日のひとこと|ひとこと)：[^\n]*\n/, '$1');
  return text.split('\n').filter(l => !chatter.test(l.trim())).join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
export function conciseText(input: string): string {
  const text = cleanIntro(input);
  if (protectedEvent(text) || text.endsWith("※主要項目のみ表示。")) return text;
  const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);
  const title = lines[0] || '';
  const error = /要対応|要確認|エラー|障害|失敗|警告|ERROR|WARN/.test(title) && !/日報|レポート|朝刊/.test(title);
  if (error && text.includes('まず何が起きた？')) {
    const summary = text.match(/\*まず何が起きた？\*\n([^\n]+)/)?.[1];
    const action = text.match(/\*次にすること[^\n]*\n([^\n]+)/)?.[1];
    const details = lines.filter(l => /^(?:[・*\s]*)(?:発生|日時|時刻|対象|サービス|環境|画面|バージョン|HTTP|原因|エラー内容|request|correlation|URL|確認ID)/i.test(l) && !/まず何が|影響範囲/.test(l));
    return Array.from(new Set([title, summary || '', action ? `対応：${action}` : '', ...details])).filter(Boolean).join('\n');
  }
  if (!/日報|レポート|朝刊|週報|月報|週次|月次|集客チェック|開発・審査状況|きのうの数値/.test(title)) return text;
  const candidates = lines.slice(1).filter(l => !/^(?:※|注：|GoogleのWeb検索|購入記録の金額|利用は|起動数を|同じ|取得できない提供元|対象：費用を取得|紹介先の直接URL一覧|決済事業者と|開始・成功・失敗|[■*]*まだ数字にできない)/.test(l) && /[0-9０-９]|未取得|未集計|要確認|未設定|失敗|未接続|配信可能|審査|ビルド/.test(l));
  const score = (line: string) => {
    const l = line.replace(/^[*・\s]+/, '');
    if (/^(利用した方|新規登録|本番の購入|テスト購入|区分未確認|成果発生|承認報酬|売上)/.test(l)) return 120;
    if (/^(対象日|対象期間|Apple対象日|ASP対象期間|Google検索の集計対象日)/.test(l)) return 110;
    if (/【要対応】|【要確認】|取得失敗|送信失敗/.test(l)) return 115;
    if (/^(昨日の取得できた費用|月額予算|対応管理|未取得の提供元|App Store 版|最新ビルド)/.test(l)) return 100;
    if (/登録から24時間|登録翌日|登録7日後|登録30日後|ダウンロード/.test(l) && !/比較データ/.test(l)) return 75;
    if (/^(表示 |ASP側のクリック)/.test(l)) return 80;
    if (/未取得|未集計|未設定/.test(l)) return 70;
    return 10;
  };
  const selected = new Set(candidates.map((line,i)=>({line,i,s:score(line)})).sort((a,b)=>b.s-a.s||a.i-b.i).slice(0,12).map(x=>x.i));
  const short = candidates.filter((l,i)=>selected.has(i) || /要対応|要確認|取得失敗|送信失敗|障害/.test(l)).map(l=>l
    .replace(/（日本時間 0:00〜翌0:00。Google・ASPは各欄の対象期間）/g,'')
    .replace(/。退会や離脱の確定ではないよ。/g,'（離脱確定ではありません）')
    .replace(/。同一購入の追跡IDがないため転換率は算出しません。/g,'（転換率は未計測）')
    .replace(/。購入や報酬の確定数ではありません。/g,'（成果確定ではありません）')
    .replace(/。前週同日（([^）]+)）のクリック：/g,'／前週同日 $1：')
    .replace(/。円表示は既存レポートの換算値.*$/,'')
    .replace(/。承認報酬と実際の入金は別だよ。.*$/,'（発生日基準・税抜／入金とは別）')
    .replace(/台帳に取引IDがないため、未付与の確定判定ではありません。/g,'取引ID照合は未対応。')
    .replace(/購入と付与台帳の照合：取得した購入分に照合不一致なし。/g,'購入・付与：不一致なし。')
  );
  return [title,...short, ...(candidates.length>short.length?['※主要項目のみ表示。']:[])].join('\n');
}
export function concisePayload<T>(payload:T):T {
  if (!payload || typeof payload !== 'object') return payload;
  const p=payload as Record<string,unknown>;
  const blocks=Array.isArray(p.blocks)?(p.blocks as Block[]).filter(b=>!(b.type === 'context' && /^(?:今日のひとこと|ひとこと)：/.test(flatten(b).trim()))):null;
  const text=typeof p.text==='string'?p.text:'';
  const body=blocks?.map(flatten).filter(Boolean).join('\n') || text;
  const title=text.split('\n')[0] || body.split('\n')[0] || '';
  if (protectedEvent(title)) return {...p,...(text?{text:cleanIntro(text)}:{}),...(blocks?{blocks}:{})} as T;
  const report=/日報|レポート|朝刊|週報|月報|週次|月次|集客チェック|開発・審査状況|きのうの数値/.test(title);
  const error=body.includes('まず何が起きた？');
  if(!report&&!error)return {...p,...(text?{text:cleanIntro(text)}:{}),...(blocks?{blocks}:{})} as T;
  const combined=body.startsWith(title)?body:title+'\n'+body;
  const compact=conciseText(combined);
  // A plain-text section prevents interpreting retained user input as mentions.
  const chunks:string[]=[]; for(let i=0;i<compact.length;i+=2900)chunks.push(compact.slice(i,i+2900));
  return {...p,text:compact,...(blocks?{blocks:[...chunks.map(t=>({type:'section',text:{type:'plain_text',text:t}})),...blocks.filter(b=>b.type==='actions')]}:{})} as T;
}
