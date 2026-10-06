import type { Membership } from '@/components/org/OrgSwitcher'

export function parseQuoteOrganizations(value: unknown): { memberships: Membership[]; current: Membership | null } {
  const valid = (row: unknown): row is Membership => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return false
    const r = row as Membership
    return typeof r.slug === 'string' && r.slug.length > 0 && r.slug.length <= 512
      && typeof r.name === 'string' && r.name.trim().length > 0 && r.name.length <= 120
      && ['owner', 'admin', 'manager', 'member'].includes(r.role)
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('組織一覧を確認できませんでした')
  const data = value as Record<string, unknown>
  if (data.error !== undefined || data.code !== undefined || !Array.isArray(data.memberships)
      || !data.memberships.every(valid) || new Set(data.memberships.map((m) => m.slug)).size !== data.memberships.length
      || data.current !== null && !valid(data.current)) throw new Error('組織一覧を確認できませんでした')
  const current = data.current as Membership | null
  if (current && !data.memberships.some((m) => m.slug === current.slug && m.name === current.name && m.role === current.role)) {
    throw new Error('選択中の組織の所属を確認できませんでした')
  }
  return { memberships: data.memberships, current }
}
