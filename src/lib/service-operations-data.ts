import { prisma } from './prisma';
export type ServiceKey = 'doya' | 'noroi' | 'yurusen' | 'oshi' | 'hitorijime' | 'heisha' | 'travel';
export const OPS_SERVICES: { key: ServiceKey; name: string; appId?: string; prefix?: string; webhook: string; path: string; action?: string; activity?: string }[] = [
  { key: 'doya', name: 'ドヤAI', webhook: '', path: 'https://doya-ai.surisuta.jp/' },
  { key: 'noroi', name: '呪い日記', appId: '6786964992', prefix: 'NOROI', webhook: 'SLACK_APPSTORE_WEBHOOK_URL', path: 'https://game.surisuta.jp/noroi', action: 'curse_entries', activity: 'daily_grants' },
  { key: 'yurusen', name: 'ゆるせん', appId: '6789815785', prefix: 'YURUSEN', webhook: 'SLACK_YURUSEN_APPSTORE_WEBHOOK_URL', path: 'https://game.surisuta.jp/yurusen', action: 'grudge_targets', activity: 'daily_grants' },
  { key: 'oshi', name: '推しにマイル', appId: '6808881452', prefix: 'OSHI', webhook: 'SLACK_OSHI_ERROR_WEBHOOK_URL', path: 'https://game.surisuta.jp/oshimile', action: 'expenses', activity: 'app_events' },
  { key: 'hitorijime', name: 'ヒトリジメ', appId: '6802064148', prefix: 'HITORIJIME', webhook: 'SLACK_HITORIJIME_ERROR_WEBHOOK_URL', path: 'https://game.surisuta.jp/hitorijime', action: 'messages', activity: 'messages' },
  { key: 'heisha', name: '弊社、限界につき。', appId: '6808880949', webhook: 'HEISHA_SLACK_ERROR_WEBHOOK_URL', path: 'https://apps.apple.com/jp/app/id6808880949' },
  { key: 'travel', name: '旅行ツール', webhook: 'SLACK_TRAVEL_ERROR_WEBHOOK_URL', path: 'https://mitsumoritravel.surisuta.jp/' },
];
export const jstDay = (offset = 0) => new Date(Date.now() + 9 * 3600000 - offset * 86400000).toISOString().slice(0, 10);
export const shiftDay = (day: string, offset: number) => new Date(Date.parse(day + 'T00:00:00Z') + offset * 86400000).toISOString().slice(0, 10);
export const dayStart = (day: string) => new Date(day + 'T00:00:00+09:00').toISOString();
export type Row = Record<string, any>;
export async function serviceRows(prefix: string, table: string, columns: string, filter: Record<string, string> = {}): Promise<Row[]> {
  const url = process.env[prefix + '_SUPABASE_URL'];
  const key = process.env[prefix + '_SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('連携設定がありません');
  const result: Row[] = [];
  for (let offset = 0; offset < 50000; offset += 1000) {
    const params = new URLSearchParams({ select: columns, order: table === 'daily_grants' ? 'user_id.asc' : 'created_at.asc,id.asc', ...filter, offset: String(offset), limit: '1000' });
    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${table}?${params}`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' }, signal: AbortSignal.timeout(15000), cache: 'no-store' });
    if (!response.ok) throw new Error(`集計データの取得に失敗しました（HTTP ${response.status}）`);
    const total = response.headers.get('content-range')?.split('/')[1];
    if (!total || !/^\d+$/.test(total)) throw new Error('取得件数の完全性を確認できません');
    if (Number(total) > 50000) throw new Error('集計上限を超えています。部分的な件数は表示しません');
    const rows = await response.json() as Row[];
    result.push(...rows);
    if (result.length >= Number(total)) return result;
    if (!rows.length) throw new Error('一部のデータが届いていません');
  }
  throw new Error('集計上限を超えています');
}
export type Rate = { users: number; eligible: number };
export type UsageSnapshot = { day: string; active: number; registrations: number; actions: number; firstUse: Rate; retention: Record<string, Rate>; extra: string[]; limitations: string[] };
export function rateLabel(rate: Rate): string {
  return rate.eligible ? `${rate.users}人／対象 ${rate.eligible}人（${(rate.users / rate.eligible * 100).toFixed(1)}%）` : '対象者がいないため、割合は未算出';
}
export function cohortMetrics(day: string, profiles: Row[], actions: Row[], activity: Row[]): Pick<UsageSnapshot, 'active' | 'registrations' | 'actions' | 'firstUse' | 'retention'> {
  const start = Date.parse(dayStart(day)), end = Date.parse(dayStart(shiftDay(day, 1)));
  const inDay = (r: Row) => Date.parse(r.created_at) >= start && Date.parse(r.created_at) < end;
  const active = new Set(activity.filter(r => r.grant_date ? r.grant_date === day : inDay(r)).map(r => r.user_id).filter(Boolean));
  // 前々日登録者は翌日の終了時点で全員24時間以上を観測済み。
  const firstCohort = profiles.filter(r => Date.parse(r.created_at) >= Date.parse(dayStart(shiftDay(day, -1))) && Date.parse(r.created_at) < start);
  const firstUsed = firstCohort.filter(p => actions.some(a => a.user_id === p.id && Date.parse(a.created_at) >= Date.parse(p.created_at) && Date.parse(a.created_at) < Date.parse(p.created_at) + 86400000));
  const retention: Record<string, Rate> = {};
  for (const n of [1, 7, 30]) {
    const cohort = profiles.filter(r => Date.parse(r.created_at) >= Date.parse(dayStart(shiftDay(day, -n))) && Date.parse(r.created_at) < Date.parse(dayStart(shiftDay(day, 1 - n))));
    retention['D' + n] = { users: cohort.filter(p => active.has(p.id)).length, eligible: cohort.length };
  }
  return { active: active.size, registrations: profiles.filter(inDay).length, actions: actions.filter(inDay).length, firstUse: { users: firstUsed.length, eligible: firstCohort.length }, retention };
}
export async function collectUsage(service: typeof OPS_SERVICES[number], day: string): Promise<UsageSnapshot> {
  const start = dayStart(day), end = dayStart(shiftDay(day, 1)), since = dayStart(shiftDay(day, -31));
  if (service.key === 'doya') {
    const [profiles, generations] = await Promise.all([
      prisma.user.findMany({ where: { createdAt: { gte: new Date(since), lt: new Date(end) } }, select: { id: true, createdAt: true } }),
      prisma.generation.findMany({ where: { createdAt: { gte: new Date(since), lt: new Date(end) } }, select: { userId: true, createdAt: true } }),
    ]);
    const p = profiles.map(r => ({ id: r.id, created_at: r.createdAt.toISOString() }));
    const a = generations.map(r => ({ user_id: r.userId, created_at: r.createdAt.toISOString() }));
    return { day, ...cohortMetrics(day, p, a, a), extra: [], limitations: ['利用はログイン済みの生成・操作記録を基準に集計。ゲスト利用とログインだけの方は含みません。'] };
  }
  if (!service.prefix || !service.action || !service.activity) throw new Error(service.key === 'heisha' ? '記録は端末内に保存されるため、現在の配信版から継続率・離脱率を取得できません' : '登録・操作の対応を追う計測が未接続です');
  const period = { and: `(created_at.gte.${since},created_at.lt.${end})` };
  const actionFilter = service.key === 'hitorijime' ? { ...period, role: 'eq.user' } : period;
  const [profiles, actions, activity] = await Promise.all([
    serviceRows(service.prefix, 'profiles', 'id,created_at', period),
    serviceRows(service.prefix, service.action, 'user_id,created_at', actionFilter),
    serviceRows(service.prefix, service.activity, service.activity === 'daily_grants' ? 'user_id,grant_date' : 'user_id,created_at', service.activity === 'daily_grants' ? { grant_date: 'eq.' + day } : service.key === 'oshi' ? { and: `(created_at.gte.${start},created_at.lt.${end})`, name: 'eq.app_open' } : { ...actionFilter, and: `(created_at.gte.${start},created_at.lt.${end})` }),
  ]);
  const result: UsageSnapshot = { day, ...cohortMetrics(day, profiles, actions, activity), extra: [], limitations: [service.key === 'hitorijime' ? '利用は会話の送信、初回利用は最初の会話送信で判定します。' : service.key === 'oshi' ? '利用は起動イベント、初回利用は支出記録で判定します。' : '利用はログインボーナスの記録、初回利用は日記・記録の保存で判定します。'] };
  if (service.key === 'oshi') {
    const [events, logs, cards] = await Promise.all([
      serviceRows(service.prefix, 'events', 'id,user_id,status,created_at,completed_at', { and: `(created_at.gte.${dayStart(shiftDay(day, -6))},created_at.lt.${end})` }),
      serviceRows(service.prefix, 'app_events', 'user_id,name,meta,created_at', { and: `(created_at.gte.${start},created_at.lt.${end})`, name: 'in.(affiliate_view,affiliate_open,card_share,purchase_start,purchase_done)' }),
      serviceRows(service.prefix, 'share_cards', 'user_id,created_at', { and: `(created_at.gte.${start},created_at.lt.${end})` }),
    ]);
    const done = events.filter(r => r.status === 'done' && r.completed_at && Date.parse(r.completed_at) < Date.parse(end)).length;
    result.extra.push(`直近7日間に作られた遠征予定：${events.length}件／集計終了までに記録完了：${done}件${events.length ? `（${(done / events.length * 100).toFixed(1)}%）` : ''}。未来の予定も含むので未完了＝離脱ではありません。`);
    const creators = new Set(cards.map(r => r.user_id));
    const sharers = new Set(logs.filter(r => r.name === 'card_share' && creators.has(r.user_id)).map(r => r.user_id));
    result.extra.push(`カードを作成した方の共有操作：${rateLabel({ users: sharers.size, eligible: creators.size })}。同じカードの共有・SNS投稿完了は確認できません。`);
    for (const [key, label] of [['home', 'ホーム'], ['event', '遠征詳細'], ['mypage', 'マイページ'], ['share', '共有ページ']]) {
      const views = logs.filter(r => r.name === 'affiliate_view' && r.meta?.surface === key).length;
      const clicks = logs.filter(r => r.name === 'affiliate_open' && r.meta?.surface === key).length;
      result.extra.push(`紹介リンク・${label}：表示 ${views}回／クリック ${clicks}回。購入や報酬の確定数ではありません。`);
    }
    result.extra.push(`購入操作ログ：開始 ${logs.filter(r => r.name === 'purchase_start').length}回／完了イベント ${logs.filter(r => r.name === 'purchase_done').length}回。同一購入の追跡IDがないため転換率は算出しません。`);
  }
  return result;
}
