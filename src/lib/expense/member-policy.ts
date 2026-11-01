// ============================================
// ドヤ支出管理: メンバーの権限を変えてよいか（純粋関数）
// ============================================
// ⚠️ owner でない人は、自分と同じか上のロールを持つ人を変更・除外できず、自分と同じか上のロールを付与できない（`>=` で比べる）。
//    見積・面接・AI商談と同じ形（システム点検 EXP-006 / EXP-F02）。
// ⚠️ owner の操作はここでは制限しない。最後のオーナーを残す確認は API 側（assertOwnerRemains）で行う。
import { ROLE_RANK, type ExpenseRole } from './constants'

/** 相手のメンバー（現在のロール）を変更・除外してよいか */
export function canManageMember(actor: ExpenseRole, target: ExpenseRole): boolean {
  if (actor === 'owner') return true
  return ROLE_RANK[target] < ROLE_RANK[actor]
}

/** そのロールを付与してよいか（追加・変更のとき） */
export function canGrantRole(actor: ExpenseRole, role: ExpenseRole): boolean {
  if (actor === 'owner') return true
  return ROLE_RANK[role] < ROLE_RANK[actor]
}

/** 画面の選択肢: その人が付与できるロール */
export function grantableRoles(actor: ExpenseRole, all: readonly ExpenseRole[]): ExpenseRole[] {
  return all.filter((r) => canGrantRole(actor, r))
}
