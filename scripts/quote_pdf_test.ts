import { loadEnv } from './_env'
loadEnv()
import fs from 'fs'
import { generateQuotePdf } from '../src/lib/quote/pdf'

const issuer = {
  companyName: '株式会社スリスタ', postalCode: '150-0001', address: '東京都渋谷区神宮前1-2-3',
  tel: '03-0000-0000', personName: '三森 捷暉', invoiceNo: 'T1234567890123',
}
const lineItems = [
  { itemName: 'ドヤマーケAI プロプラン', spec: '全サービスPRO機能・12ヶ月契約', qty: 12, unit: '月', unitPrice: 9980, taxRate: 10, priceSource: 'own_price' },
  { itemName: '初期導入支援', spec: '設定代行・データ移行・操作研修', qty: 1, unit: '式', unitPrice: 300000, taxRate: 10, priceSource: 'market' },
  { itemName: 'SEO記事制作', spec: '5,000字・構成/執筆/入稿込み', qty: 6, unit: '本', unitPrice: 55000, taxRate: 10, priceSource: 'market' },
  { itemName: '個別カスタマイズ開発', spec: '要件確定後に別途お見積り', qty: 1, unit: '式', unitPrice: 0, taxRate: 10, priceSource: 'unknown' },
  { itemName: '軽減税率対象の資料送付', spec: '税率8%の確認用', qty: 1, unit: '式', unitPrice: 10000, taxRate: 8, priceSource: 'manual' },
]

async function one(status: string, file: string) {
  const pdf = await generateQuotePdf({
    quoteNo: 'Q-202608-0001', title: 'ドヤマーケAI導入 お見積り', status,
    issueDate: new Date('2026-08-08'), expiryDate: new Date('2026-09-07'),
    clientCompany: '株式会社サンプル商事', clientDept: 'マーケティング部', clientPerson: '山田 太郎',
    issuer, lineItems: lineItems as any,
    discountType: 'rate', discountValue: 10,
    paymentTerms: '月末締め翌月末払い（銀行振込）', deliveryTerms: 'ご発注後、約2週間',
    notes: '本見積書の有効期限は発行日より30日間です。',
  })
  fs.writeFileSync(file, pdf)
  console.log(`  ${status.padEnd(10)} -> ${file}  ${(pdf.length / 1024).toFixed(0)}KB`)
  return pdf
}

async function main() {
  const dir = '/private/tmp/claude-501/-Users-mitsumori-katsuki/a56d5a1c-ea7b-43fd-a750-03577391e69e/scratchpad'
  fs.mkdirSync(dir, { recursive: true })
  console.log('=== PDF生成 ===')
  const draft = await one('draft', `${dir}/quote_draft.pdf`)
  const confirmed = await one('confirmed', `${dir}/quote_confirmed.pdf`)
  console.log('\n=== 検査 ===')
  const head = Buffer.from(draft.slice(0, 5)).toString()
  console.log(`  ${head === '%PDF-' ? 'OK  ' : '*** NG'} PDFシグネチャ: ${head}`)
  console.log(`  ${draft.length > confirmed.length ? 'OK  ' : '*** NG'} 下書きの方が大きい（透かし分）: draft ${draft.length} vs confirmed ${confirmed.length}`)
}
main().catch((e) => { console.error('失敗:', e.message); process.exit(1) })
