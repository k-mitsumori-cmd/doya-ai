export type DoyalistEstimate = { estimated: number | null; isApprox: boolean; note: string }

export function parseDoyalistEstimate(value: unknown): DoyalistEstimate | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const data = value as Record<string, unknown>
  if (data.success !== true || data.error !== undefined || data.code !== undefined ||
      (data.note != null && (typeof data.note !== 'string' || data.note.length > 500))) return null
  if (data.estimated === null) {
    if (data.isApprox !== undefined && typeof data.isApprox !== 'boolean') return null
    return { estimated: null, isApprox: false, note: '参考件数を取得できませんでした。実際の取得件数は抽出後にご確認ください。' }
  }
  if (!Number.isSafeInteger(data.estimated) || (data.estimated as number) < 0 || typeof data.isApprox !== 'boolean') return null
  return { estimated: data.estimated as number, isApprox: data.isApprox, note: typeof data.note === 'string' ? data.note : '' }
}
