// ============================================
// ドヤ営業管理（SFA）整形ヘルパー
// ============================================

/** ¥3桁区切り。BigInt/number どちらも可。 */
export function formatYen(n: number | bigint | null | undefined): string {
  const v = typeof n === 'bigint' ? Number(n) : n || 0
  return '¥' + v.toLocaleString('ja-JP')
}

/** YYYY/MM/DD */
export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '-'
  const dt = typeof d === 'string' ? new Date(d) : d
  return `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}`
}

/** BigInt を含むオブジェクトをJSON安全に（number化）。API応答整形用。 */
export function bigIntToNumber<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_k, v) => (typeof v === 'bigint' ? Number(v) : v)))
}
