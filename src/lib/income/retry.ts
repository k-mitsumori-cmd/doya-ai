// ============================================
// ドヤ収入管理: 同時実行の衝突でトランザクションをやり直す（純粋関数。DB に触れない）
// ============================================
// 請求書の確定（採番）で使う。年初に同じ組織の請求書を同時に確定すると、
// 採番表（IncomeInvoiceSequence）の最初の行を 2 つの処理が同時に作り、片方が P2002（一意制約の違反）になる。
// Serializable の衝突は P2034 になる。どちらも、やり直せば次の番号で確定できる（INC-F03）。
// ⚠️ 業務エラー（IncomeError など code を持たないもの）はやり直さない。

/** やり直してよい Prisma のエラーコード */
export const RETRYABLE_TX_CODES = ['P2002', 'P2034'] as const

export function isRetryableTxError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' && (RETRYABLE_TX_CODES as readonly string[]).includes(code)
}

/** run を最大 attempts 回まで実行する。やり直せるエラーのときだけ次を試し、最後のエラーはそのまま投げる */
export async function runWithTxRetry<T>(run: () => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run()
    } catch (error) {
      if (attempt >= attempts || !isRetryableTxError(error)) throw error
    }
  }
}
