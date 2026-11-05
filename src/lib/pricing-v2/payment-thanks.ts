// ============================================
// 決済のあとのお礼のポップアップ — 文面と「1回だけ」の判定
// ============================================
// 見た目は src/components/pricing/PaymentThanks.tsx。出すかどうかは呼ぶ側が、サーバーの確認の結果で決める。
// 画面からも読むので node: を使わない。

export type PaymentThanksView =
  | { kind: 'pack'; points: number }
  | { kind: 'seats'; added: number; seats: number }
  | { kind: 'plan' }

export type PaymentThanksCopy = {
  eyebrow: string
  /** 大きく出す数。無いときは headline を大きく出す */
  amount: { prefix: string; value: number; unit: string } | null
  headline: string
  body: string
}

export function paymentThanksCopy(view: PaymentThanksView): PaymentThanksCopy {
  if (view.kind === 'pack') {
    return {
      eyebrow: 'ご購入ありがとうございます',
      amount: { prefix: '+', value: view.points, unit: 'ドヤパワー' },
      headline: `ドヤパワーを ${view.points.toLocaleString('ja-JP')} 足しました`,
      body: '買った分は6か月使えます。',
    }
  }
  if (view.kind === 'seats') {
    return {
      eyebrow: 'ご追加ありがとうございます',
      amount: { prefix: '+', value: view.added, unit: '人' },
      headline: `チームを ${view.seats} 人にしました`,
      body: '招待のリンクを渡すと、参加できます。',
    }
  }
  return {
    eyebrow: 'ご契約ありがとうございます',
    amount: null,
    headline: 'プランを反映しました',
    body: 'ご契約中の機能をご利用いただけます。',
  }
}

type OnceStorage = Pick<Storage, 'getItem' | 'setItem'>

/**
 * その決済のお礼をまだ出していなければ true を返し、出した印を残す。読み込み直しで再び出さないために使う。
 * 保存できない環境では true を返す（お礼が出ないより、まれに2回出るほうを選ぶ）。
 */
export function claimThanksOnce(key: string, storage: OnceStorage | null): boolean {
  const name = `doya:payment-thanks:${key}`
  try {
    if (!storage) return true
    if (storage.getItem(name)) return false
    storage.setItem(name, '1')
    return true
  } catch {
    return true
  }
}

/** ブラウザの保存先（読めないときは null） */
export function thanksStorage(): OnceStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}
