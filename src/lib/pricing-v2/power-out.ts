// ============================================
// ドヤパワーが足りない・少ない・尽きたときの知らせの中身（UI リニューアルの知らせのシートに渡す形）
// ============================================
// UI リニューアル（知らせの部品。旗 GUIDE_POPUPS_ROLLOUT）との分担（2026-10-26）:
//   こちら（料金）… 何を出すか（この関数）と、行き先の画面（料金ページの #team・#power-pack・#manage・#legacy）
//   UI          … 出し方（シート・カード、同時に1つ、知らせの量、ドヤくんの表示オフ）
// 返す形: { title, body, actions: { label, href }[] }（最大3つ。1つ目が主なボタン）。行き先はすべて href（ボタンの処理を持たない）。
// 区分（kind など）は /api/pricing/upsell の値をそのまま渡す。旗 NEW_PRICING_ROLLOUT が off なら、その API は 404 なので、この関数を呼ばない。
// 中身の決まりは upsell.ts の decideUpsell()（テストあり）。ここは href の形に直すだけ。
import { decideUpsell, isLowPower, type UpsellAction, type UpsellKind, type UpsellTrigger } from './upsell'

export interface PowerOutInput {
  /** /api/pricing/upsell の値 */
  kind: UpsellKind
  isOwner: boolean
  seats: number | null
  canBuyPack: boolean
  canCheckoutTeam: boolean
  /** 今の残りと上限（ゲージの値） */
  remaining: number
  limit: number
  /** 足りなかった量（402 のとき）。渡すと「足りない」の知らせになる */
  required?: number
  /** 次の回復の時刻（ISO）。フリーのとき本文に出す */
  nextRecoveryAt?: string | null
}

export interface PowerOutView {
  trigger: UpsellTrigger
  title: string
  body: string
  actions: { label: string; href: string }[]
}

/** 料金ページの行き先（PricingV2・TeamManage の id と同じ） */
export const POWER_OUT_HREF = {
  team: '/pricing#team',
  pack: '/pricing#power-pack',
  manage: '/pricing#manage',
  legacyMove: '/pricing#legacy',
} as const

function recoveryText(at: string | null | undefined): string | null {
  if (!at) return null
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** ボタンの処理（追加で買う・確かめつきの相談）を、行き先の画面の href に直す。押せないものは出さない */
function toHref(a: UpsellAction, kind: UpsellKind): { label: string; href: string } | null {
  if (a.kind === 'disabled') return null
  if (a.kind === 'buy_pack') return { label: a.label, href: POWER_OUT_HREF.pack }
  // 据え置きの人のチームへの移行は、料金ページの「戻れない」の説明（#legacy）を先に見てもらう
  if (a.confirm && kind === 'legacy') return { label: a.label, href: POWER_OUT_HREF.legacyMove }
  return { label: a.label, href: a.href }
}

/**
 * 知らせの中身。足りない（required あり）・0（empty）・2割未満（low）のどれでもなければ null（出さない）。
 * 頻度（low は月1回・empty は1日1回）は upsell.ts の upsellFrequencyKey() を、出す側で使う。
 */
export function powerOutView(input: PowerOutInput): PowerOutView | null {
  const trigger: UpsellTrigger | null = typeof input.required === 'number' && input.required > 0
    ? 'insufficient'
    : input.remaining <= 0 ? 'empty'
    : isLowPower(input.remaining, input.limit) ? 'low'
    : null
  if (!trigger) return null
  const v = decideUpsell({
    kind: input.kind, isOwner: input.isOwner, trigger, seats: input.seats,
    canBuyPack: input.canBuyPack, canCheckoutTeam: input.canCheckoutTeam,
    required: input.required, recoveryLabel: recoveryText(input.nextRecoveryAt),
  })
  const actions = [v.primary, ...v.secondary]
    .map((a) => toHref(a, input.kind))
    .filter((a): a is { label: string; href: string } => a !== null)
    .slice(0, 3)
  // 主の行動が押せない（追加購入が準備中）ときは、料金ページへの案内を主にする
  if (actions.length === 0) actions.push({ label: '料金プランを見る', href: '/pricing' })
  return { trigger, title: v.title, body: v.body, actions }
}
