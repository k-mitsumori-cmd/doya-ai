import { concisePayload, conciseText } from './slack-concise';

import { readableErrorPayload, readableErrorText } from './slack-readable-error';
/** 数値を改変せず、短いコメントだけを追加する。生成APIは使わない。 */
export type Mood = 'up' | 'down' | 'zero' | 'steady' | 'first' | 'pending' | 'error' | 'recovered' | 'test' | 'activity';
const comments: Record<Mood, readonly string[]> = {
  up: ['伸びてる、いい感じ！どこから増えたかも見てこ。', '数字に動きあり！この流れ、次の集計でもチェックしよ。', '前回よりアップ！効いたきっかけを探すチャンス。', 'お、増えてる！内訳まで見ると次の一手が見つかりそう。', 'プラスの変化きた！比較期間もセットで見てね。', 'この伸び、うれしいね。続いているかも追っていこ！'],
  down: ['今日は控えめ。どこで変わったか、内訳から見てこ。', '前回よりダウン。まずは集計条件と動線をチェックしよ。', '減少のサインあり。原因はまだ決めつけずに確認しよ。', 'ちょい落ち着いた数字。次に試せることを探してこ！', '数字が下がった日は、改善ポイントを見つける日。', '今回はマイナス。流入と利用のどちらが変わったか見てね。'],
  zero: ['今回は0件。次の動きにつながる入口をチェックしよ！', 'この集計は0件だったよ。動線や掲載状況も見てこ。', '今日は静かな数字。次の一件に向けて整えてこ！', '対象期間は0件。数字はそのまま、次の一手は前向きに。', '今回はまだ動きなし。見つけてもらうきっかけを増やしてこ。', '0件の日もちゃんと記録！次の変化を見逃さないでいこ。'],
  steady: ['数字はこんな感じ！前回との違いもチェックしよ。', '今日の数字、まとめたよ。気になるところから見てね！', '定点チェックのお時間！小さな変化も拾ってこ。', '数字そろったよ。対象期間もセットで見てね！', '今日も数字を確認！次の一手のヒントにしてね。', '日々の積み重ね、ここでチェックしてこ！'],
  first: ['初回の比較データがそろったよ！ここから変化を追ってこ。', 'まずは今回の数字を基準にしよ。増減は次回からチェック！', '比較のスタート地点ができたよ。これからの動きを見てこ。'],
  pending: ['ここはまだデータ待ち。0件扱いにはしないよ！', '集計が届くまで待機中。分かった数字から見てこ。', 'まだ数字がそろってないよ。未確認のまま正直にお届け！'],
  error: ['ここは要確認だよ。影響と確認手順を先に見てね。', '処理でつまずきを検知したよ。下の確認事項から順番に見てね。', '対応が必要なサイン。発生時刻と対象の処理をチェックしてね。'],
  recovered: ['応答が戻ったよ！復旧確認の内容は下を見てね。', '正常な応答を確認できたよ。引き続き様子を見てこ。', '復旧の確認が取れたよ！対象と停止時間をまとめたよ。'],
  test: ['これはテスト通知だよ。本番の売上や実績と混ぜないでね！', '動作確認のお知らせ！テスト分として分けて見てね。', 'テストの記録が届いたよ。本番の数字とは別枠でチェック！'],
  activity: ['サービスに動きがあったよ！内容をサクッとチェック。', '新しい利用の記録が届いたよ。何が行われたか見てね！', '利用のお知らせ、届いたよ！詳細はこちら。', 'アプリの動き、キャッチしたよ。今回の内容をまとめたよ。', '新しい動きあり！記録された内容をチェックしてね。'],
};
export function metricMood(current: number | null, previous?: number | null): Mood {
  if (current === null || !Number.isFinite(current)) return 'pending';
  if (current === 0) return previous && previous > 0 ? 'down' : 'zero';
  if (previous === null || previous === undefined || !Number.isFinite(previous)) return 'first';
  return current > previous ? 'up' : current < previous ? 'down' : 'steady';
}
export function voiceComment(mood: Mood, seed: string, day = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })): string {
  let hash = 2166136261;
  for (const ch of seed) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  const dayIndex = Math.floor(Date.parse(day + 'T00:00:00Z') / 86400000) || 0;
  const choices = comments[mood];
  return choices[((hash >>> 0) + dayIndex) % choices.length]!;
}
function baseSlackVoice(text: string, opts: { mood?: Mood; seed?: string; current?: number | null; previous?: number | null } = {}): string {
  if (text.includes('今日のひとこと：')) return text;
  const first = text.split('\n')[0] || '';
  const mood: Mood = /テスト|SANDBOX/.test(first) ? 'test'
    : /要対応|要確認|エラー|異常|失敗|障害|不可|ERROR|WARN/.test(first) ? 'error'
    : /復旧/.test(first) ? 'recovered'
    : opts.mood ?? ('current' in opts ? metricMood(opts.current ?? null, opts.previous) : /報告|日報|朝刊|まとめ|レポート/.test(first) ? 'steady' : 'activity');
  const lines = text.split('\n');
  lines.splice(1, 0, `今日のひとこと：${voiceComment(mood, opts.seed || first)}`, '');
  return lines.join('\n');
}




export function voicePayload<T>(payload: T): T { return concisePayload(readableErrorPayload(payload)); }
export function withSlackVoice(text: string, opts: Parameters<typeof baseSlackVoice>[1] = {}): string { void opts; return conciseText(readableErrorText(text)); }
