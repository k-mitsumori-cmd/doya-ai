// ============================================
// ドヤパワーが足りない・少ない・尽きたときの導線（DB に触らない計算）
// ============================================
// 2026-10-26 ユーザー「尽きたら、次のプランへ上げる形の動線のポップアップや、追加のやつを購入するポップアップに進め」。
// 出し分け:
//   フリー   … 主: チームに上げる（人数を選んで申し込む）。次の回復の時刻も出す
//   チーム   … 主: 追加で買う（1,000で5,980円・6か月）。人数を増やす。人数が多いときは個別見積の案内
//   据え置き … 主: 追加で買う。チームへ移る相談（移ると今の料金に戻れないことを、確かめの画面で伝える）
//   メンバー（会社の持ち主でない人）… 買えないので、持ち主への相談を案内する
// 出す場面: insufficient（生成のボタンを押して足りなかった。その場で）／ low（残りが2割を切った。月1回）／ empty（0になった。1日1回）
// ⚠️ 文言と行き先はここだけで持つ。見た目と出し方（下からのシート・右下のカード・同時に1つ）は UI リニューアルの知らせの部品。
import { ENTERPRISE_CONTACT_MAILTO } from '@/lib/pricing'
import { ENTERPRISE_MIN_SEATS, POWER_PACK, TEAM_MONTHLY_POINTS_PER_SEAT, withTax } from './plans'

export type UpsellKind = 'free' | 'team' | 'legacy'
export type UpsellTrigger = 'insufficient' | 'low' | 'empty'

export type UpsellAction =
  | { kind: 'link'; label: string; sub?: string; href: string; confirm?: { title: string; message: string; confirmLabel: string } }
  | { kind: 'buy_pack'; label: string; sub?: string; packs: number }
  | { kind: 'disabled'; label: string; sub?: string }

export interface UpsellView {
  title: string
  body: string
  primary: UpsellAction
  secondary: UpsellAction[]
}

export interface UpsellInput {
  kind: UpsellKind
  /** 会社の持ち主か（メンバーは買えない） */
  isOwner: boolean
  trigger: UpsellTrigger
  /** チームの人数（チームのときだけ） */
  seats: number | null
  /** 追加購入が使えるか（価格の設定と台帳の旗） */
  canBuyPack: boolean
  /** チームの申し込みが使えるか（価格の設定） */
  canCheckoutTeam: boolean
  /** 足りなかった量（insufficient のとき） */
  required?: number
  /** 次の回復の時刻の言い方（例: 「明日 0:00」）。フリーのとき */
  recoveryLabel?: string | null
}

/** お問い合わせ（料金ページと同じ窓口） */
export const CONTACT_HREF = ENTERPRISE_CONTACT_MAILTO
const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`
/** 追加購入の1パックの言い方 */
export const PACK_LABEL = `${POWER_PACK.points.toLocaleString('ja-JP')}で${yen(POWER_PACK.price)}（税込 ${yen(withTax(POWER_PACK.price))}）・6か月使えます`

function title(trigger: UpsellTrigger, required?: number): string {
  if (trigger === 'insufficient') return required ? `この操作には、ドヤパワーが ${required.toLocaleString('ja-JP')} 要ります` : 'ドヤパワーが足りません'
  if (trigger === 'empty') return 'ドヤパワーを使い切りました'
  return 'ドヤパワーが残り少なくなっています'
}

export function decideUpsell(i: UpsellInput): UpsellView {
  const t = title(i.trigger, i.required)
  if (!i.isOwner) {
    return {
      title: t,
      body: 'ドヤパワーを増やせるのは、会社の持ち主の方です。持ち主の方にご相談ください。',
      primary: { kind: 'link', label: '料金プランを見る', href: '/pricing' },
      secondary: [],
    }
  }
  if (i.kind === 'free') {
    return {
      title: t,
      body: i.recoveryLabel
        ? `フリーは毎日10ずつ回復します（${i.recoveryLabel} に回復）。チームにすると、毎月 1,500 ＋ 1人 ${TEAM_MONTHLY_POINTS_PER_SEAT} が付きます。`
        : `チームにすると、毎月 1,500 ＋ 1人 ${TEAM_MONTHLY_POINTS_PER_SEAT} が付きます。`,
      primary: i.canCheckoutTeam
        ? { kind: 'link', label: 'チームに上げる', sub: '人数を選んで申し込めます', href: '/pricing#team' }
        : { kind: 'link', label: '料金プランを見る', href: '/pricing' },
      secondary: [],
    }
  }
  const pack: UpsellAction = i.canBuyPack
    ? { kind: 'buy_pack', label: '追加で買う', sub: PACK_LABEL, packs: 1 }
    : { kind: 'disabled', label: '追加購入は準備中です', sub: 'もうしばらくお待ちください' }
  if (i.kind === 'team') {
    const secondary: UpsellAction[] = [{ kind: 'link', label: '人数を増やす', sub: `1人増やすごとに、毎月 ${TEAM_MONTHLY_POINTS_PER_SEAT} 増えます`, href: '/pricing#manage' }]
    if ((i.seats ?? 0) >= ENTERPRISE_MIN_SEATS - 10) secondary.push({ kind: 'link', label: '個別見積を相談する', sub: `${ENTERPRISE_MIN_SEATS}人以上は、使い方に合わせてお見積りします`, href: CONTACT_HREF })
    return { title: t, body: '追加で買った分は6か月使えます。期限の近いものから順に使います。', primary: pack, secondary }
  }
  // 据え置き
  return {
    title: t,
    body: '今のご契約（月 9,980円）のまま、ドヤパワーだけを追加できます。',
    primary: pack,
    secondary: [{
      kind: 'link',
      label: 'チームに移る相談をする',
      sub: '会社のメンバーで使いたいとき',
      href: CONTACT_HREF,
      confirm: {
        title: 'チームに移ると、今の料金には戻れません',
        message: '今のご契約（月 9,980円・税込）は、ご契約が続くあいだの据え置きの料金です。チームに移ったあとは、今の料金に戻すことはできません。まずはご相談ください。',
        confirmLabel: '相談する',
      },
    }],
  }
}

/** 残りが少ない（2割を切った）か。0 は empty として別に扱う */
export function isLowPower(remaining: number, limit: number): boolean {
  return limit > 0 && remaining > 0 && remaining / limit < 0.2
}

/** やさしい知らせの頻度のキー（low は月1回、empty は1日1回。日本時間） */
export function upsellFrequencyKey(trigger: Exclude<UpsellTrigger, 'insufficient'>, now: Date): string {
  const j = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const ym = `${j.getUTCFullYear()}-${String(j.getUTCMonth() + 1).padStart(2, '0')}`
  return trigger === 'low' ? `doya-upsell:low:${ym}` : `doya-upsell:empty:${ym}-${String(j.getUTCDate()).padStart(2, '0')}`
}
