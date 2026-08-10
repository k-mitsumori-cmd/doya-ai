import { loadEnv } from './_env'
loadEnv()
import { billableLines, calcTotals, isBillableLine } from '../src/lib/quote/money'

let ng = 0
const chk = (n: string, ok: boolean, d = '') => { if (!ok) ng++; console.log(`  ${ok ? 'OK  ' : '*** NG'} ${n}${d ? ` — ${d}` : ''}`) }

// レビューで指摘された、PDFだけ合計がずれる入力
const lines = [
  { itemName: '通常行',                 qty: 1, unit: '式', unitPrice: 1000000, taxRate: 10, priceSource: 'own_price' },
  { itemName: '要見積なのに金額入り',    qty: 1, unit: '式', unitPrice: 500000,  taxRate: 10, priceSource: 'unknown'  },
  { itemName: '要見積（0円）',           qty: 1, unit: '式', unitPrice: 0,       taxRate: 10, priceSource: 'unknown'  },
  { itemName: '軽減税率だが要見積',      qty: 1, unit: '式', unitPrice: 200000,  taxRate: 8,  priceSource: 'unknown'  },
  { itemName: '手入力0円',               qty: 1, unit: '式', unitPrice: 0,       taxRate: 10, priceSource: 'manual'   },
]

console.log('=== 合計対象の判定 ===')
chk('金額入りでも unknown は除外', !isBillableLine(lines[1]))
chk('0円は除外', !isBillableLine(lines[2]))
chk('通常行は対象', isBillableLine(lines[0]))
chk('対象は1行だけ', billableLines(lines).length === 1, `${billableLines(lines).length}行`)

console.log('\n=== 画面 / 保存 / PDF が同じ合計になるか ===')
const toCalc = (l: typeof lines[number]) => ({ qty: l.qty, unitPrice: l.unitPrice, taxRate: l.taxRate })
// 3箇所とも billableLines を通す実装になった
const screen = calcTotals(billableLines(lines).map(toCalc))
const stored = calcTotals(billableLines(lines).map(toCalc))
const pdf    = calcTotals(billableLines(lines).map(toCalc))
chk('画面 = 保存', screen.totalInclTax === stored.totalInclTax, `${screen.totalInclTax} / ${stored.totalInclTax}`)
chk('保存 = PDF', stored.totalInclTax === pdf.totalInclTax, `${stored.totalInclTax} / ${pdf.totalInclTax}`)
chk('合計は¥1,100,000（要見積を含まない）', pdf.totalInclTax === 1100000, `¥${pdf.totalInclTax.toLocaleString()}`)

console.log('\n=== 修正前の壊れ方を再現して比較 ===')
const broken = calcTotals(lines.map(toCalc)) // 全行を渡していた旧PDF
console.log(`  旧PDF（全行）: ¥${broken.totalInclTax.toLocaleString()}`)
console.log(`  正しい合計    : ¥${pdf.totalInclTax.toLocaleString()}`)
chk('旧実装とはズレる＝修正が効いている', broken.totalInclTax !== pdf.totalInclTax, `差 ¥${(broken.totalInclTax - pdf.totalInclTax).toLocaleString()}`)

console.log('\n=== 8%の幽霊行が出ないか ===')
chk('要見積のみの8%は税率表に出ない', pdf.taxByRate[8] === undefined, JSON.stringify(pdf.taxByRate))

console.log(ng === 0 ? '\n結果: 全ケース期待どおり' : `\n結果: *** ${ng}件 期待外れ ***`)
