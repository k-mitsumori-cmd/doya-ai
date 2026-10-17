// 実行: npm run test:income
// 他社の取引先・契約・請求書・入金を見たり変えたりできないこと（IDOR）を、ソースから静的に確かめる。
// ⚠️ id だけで引く・更新すると、他社の id を指定したときに中身が返る・書き換わる。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
function walk(dir: string, pick: (name: string) => boolean): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p, pick) : pick(name) ? [p] : []
  })
}

const routes = walk(join(root, 'src/app/api/income'), (n) => n === 'route.ts')
const libs = ['contracts.ts', 'invoices.ts', 'payments.ts', 'summary.ts'].map((f) => join(root, 'src/lib/income', f))
const rel = (f: string) => f.slice(root.length + 1)

/** 開き括弧の位置から、対応する閉じ括弧までを返す */
function balanced(src: string, open: number): string {
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1)
  }
  return src.slice(open)
}

/** prisma の呼び出し `incomeXxx.method({ where: ... })` の where 部分を取り出す */
function calls(src: string) {
  const out: { model: string; method: string; where: string }[] = []
  const re = /\b(income[A-Z]\w*)\.(findFirst|findMany|findUnique|count|aggregate|groupBy|update|updateMany|delete|deleteMany|upsert)\(\{/g
  for (const m of src.matchAll(re)) {
    const arg = balanced(src, m.index! + m[0].length - 1)
    const w = /where:\s*/.exec(arg)
    let where = ''
    if (w) {
      const at = w.index + w[0].length
      where = arg[at] === '{' ? balanced(arg, at) : (/^\w+/.exec(arg.slice(at))?.[0] ?? '')
    }
    out.push({ model: m[1], method: m[2], where })
  }
  return out
}

test('API のルートが見つかる', () => {
  assert.ok(routes.length >= 15, routes.map(rel).join(', '))
})

for (const file of routes) {
  const src = readFileSync(file, 'utf8')
  test(`${rel(file)}: すべてのハンドラで withIncome（ログイン・組織・ロール確認）を通す`, () => {
    const handlers = src.match(/export async function (GET|POST|PATCH|PUT|DELETE)\b/g) || []
    const guarded = src.match(/return withIncome\(req, '(member|manager|admin|owner)'/g) || []
    assert.ok(handlers.length > 0)
    assert.equal(guarded.length, handlers.length)
  })
}

for (const file of [...routes, ...libs]) {
  const src = readFileSync(file, 'utf8')
  test(`${rel(file)}: 収入管理の表は組織で絞ってから読み書きする`, () => {
    for (const c of calls(src)) {
      const w = c.where
      if (c.model === 'incomeAuditLog') continue
      if (c.model === 'incomeOrganization') {
        assert.match(w, /id:\s*(ctx\.organizationId|orgId)\b/, `自組織以外の組織を引いている: ${w}`)
        continue
      }
      if (c.method === 'findUnique' || c.method === 'upsert') {
        // 組織が主キー・複合キーの表だけ（請求元・採番）、または組織付きの複合一意キー
        assert.ok(/organizationId|contractId_period|paymentId_invoiceId/.test(w), `${c.model}.${c.method} が組織なしで引いている: ${w}`)
        continue
      }
      if (c.method === 'update' || c.method === 'delete') {
        // 組織で確認済みの行（own / inv / payment / alloc / contract / own.id など）だけ
        assert.match(w, /id:\s*(own|inv|payment|alloc|contract|ctx)\.\w+|organizationId/, `確認していない id で ${c.model}.${c.method}: ${w}`)
        continue
      }
      // 子表（明細・消込）は親の id で絞る。親は同じ処理の中で組織確認済み
      if (/incomeContractItem|incomeInvoiceItem|incomePaymentAllocation/.test(c.model)) {
        assert.match(w, /invoiceId|contractId|paymentId|organizationId/, `${c.model}.${c.method}: ${w}`)
        continue
      }
      assert.match(w, /organizationId/, `${c.model}.${c.method} に organizationId が無い: ${w}`)
    }
  })
}

test('cron は CRON_SECRET で守る', () => {
  const src = readFileSync(join(root, 'src/app/api/cron/income-schedule/route.ts'), 'utf8')
  assert.match(src, /Bearer \$\{process\.env\.CRON_SECRET\}/)
  assert.match(src, /!process\.env\.CRON_SECRET/)
})
