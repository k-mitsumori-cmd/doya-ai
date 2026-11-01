// ============================================
// 会社の役割ごとの「できること表」（操作 × 役割）
// ============================================
// 仕様: docs/architecture/management-agent/ROLES-2026-10-26.md §3（表は設計書と同じ。変えるときは両方を直す）
// 決まり:
// - 表に無い操作は、誰もできない（既定は拒否）。
// - scope が self の操作は、自分のデータのときだけ通る。department は、自分の部署の人のデータのときだけ通る。
// - noSelfApproval の操作は、自分の申請・自分のデータには使えない（自分で自分を承認できない）。管理者も同じ。
//   オーナーだけは、1人で使う会社のために自分の分を承認できる（記録には残す）。
// ⚠️ 判定はサーバーだけで行う。部署が同じかどうかは、各ツールの部署（KintaiEmployee.departmentId など）をサーバーで読んで渡す。
import { COMPANY_ROLE_RANK, isCompanyRole, type CompanyRole } from './roles'
import { DEFAULT_ROLE_POLICY, type CompanyRolePolicy } from './policy'

export type PermissionScope = 'self' | 'department' | 'all'

interface Rule {
  /** この役割以上で通る */
  min: CompanyRole
  /** 対象の広さ（無ければ会社全体の操作） */
  scope?: PermissionScope
  /** 自分の分には使えない */
  noSelfApproval?: boolean
  /** 順番に関係なく、この役割にも許す（請求の担当など） */
  extra?: readonly CompanyRole[]
}

/** 操作ごとの決まり。scope ごとに別の操作として持つ（「自分の分」と「部署の分」と「全員の分」で必要な役割が違うため） */
export const PERMISSIONS = {
  // 会社・契約
  'company.view': { min: 'guest' },
  'company.settings.edit': { min: 'admin' },
  'company.delete': { min: 'owner' },
  'company.owner.transfer': { min: 'owner' },
  'members.view': { min: 'member' },
  'members.invite': { min: 'admin' },
  'members.role.change': { min: 'admin' },
  'members.remove': { min: 'admin' },
  'members.role_events.view': { min: 'admin' },
  'billing.view': { min: 'admin', extra: ['billing'] },
  'billing.manage': { min: 'owner' }, // 契約・支払い方法・人数の変更・解約
  'power.purchase': { min: 'owner' }, // ドヤパワーの追加購入
  'power.history.view': { min: 'admin', extra: ['billing'] },

  // 勤怠
  'kintai.clock.self': { min: 'member', scope: 'self' }, // 打刻（時刻はサーバーの今。任意の時刻は送れない）
  'kintai.request.create.self': { min: 'member', scope: 'self' }, // 打刻の修正・休暇・残業の申請
  'kintai.attendance.view.self': { min: 'member', scope: 'self' },
  'kintai.attendance.view.department': { min: 'manager', scope: 'department' },
  'kintai.attendance.view.all': { min: 'admin', scope: 'all' },
  'kintai.request.approve.department': { min: 'manager', scope: 'department', noSelfApproval: true },
  'kintai.request.approve.all': { min: 'admin', scope: 'all', noSelfApproval: true },
  'kintai.attendance.edit.all': { min: 'admin', scope: 'all', noSelfApproval: true }, // 勤怠の直接の修正・上書き
  'kintai.workrule.manage': { min: 'admin' },
  'kintai.employee.manage': { min: 'admin' },
  'kintai.export': { min: 'admin' },

  // 経費（立替の精算）・支出
  'expense.create.self': { min: 'member', scope: 'self' },
  'expense.view.department': { min: 'manager', scope: 'department' },
  'expense.view.all': { min: 'admin', scope: 'all', extra: ['billing'] },
  'expense.approve.department': { min: 'manager', scope: 'department', noSelfApproval: true },
  'expense.approve.all': { min: 'admin', scope: 'all', noSelfApproval: true },
  'expense.edit.all': { min: 'admin', scope: 'all', noSelfApproval: true },
  'expense.settings': { min: 'admin' },

  // 請求・収入
  'invoice.view': { min: 'member' },
  'invoice.draft': { min: 'member' },
  'invoice.issue': { min: 'manager', extra: ['billing'] }, // 確定・発行・送付・入金の消し込み（会社ごとに切り替えられる: policy.invoiceIssueMin）
  'invoice.void': { min: 'admin', extra: ['billing'] },
  'income.contract.edit': { min: 'member' }, // 契約（金額を含む）を作る・直す（会社ごとに切り替えられる: policy.contractEditMin）

  // 見積
  'quote.view': { min: 'member' },
  'quote.draft': { min: 'member' },
  'quote.finalize': { min: 'manager' }, // 確定・送付（確定した見積は売上の予定に入る。policy.quoteFinalizeMin・quoteSelfFinalize）
  'quote.settings': { min: 'admin' },

  // HR（評価・人事）
  'hr.evaluation.self': { min: 'member', scope: 'self' }, // 自己評価
  'hr.evaluation.department': { min: 'manager', scope: 'department', noSelfApproval: true }, // 部下の評価
  'hr.evaluation.finalize': { min: 'admin', scope: 'all', noSelfApproval: true },
  'hr.sensitive.view': { min: 'admin', scope: 'all' }, // 給与・評価の結果などの機微な情報
  'hr.settings': { min: 'admin' },

  // エージェント（経営ホームで頼む）
  'agent.run': { min: 'member' }, // 実行の中の各道具は、頼んだ人の権限でもう一度判定する
  'agent.approve.self': { min: 'member', scope: 'self' }, // 自分が頼んだ下書きの承認
  'agent.settings': { min: 'admin' }, // 「勝手にやってくれる」範囲の設定

  // ほかのツールの共通（営業管理・AI 診断など、ツールの中に役割があるもの）
  'tool.view': { min: 'guest' },
  'tool.use': { min: 'member' },
  'tool.settings': { min: 'admin' },
} as const satisfies Record<string, Rule>

