// ============================================
// 会社の中の役割（オーナー・管理者・マネージャー・メンバー・ゲスト）
// ============================================
// 仕様: docs/architecture/management-agent/ROLES-2026-10-26.md
// ⚠️ 判定はサーバーだけで行う。画面の出し分けは、サーバーが判定した結果を受け取って使う（クライアントで判定しない）。
// ⚠️ オーナーは会社の持ち主（account_companies.userId）。account_company_members には行を持たない（新しい料金の決まりと同じ）。
// ⚠️ この表は DB にも Stripe にも触らない（テストあり: company-roles.test.ts）。

export const COMPANY_ROLES = ['owner', 'admin', 'manager', 'billing', 'member', 'guest'] as const
export type CompanyRole = (typeof COMPANY_ROLES)[number]

/** メンバーの行に入れてよい役割（オーナーは行を持たない） */
export const MEMBER_ROW_ROLES = ['admin', 'manager', 'billing', 'member', 'guest'] as const
export type MemberRowRole = (typeof MEMBER_ROW_ROLES)[number]

// 請求の担当（billing）は、ふだんの操作はメンバーと同じ。料金と請求の操作だけを、できること表（permissions.ts の extra）で足す。
// 順番の上ではメンバーと同じ（ツールの中の役割の上限もメンバーと同じ）。
export const COMPANY_ROLE_RANK: Record<CompanyRole, number> = { guest: 0, member: 1, billing: 1, manager: 2, admin: 3, owner: 4 }

export const COMPANY_ROLE_LABEL: Record<CompanyRole, string> = {
  owner: 'オーナー',
  admin: '管理者',
  manager: 'マネージャー',
  billing: '請求の担当',
  member: 'メンバー',
  guest: 'ゲスト',
}

/** 招待や役割の変更の画面に出す説明（1行） */
export const COMPANY_ROLE_DESCRIPTION: Record<CompanyRole, string> = {
  owner: '契約と支払い、役割の変更、会社の削除ができます。会社に1人です。',
  admin: 'すべてのツールの設定と承認、ほかの人のデータの修正ができます。',
  manager: '自分の部署の人の申請を承認できます。ほかの人のデータは直せません。',
  billing: 'メンバーと同じことに加えて、料金と請求を見て、請求書を発行できます。支払い方法は変えられません。',
  member: '自分のデータだけを扱えます。勤怠は打刻と申請だけです。',
  guest: '共有された画面を見るだけです。書き込みはできません。',
}

export function isCompanyRole(v: unknown): v is CompanyRole {
  return typeof v === 'string' && (COMPANY_ROLES as readonly string[]).includes(v)
}

export function isMemberRowRole(v: unknown): v is MemberRowRole {
  return typeof v === 'string' && (MEMBER_ROW_ROLES as readonly string[]).includes(v)
}

/** 役割が min 以上か。知らない値は常に false（既定は拒否） */
export function hasMinCompanyRole(role: unknown, min: CompanyRole): boolean {
  if (!isCompanyRole(role)) return false
  return COMPANY_ROLE_RANK[role] >= COMPANY_ROLE_RANK[min]
}

/**
 * 相手のメンバーの役割を変える・外すことができるか。
 * - オーナーは誰でも（自分以外）。管理者は、自分より下の役割の人だけ（同じ管理者は不可）。
 * - 自分自身は変えられない（自分で上げる・下げるを防ぐ）。オーナーの行は変えられない（引き継ぎは別の手順）。
 */
export function canManageCompanyMember(input: { actor: CompanyRole; target: CompanyRole; isSelf: boolean }): boolean {
  if (input.isSelf) return false
  if (input.target === 'owner') return false
  if (input.actor === 'owner') return true
  if (input.actor !== 'admin') return false
  return COMPANY_ROLE_RANK[input.target] < COMPANY_ROLE_RANK[input.actor]
}

/** その役割を付けてよいか（招待・変更のとき）。オーナーはここでは付けない（引き継ぎは運営の手作業） */
export function canGrantCompanyRole(actor: CompanyRole, role: CompanyRole): boolean {
  if (role === 'owner') return false
  if (actor === 'owner') return true
  if (actor !== 'admin') return false
  return COMPANY_ROLE_RANK[role] < COMPANY_ROLE_RANK[actor]
}

/** 画面の選択肢: その人が付けられる役割（高い順） */
export function grantableCompanyRoles(actor: CompanyRole): MemberRowRole[] {
  return [...MEMBER_ROW_ROLES].filter((r) => canGrantCompanyRole(actor, r))
}
