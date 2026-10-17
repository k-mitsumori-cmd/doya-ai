// ドヤ収入管理: 役割（クライアント・サーバーの両方から読む。サーバー専用の import を持たない）
export const ROLE_HIERARCHY: Record<string, number> = { member: 1, manager: 2, admin: 3, owner: 4 }
export type IncomeRole = 'owner' | 'admin' | 'manager' | 'member'

export function hasMinRole(role: string, min: IncomeRole): boolean {
  return Object.prototype.hasOwnProperty.call(ROLE_HIERARCHY, role) && ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[min]
}
