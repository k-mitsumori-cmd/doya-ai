// ============================================
// 会社ごとに切り替えられる決まり（権限の設定）
// ============================================
// 仕様: docs/architecture/management-agent/ROLES-2026-10-26.md §3.4
// 保存先: account_company_role_settings.policy（JSON。行が無ければ DEFAULT_ROLE_POLICY）
// 変えられるのはオーナーだけ（/api/company/role-settings）。変えたら account_company_role_events に残す。
// ⚠️ 保存された JSON は信じない。normalizeRolePolicy で、知らない値を初期値に戻してから使う。
import type { CompanyRole } from './roles'

export interface CompanyRolePolicy {
  /** 請求書の確定・発行・送付ができる、いちばん低い役割（請求の担当はいつもできる） */
  invoiceIssueMin: 'manager' | 'admin'
  /** 契約（金額を含む）を作る・直すことができる、いちばん低い役割 */
  contractEditMin: 'member' | 'manager' | 'admin'
  /** 見積の確定ができる、いちばん低い役割 */
  quoteFinalizeMin: 'manager' | 'admin'
  /** 見積を作った人が、自分で確定してよいか（deny でも、オーナーはできる） */
  quoteSelfFinalize: 'allow' | 'deny'
  /** HR の評価で、自分が評価される側の評価を確定してよい人 */
  hrSelfFinalize: 'nobody' | 'owner_only' | 'owner_and_admin'
}

/** 初期値（2026-10-26 ユーザーが「おすすめで」と決定。ROLES §3.4） */
export const DEFAULT_ROLE_POLICY: CompanyRolePolicy = Object.freeze({
  invoiceIssueMin: 'manager',
  contractEditMin: 'manager',
  quoteFinalizeMin: 'manager',
  quoteSelfFinalize: 'deny',
  hrSelfFinalize: 'owner_only',
})

/** 今のツールの動き（会社の役割を off にしているのと同じ結果になる値。比べるため） */
export const CURRENT_TOOL_BEHAVIOR: CompanyRolePolicy = Object.freeze({
  invoiceIssueMin: 'manager',
  contractEditMin: 'member',
  quoteFinalizeMin: 'manager',
  quoteSelfFinalize: 'allow',
  hrSelfFinalize: 'owner_and_admin',
})

const CHOICES: { [K in keyof CompanyRolePolicy]: readonly CompanyRolePolicy[K][] } = {
  invoiceIssueMin: ['manager', 'admin'],
  contractEditMin: ['member', 'manager', 'admin'],
  quoteFinalizeMin: ['manager', 'admin'],
  quoteSelfFinalize: ['allow', 'deny'],
  hrSelfFinalize: ['nobody', 'owner_only', 'owner_and_admin'],
}

export const POLICY_KEYS = Object.keys(CHOICES) as (keyof CompanyRolePolicy)[]

export function policyChoices<K extends keyof CompanyRolePolicy>(key: K): readonly CompanyRolePolicy[K][] {
  return CHOICES[key]
}

/** 画面に出す名前 */
export const POLICY_LABEL: { [K in keyof CompanyRolePolicy]: { title: string; options: Record<CompanyRolePolicy[K], string> } } = {
  invoiceIssueMin: { title: '請求書を確定・発行できる人', options: { manager: 'マネージャー以上と請求の担当', admin: '管理者以上と請求の担当' } },
  contractEditMin: { title: '契約の金額を直せる人', options: { member: 'メンバー以上', manager: 'マネージャー以上', admin: '管理者以上' } },
  quoteFinalizeMin: { title: '見積を確定できる人', options: { manager: 'マネージャー以上', admin: '管理者以上' } },
  quoteSelfFinalize: { title: '自分で作った見積を、自分で確定してよいか', options: { allow: 'よい', deny: 'ほかの人が確定する（オーナーは自分で確定できる）' } },
  hrSelfFinalize: { title: '自分が評価される側の評価を、自分で確定してよい人', options: { nobody: '誰もできない', owner_only: 'オーナーだけ', owner_and_admin: 'オーナーと管理者' } },
}

function pick<K extends keyof CompanyRolePolicy>(raw: unknown, key: K): CompanyRolePolicy[K] {
  const v = raw && typeof raw === 'object' ? (raw as Record<string, unknown>)[key] : undefined
  return (CHOICES[key] as readonly unknown[]).includes(v) ? (v as CompanyRolePolicy[K]) : DEFAULT_ROLE_POLICY[key]
}

/** 保存された JSON を、使える形にそろえる（知らないキーは捨て、知らない値は初期値にする） */
export function normalizeRolePolicy(raw: unknown): CompanyRolePolicy {
  return {
    invoiceIssueMin: pick(raw, 'invoiceIssueMin'),
    contractEditMin: pick(raw, 'contractEditMin'),
    quoteFinalizeMin: pick(raw, 'quoteFinalizeMin'),
    quoteSelfFinalize: pick(raw, 'quoteSelfFinalize'),
    hrSelfFinalize: pick(raw, 'hrSelfFinalize'),
  }
}

export type PolicyUpdateDecision =
  | { ok: true; policy: CompanyRolePolicy; changed: (keyof CompanyRolePolicy)[] }
  | { ok: false; status: number; code: 'OWNER_REQUIRED' | 'INVALID_VALUE' | 'NO_CHANGE' }

/** 設定を変えてよいか（オーナーだけ）。送られた値のうち、知らない値が1つでもあれば全体を断る */
export function decidePolicyUpdate(input: { actor: CompanyRole; current: CompanyRolePolicy; patch: unknown }): PolicyUpdateDecision {
  if (input.actor !== 'owner') return { ok: false, status: 403, code: 'OWNER_REQUIRED' }
  if (!input.patch || typeof input.patch !== 'object' || Array.isArray(input.patch)) return { ok: false, status: 400, code: 'INVALID_VALUE' }
  const patch = input.patch as Record<string, unknown>
  const next: CompanyRolePolicy = { ...input.current }
  const changed: (keyof CompanyRolePolicy)[] = []
  for (const [k, v] of Object.entries(patch)) {
    if (!(POLICY_KEYS as string[]).includes(k)) return { ok: false, status: 400, code: 'INVALID_VALUE' }
    const key = k as keyof CompanyRolePolicy
    if (!(CHOICES[key] as readonly unknown[]).includes(v)) return { ok: false, status: 400, code: 'INVALID_VALUE' }
    if (next[key] !== v) {
      ;(next as unknown as Record<string, unknown>)[key] = v
      changed.push(key)
    }
  }
  if (changed.length === 0) return { ok: false, status: 400, code: 'NO_CHANGE' }
  return { ok: true, policy: next, changed }
}
