/** Undefined preserves the legacy PUT contract; explicit null means a new profile. */
export function parseOrgProfileVersion(body: Record<string, unknown>): Date | null | undefined {
  if (!Object.prototype.hasOwnProperty.call(body, 'expectedUpdatedAt')) return undefined
  const value = body.expectedUpdatedAt
  if (value === null) return null
  if (typeof value !== 'string' || value.length !== 24) throw new Error('設定の更新日時を確認できません。再読み込みしてください。')
  const date = new Date(value)
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) throw new Error('設定の更新日時を確認できません。再読み込みしてください。')
  return date
}
