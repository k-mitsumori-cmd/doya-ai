// Confirmation text follows the immutable purchase result, not current spendable balance.
export function powerPackReturnMessage(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const data = value as Record<string, unknown>
  const points = data.points
  const refunded = data.refundedPoints === undefined ? 0 : data.refundedPoints
  if (data.ok !== true || typeof data.duplicated !== 'boolean' || typeof points !== 'number' || typeof refunded !== 'number' || !Number.isSafeInteger(points) || !Number.isSafeInteger(refunded) || points < 0 || refunded < 0 || !Number.isSafeInteger(points + refunded) || points + refunded <= 0) return null
  if (refunded > 0 && points === 0) return 'この追加購入は全額返金済みです。ドヤパワーは付きません。'
  if (refunded > 0) return `返金分を除いたドヤパワー ${points.toLocaleString('ja-JP')} を確認しました。`
  if (data.duplicated) return `この追加購入のドヤパワー ${points.toLocaleString('ja-JP')} は反映済みです。`
  return `ドヤパワーを ${points.toLocaleString('ja-JP')} 足しました。`
}

/** Only a newly granted, unrefunded purchase receives the purchase celebration. */
export function powerPackThanksPoints(value: unknown): number | null {
  if (!powerPackReturnMessage(value)) return null
  const data = value as { points: number; duplicated: boolean; refundedPoints?: number }
  return !data.duplicated && (data.refundedPoints ?? 0) === 0 && data.points > 0 ? data.points : null
}
