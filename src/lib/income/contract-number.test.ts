// 実行: npm run test:income
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Prisma } from '@prisma/client'
import { nextContractNo } from './contract-number'

const txWith = (nos: (string | null)[]) =>
  ({
    incomeContract: {
      findMany: async ({ where }: { where: { contractNo: { startsWith: string } } }) =>
        nos.filter((n) => n && n.startsWith(where.contractNo.startsWith)).map((contractNo) => ({ contractNo })),
    },
  }) as unknown as Prisma.TransactionClient

test('契約が無ければ C-年-0001', async () => {
  assert.equal(await nextContractNo(txWith([]), 'org', '2026-10-26'), 'C-2026-0001')
})
test('最大の番号に 1 を足す。手で付けた別形式や、別の年は数えない', async () => {
  const tx = txWith(['C-2026-0003', 'C-2026-0010', 'A-001', 'C-2025-0099', 'C-2026-メモ', null])
  assert.equal(await nextContractNo(tx, 'org', '2026-10-26'), 'C-2026-0011')
})
test('年が変わると 0001 から', async () => {
  assert.equal(await nextContractNo(txWith(['C-2026-0042']), 'org', '2027-01-05'), 'C-2027-0001')
})
