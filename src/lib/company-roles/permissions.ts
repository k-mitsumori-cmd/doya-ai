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

export type PermissionScope = 'self' | 'department' | 'all'

interface Rule {
  /** この役割以上で通る */
  min: CompanyRole
  /** 対象の広さ（無ければ会社全体の操作） */
  scope?: PermissionScope
  /** 自分の分には使えない */
  noSelfApproval?: boolean
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
  'billing.view': { min: 'admin' },
  'billing.manage': { min: 'owner' }, // 契約・支払い方法・人数の変更・解約
  'power.purchase': { min: 'owner' }, // ドヤパワーの追加購入
  'power.history.view': { min: 'admin' },

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
  'expense.view.all': { min: 'admin', scope: 'all' },
  'expense.approve.department': { min: 'manager', scope: 'department', noSelfApproval: true },
  'expense.approve.all': { min: 'admin', scope: 'all', noSelfApproval: true },
  'expense.edit.all': { min: 'admin', scope: 'all', noSelfApproval: true },
  'expense.settings': { min: 'admin' },

  // 請求・収入
  'invoice.view': { min: 'member' },
  'invoice.draft': { min: 'member' },
  'invoice.issue': { min: 'admin' }, // 発行・送付・入金の消し込み
  'invoice.void': { min: 'admin' },

  // 見積
  'quote.view': { min: 'member' },
  'quote.draft': { min: 'member' },
  'quote.finalize': { min: 'manager' }, // 確定・送付（確定した見積は売上の予定に入る）
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

/** その役割の人が、その操作をしてよいか。迷う入力はすべて拒否する */
export function decideCompanyPermission(role: unknown, permission: unknown, target: PermissionTarget = {}): PermissionDecision {
  if (!isCompanyRole(role)) return { ok: false, reason: 'UNKNOWN_ROLE' }
  if (!isCompanyPermission(permission)) return { ok: false, reason: 'UNKNOWN_PERMISSION' }
  const rule: Rule = PERMISSIONS[permission]
  if (COMPANY_ROLE_RANK[role] < COMPANY_ROLE_RANK[rule.min]) return { ok: false, reason: 'ROLE_TOO_LOW' }
  if (rule.scope === 'self' && target.isSelf !== true) return { ok: false, reason: 'NOT_SELF' }
  if (rule.scope === 'department' && target.isSelf !== true && target.sameDepartment !== true) {
    return { ok: false, reason: 'NOT_DEPARTMENT' }
  }
  if (rule.noSelfApproval && target.isSelf === true && role !== 'owner') return { ok: false, reason: 'SELF_APPROVAL' }
  return { ok: true }
}

export function canCompany(role: unknown, permission: unknown, target: PermissionTarget = {}): boolean {
  return decideCompanyPermission(role, permission, target).ok
}

/** 画面の「できること表」に出す行（設計書の表と、テストで突き合わせる） */
export function permissionMatrix(): Array<{ permission: CompanyPermission; allowed: CompanyRole[] }> {
  const roles: CompanyRole[] = ['owner', 'admin', 'manager', 'member', 'guest']
  return (Object.keys(PERMISSIONS) as CompanyPermission[]).map((permission) => ({
    permission,
    allowed: roles.filter((r) => COMPANY_ROLE_RANK[r] >= COMPANY_ROLE_RANK[PERMISSIONS[permission].min]),
  }))
}
