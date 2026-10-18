// 実行: npm run test:income
// 請求書の確定で、同時実行の衝突（P2002 / P2034）をやり直すこと（INC-F03）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isRetryableTxError, runWithTxRetry } from './retry'
import { confirmInvoiceWithRetry } from './invoices'
import { IncomeError, type IncomeContext } from './access'

const err = (code: string) => Object.assign(new Error(code), { code })

test('やり直す対象は P2002 と P2034 だけ', () => {
  assert.equal(isRetryableTxError(err('P2002')), true)
  assert.equal(isRetryableTxError(err('P2034')), true)
  assert.equal(isRetryableTxError(err('P2025')), false)
  assert.equal(isRetryableTxError(new IncomeError('下書きではありません', 409)), false)
  assert.equal(isRetryableTxError(null), false)
})

test('P2002 の後はやり直して成功する', async () => {
  let calls = 0
  const result = await runWithTxRetry(async () => {
    calls++
    if (calls === 1) throw err('P2002')
    return 'INV-2027-0002'
  })
  assert.equal(result, 'INV-2027-0002')
  assert.equal(calls, 2)
})

test('衝突が続くときは 3 回で止め、最後のエラーを投げる', async () => {
  let calls = 0
  await assert.rejects(
    runWithTxRetry(async () => {
      calls++
      throw err('P2034')
    }),
    (e: unknown) => (e as { code?: string }).code === 'P2034',
  )
  assert.equal(calls, 3)
})

test('業務エラーはやり直さない（2 回目の確定で番号を重ねない）', async () => {
  let calls = 0
  await assert.rejects(
    runWithTxRetry(async () => {
      calls++
      throw new IncomeError('確定した請求書は編集できません', 409)
    }),
    IncomeError,
  )
  assert.equal(calls, 1)
})

test('確定 API・エージェント道具の確定は、年初の同時確定（P2002）でやり直す', async () => {
  // 1 回目は採番表の最初の行を同時に作って P2002、2 回目は行の更新に回って確定できる
  const isolation: string[] = []
  let calls = 0
  const db = {
    $transaction: (async (_fn: unknown, opts?: { isolationLevel?: string }) => {
      calls++
      isolation.push(opts?.isolationLevel ?? '')
      if (calls === 1) throw err('P2002')
      return { id: 'inv1', invoiceNo: 'INV-2027-0002' }
    }) as never,
  }
  const ctx: IncomeContext = { userId: 'u', organizationId: 'o', organizationSlug: 's', organizationName: 'n', role: 'manager', memberId: 'm' }
  const inv = await confirmInvoiceWithRetry(db, ctx, 'inv1')
  assert.equal((inv as { invoiceNo: string }).invoiceNo, 'INV-2027-0002')
  assert.equal(calls, 2)
  assert.deepEqual(isolation, ['Serializable', 'Serializable'])
})
