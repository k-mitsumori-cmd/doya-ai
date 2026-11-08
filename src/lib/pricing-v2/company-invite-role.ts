export const COMPANY_INVITE_ROLES = ['member', 'admin', 'guest'] as const
export type CompanyInviteRole = (typeof COMPANY_INVITE_ROLES)[number]

/** Missing role keeps the original member contract. An explicit unsupported
 * role must not silently turn a requested viewer into an operator. */
export function companyInviteRole(value: unknown): CompanyInviteRole | null {
  if (value === undefined) return 'member'
  return typeof value === 'string' && (COMPANY_INVITE_ROLES as readonly string[]).includes(value) ? value as CompanyInviteRole : null
}

export const COMPANY_INVITE_ROLE_LABEL: Record<CompanyInviteRole, string> = {
  member: '操作メンバー', admin: '管理者', guest: 'ゲスト（閲覧のみ）',
}