export type CompanyPermission = keyof typeof PERMISSIONS

export function isCompanyPermission(v: unknown): v is CompanyPermission {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(PERMISSIONS, v)
}

export interface PermissionTarget {
  /** 対象のデータが自分のものか（自分の勤怠・自分の申請） */
  isSelf?: boolean
  /** 対象の人が自分の部署か（サーバーで各ツールの部署を読んで決める） */
  sameDepartment?: boolean
}

export type PermissionDecision =
  | { ok: true }
  | { ok: false; reason: 'UNKNOWN_ROLE' | 'UNKNOWN_PERMISSION' | 'ROLE_TOO_LOW' | 'NOT_SELF' | 'NOT_DEPARTMENT' | 'SELF_APPROVAL' }

/** 会社ごとの切り替え（policy.ts）を、操作の決まりに当てる */
export function ruleFor(permission: CompanyPermission, policy: CompanyRolePolicy = DEFAULT_ROLE_POLICY): Rule {
  const base: Rule = PERMISSIONS[permission]
  switch (permission) {
    case 'invoice.issue':
      return { ...base, min: policy.invoiceIssueMin }
    case 'income.contract.edit':
      return { ...base, min: policy.contractEditMin }
    case 'quote.finalize':
      return { ...base, min: policy.quoteFinalizeMin, noSelfApproval: policy.quoteSelfFinalize === 'deny' }
    default:
      return base
  }
}

/** オーナーが自分の分を承認・確定してよいか（1人で使う会社のため。HR の評価は policy で切り替える） */
function ownerMaySelfApprove(permission: CompanyPermission, policy: CompanyRolePolicy): boolean {
  if (permission === 'hr.evaluation.finalize') return policy.hrSelfFinalize !== 'nobody'
  return true
}

/** 管理者が自分の分を承認・確定してよいか（既定は不可。HR の評価だけ policy で許せる） */
function adminMaySelfApprove(permission: CompanyPermission, policy: CompanyRolePolicy): boolean {
  if (permission === 'hr.evaluation.finalize') return policy.hrSelfFinalize === 'owner_and_admin'
  return false
}

/** その役割の人が、その操作をしてよいか。迷う入力はすべて拒否する */
export function decideCompanyPermission(role: unknown, permission: unknown, target: PermissionTarget = {}, policy: CompanyRolePolicy = DEFAULT_ROLE_POLICY): PermissionDecision {
  if (!isCompanyRole(role)) return { ok: false, reason: 'UNKNOWN_ROLE' }
  if (!isCompanyPermission(permission)) return { ok: false, reason: 'UNKNOWN_PERMISSION' }
  const rule = ruleFor(permission, policy)
  const byRank = role !== 'billing' && COMPANY_ROLE_RANK[role] >= COMPANY_ROLE_RANK[rule.min]
  // 請求の担当は、順番ではメンバーと同じ。min が member 以下の操作と、extra に載っている操作だけ
  const byBillingRank = role === 'billing' && COMPANY_ROLE_RANK[rule.min] <= COMPANY_ROLE_RANK.member
  const byExtra = !!rule.extra?.includes(role)
  if (!byRank && !byBillingRank && !byExtra) return { ok: false, reason: 'ROLE_TOO_LOW' }
  if (rule.scope === 'self' && target.isSelf !== true) return { ok: false, reason: 'NOT_SELF' }
  if (rule.scope === 'department' && target.isSelf !== true && target.sameDepartment !== true) {
    return { ok: false, reason: 'NOT_DEPARTMENT' }
  }
  if (rule.noSelfApproval && target.isSelf === true) {
    const allowed = role === 'owner' ? ownerMaySelfApprove(permission, policy) : role === 'admin' ? adminMaySelfApprove(permission, policy) : false
    if (!allowed) return { ok: false, reason: 'SELF_APPROVAL' }
  }
  return { ok: true }
}

export function canCompany(role: unknown, permission: unknown, target: PermissionTarget = {}, policy: CompanyRolePolicy = DEFAULT_ROLE_POLICY): boolean {
  return decideCompanyPermission(role, permission, target, policy).ok
}

/** 画面の「できること表」に出す行（設計書の表と、テストで突き合わせる） */
export function permissionMatrix(policy: CompanyRolePolicy = DEFAULT_ROLE_POLICY): Array<{ permission: CompanyPermission; allowed: CompanyRole[] }> {
  const roles: CompanyRole[] = ['owner', 'admin', 'manager', 'billing', 'member', 'guest']
  return (Object.keys(PERMISSIONS) as CompanyPermission[]).map((permission) => ({
    permission,
    // 対象の広さの決まりは除いて、役割だけで見る（自分の分・部署の分として通るか）
    allowed: roles.filter((r) => decideCompanyPermission(r, permission, { isSelf: false, sameDepartment: true }, policy).ok || decideCompanyPermission(r, permission, { isSelf: true }, policy).ok),
  }))
}
