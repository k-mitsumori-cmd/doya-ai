// ============================================
// 追加購入の返金で減らすドヤパワーの量（計算だけ。DB・Stripe に触れない）
// ============================================
// 実体は power-pack.server.ts の revokePowerPackForCharge。

/**
 * 返金の累計に見合う量。全額の返金なら買った量のすべて。
 * 一部の返金は比例して、端数は切り捨てる（お客様に不利にしない）。
 */
export function pointsToRevoke(points: number, amountRefunded: number, amountPaid: number): number {
  if (!Number.isInteger(points) || points <= 0 || !(amountPaid > 0) || !(amountRefunded > 0)) return 0
  if (amountRefunded >= amountPaid) return points
  return Math.floor((points * amountRefunded) / amountPaid)
}
