// ============================================
// ドヤパワーの台帳の入口を、旗（DOYA_POWER_ROLLOUT）で止める
// ============================================
// 旗が off のときは、台帳を作らず、DB（doya_power_* の表）にも触れずに DoyaPowerDisabledError で止める。
// ⚠️ 本番DBに台帳の表が無いうちは off のまま。表を足すのはユーザーの承認のあと（DOYA-POWER-MIGRATION.md）。
// ⚠️ ここは「人を問わない」止め方（off なら誰の分も動かない）。人ごとの出し分け（preview）は、
//    画面・API の側で isDoyaPowerEnabled() を見てから呼ぶ。
import { createDoyaPowerLedger, type LedgerDb } from './ledger'

export class DoyaPowerDisabledError extends Error {
  constructor() {
    super('doya-power is disabled (DOYA_POWER_ROLLOUT=off)')
    this.name = 'DoyaPowerDisabledError'
  }
}

type Ledger = ReturnType<typeof createDoyaPowerLedger>

/**
 * 旗の内側でだけ動く台帳。db は使うときに初めて取りに行く（off のときは一度も取りに行かない）。
 * allowed は呼ぶたびに見る（環境変数の値をテストで渡せるように、関数で受け取る）。
 */
export function createGatedLedger(getDb: () => LedgerDb, allowed: () => boolean, options: { now?: () => Date } = {}) {
  let ledger: Ledger | null = null
  const open = (): Ledger => {
    if (!allowed()) throw new DoyaPowerDisabledError()
    if (!ledger) ledger = createDoyaPowerLedger(getDb(), options)
    return ledger
  }
  return {
    consume: async (...a: Parameters<Ledger['consume']>) => open().consume(...a),
    refund: async (...a: Parameters<Ledger['refund']>) => open().refund(...a),
    grant: async (...a: Parameters<Ledger['grant']>) => open().grant(...a),
    grantMonthlyForPlan: async (...a: Parameters<Ledger['grantMonthlyForPlan']>) => open().grantMonthlyForPlan(...a),
    balance: async (...a: Parameters<Ledger['balance']>) => open().balance(...a),
    balanceForUser: async (...a: Parameters<Ledger['balanceForUser']>) => open().balanceForUser(...a),
  }
}
