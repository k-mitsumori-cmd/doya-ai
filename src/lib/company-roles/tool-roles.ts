// ============================================
// 各ツールの役割と、会社の役割のつながり（上限・移行の案）
// ============================================
// 仕様: docs/architecture/management-agent/ROLES-2026-10-26.md §4
// 決まり:
// - ツールの中で使える役割 ＝ min(ツールの役割, 会社の役割から決まる上限)。
// - 会社のゲストは、ゲストの役割があるツール（プロマネ）でだけ見られる。ほかのツールは使えない（上限が null）。
// - ツールの役割の文字列は、各ツールのものをそのまま使う（勤怠の hr_admin、HR の大文字など）。ここでは順番の表だけを持つ。
// - 移行の案: 今の会員の会社の役割は、会社のツールの組織での役割を写して、いちばん高いものにする（オーナーは持ち主だけ）。
//   案は画面でオーナーに見せて、決めてもらってから書く（自動では書かない）。
import { COMPANY_ROLE_RANK, type CompanyRole, type MemberRowRole } from './roles'

export type ToolId = 'kintai' | 'hr' | 'expense' | 'income' | 'quote' | 'promane' | 'sfa' | 'shodan' | 'aio' | 'mensetsu' | 'aishodan'

interface ToolRoleTable {
  /** 低い順 */
  order: readonly string[]
  /** 会社の役割ごとの、このツールでの上限（null はこのツールを使えない。ゲストの役割が無いツールのゲスト） */
  ceiling: Record<CompanyRole, string | null>
  /** このツールの役割から見た、会社の役割の案 */
  toCompany: Record<string, MemberRowRole>
}

const OWNER_ADMIN_MANAGER_MEMBER: ToolRoleTable = {
  order: ['member', 'manager', 'admin', 'owner'],
  ceiling: { owner: 'owner', admin: 'admin', manager: 'manager', billing: 'member', member: 'member', guest: null },
  toCompany: { owner: 'admin', admin: 'admin', manager: 'manager', member: 'member' },
}

export const TOOL_ROLE_TABLES: Record<ToolId, ToolRoleTable> = {
  // 勤怠: 一般 < 部門管理者 < 人事管理者 < システム管理者
  kintai: {
    order: ['employee', 'manager', 'hr_admin', 'system_admin'],
    ceiling: { owner: 'system_admin', admin: 'hr_admin', manager: 'manager', billing: 'employee', member: 'employee', guest: null },
    toCompany: { system_admin: 'admin', hr_admin: 'admin', manager: 'manager', employee: 'member' },
  },
  // HR: 大文字
  hr: {
    order: ['MEMBER', 'MANAGER', 'ADMIN', 'OWNER'],
    ceiling: { owner: 'OWNER', admin: 'ADMIN', manager: 'MANAGER', billing: 'MEMBER', member: 'MEMBER', guest: null },
    toCompany: { OWNER: 'admin', ADMIN: 'admin', MANAGER: 'manager', MEMBER: 'member' },
  },
  // プロマネ: guest がある。manager は無い
  promane: {
    order: ['guest', 'member', 'admin', 'owner'],
    ceiling: { owner: 'owner', admin: 'admin', manager: 'member', billing: 'member', member: 'member', guest: 'guest' },
    toCompany: { owner: 'admin', admin: 'admin', member: 'member', guest: 'guest' },
  },
  expense: OWNER_ADMIN_MANAGER_MEMBER,
  // 収入（請求書）は請求の担当の仕事なので、請求の担当の上限を管理者にする（請求書の発行・取り消しを会社の決まりで許すため）
  income: { ...OWNER_ADMIN_MANAGER_MEMBER, ceiling: { ...OWNER_ADMIN_MANAGER_MEMBER.ceiling, billing: 'admin' } },
  quote: OWNER_ADMIN_MANAGER_MEMBER,
  sfa: OWNER_ADMIN_MANAGER_MEMBER,
  shodan: OWNER_ADMIN_MANAGER_MEMBER,
  aio: OWNER_ADMIN_MANAGER_MEMBER,
  mensetsu: OWNER_ADMIN_MANAGER_MEMBER,
  aishodan: OWNER_ADMIN_MANAGER_MEMBER,
}

function rankIn(table: ToolRoleTable, role: string): number {
  return table.order.indexOf(role)
}

export interface EffectiveToolRole {
  /** ツールの中で使ってよい役割（null はこのツールを使えない） */
  role: string | null
  /** 会社の役割で下げたか（画面で「会社の役割で制限されています」と出すため） */
  clamped: boolean
}

/**
 * ツールの中で使ってよい役割。ツールの役割と、会社の役割から決まる上限の、低いほう。
 * 知らない役割の文字列は、使えない（null）にする。
 */
export function effectiveToolRole(tool: ToolId, toolRole: unknown, companyRole: CompanyRole): EffectiveToolRole {
  const table = TOOL_ROLE_TABLES[tool]
  if (typeof toolRole !== 'string' || rankIn(table, toolRole) < 0) return { role: null, clamped: false }
  const cap = table.ceiling[companyRole]
  if (cap === null) return { role: null, clamped: true }
  if (rankIn(table, toolRole) > rankIn(table, cap)) return { role: cap, clamped: true }
  return { role: toolRole, clamped: false }
}

export interface ToolMembershipLike {
  tool: ToolId
  role: string
}

/**
 * 移行の案: 会社のツールの組織での役割を写して、いちばん高い会社の役割を返す。
 * 何も無ければ member。ツールの owner は会社の admin に写す（会社のオーナーは持ち主だけ）。
 */
export function proposeCompanyRole(memberships: ToolMembershipLike[]): MemberRowRole {
  let best: MemberRowRole | null = null
  for (const m of memberships) {
    const mapped = TOOL_ROLE_TABLES[m.tool]?.toCompany[m.role]
    if (!mapped) continue
    if (!best || COMPANY_ROLE_RANK[mapped] > COMPANY_ROLE_RANK[best]) best = mapped
  }
  return best ?? 'member'
}

/** 旗を on にしたら、ツールの中の役割が下がる人か（移行の画面で、先にオーナーに見せる） */
export function wouldBeClamped(memberships: ToolMembershipLike[], companyRole: CompanyRole): ToolMembershipLike[] {
  return memberships.filter((m) => effectiveToolRole(m.tool, m.role, companyRole).clamped)
}

/**
 * 2つのツールの役割の低いほう。書き込みのトランザクションの中で、DB から役割を読み直すところで使う。
 * 入口（get{Svc}Context）で会社の上限を当てた役割（ctxRole）より、DB の役割（dbRole）が高ければ、ctxRole に下げる。
 * どちらかが知らない値なら null（使えない）。
 */
export function lowerToolRole(tool: ToolId, dbRole: unknown, ctxRole: unknown): string | null {
  const table = TOOL_ROLE_TABLES[tool]
  if (typeof dbRole !== 'string' || typeof ctxRole !== 'string') return null
  const a = rankIn(table, dbRole)
  const b = rankIn(table, ctxRole)
  if (a < 0 || b < 0) return null
  return a <= b ? dbRole : ctxRole
}
