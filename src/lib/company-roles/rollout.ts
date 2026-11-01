// ============================================
// 会社の役割を使うかどうか（旗）
// ============================================
//   COMPANY_ROLES_ROLLOUT=off      … 使わない（既定。値が無い・知らない値も off）。今の各ツールの役割のまま
//   COMPANY_ROLES_ROLLOUT=shadow   … 判定だけして、止めない。止めるはずだった操作を記録する（on にする前の確かめ）
//   COMPANY_ROLES_ROLLOUT=preview  … UI_PREVIEW_EMAILS で許可した人だけ、止める
//   COMPANY_ROLES_ROLLOUT=all      … 全員、止める
// ⚠️ 判定はサーバーだけで行う。off のときは、新しい表（account_company_members の役割・account_company_role_events）を読まない。
// ⚠️ 新しい料金の表（account_company_members）は、本番DBにまだ無い（PRICING-NEW-MIGRATION.md）。表ができるまで off のまま。
import { canPreviewUiNext, uiPreviewEmails } from '@/lib/ui-next'

export type CompanyRolesRollout = 'off' | 'shadow' | 'preview' | 'all'

export function companyRolesRollout(raw: string | undefined = process.env.COMPANY_ROLES_ROLLOUT): CompanyRolesRollout {
  const v = (raw ?? '').trim().toLowerCase()
  if (v === 'shadow' || v === 'preview' || v === 'all') return v
  return 'off'
}

export type CompanyRolesMode = 'off' | 'shadow' | 'enforce'

/** この人に対して、会社の役割をどう使うか（テストのため、旗・メール・許可の一覧を引数で受け取る） */
export function decideCompanyRolesMode(input: { rollout: CompanyRolesRollout; email: string | null | undefined; allow: string[] }): CompanyRolesMode {
  if (input.rollout === 'off') return 'off'
  if (input.rollout === 'shadow') return 'shadow'
  if (input.rollout === 'all') return 'enforce'
  // preview: 許可した人だけ止める。ほかの人は記録だけ
  return canPreviewUiNext(input.email, input.allow) ? 'enforce' : 'shadow'
}

export function companyRolesModeFor(email: string | null | undefined): CompanyRolesMode {
  return decideCompanyRolesMode({ rollout: companyRolesRollout(), email, allow: uiPreviewEmails() })
}
