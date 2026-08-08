import { loadEnv } from './_env'
loadEnv()
import fs from 'fs'
import { renderQuoteHtml } from '../src/lib/quote/pdf'

const issuer = {
  companyName: '株式会社スリスタ', postalCode: '150-0001',
  address: '東京都渋谷区神宮前1-2-3 スリスタビル5F',
  tel: '03-1234-5678', personName: '三森 捷暉', invoiceNo: 'T1234567890123',
}
const lineItems = [
  { itemName: 'ドヤマーケAI プロプラン（月額）', spec: '18種類以上のAI SaaSツール全サービスPRO機能使い放題。個別課金なし。', qty: 6, unit: '月', unitPrice: 9980, taxRate: 10, priceSource: 'own_price' },
  { itemName: '初期導入支援・セットアップ代行', spec: 'アカウント初期設定・各ツール利用設定・社内向け操作レクチャー（オンライン1回）', qty: 1, unit: '式', unitPrice: 0, taxRate: 10, priceSource: 'unknown' },
  { itemName: 'ドヤ記事作成 活用支援（SEO記事制作代行）', spec: 'SEO+LLMO対応の長文記事の制作代行。KW選定・構成・執筆・入稿まで含む。月4本想定。', qty: 24, unit: '本', unitPrice: 55000, taxRate: 10, priceSource: 'market' },
  { itemName: '広告運用代行（リスティング・SNS広告）', spec: '入稿・入札調整・レポーティング・改善提案を含む。広告費別途。', qty: 6, unit: '月', unitPrice: 175000, taxRate: 10, priceSource: 'market' },
  { itemName: 'AIツール活用研修・ワークショップ', spec: '半日〜1日・オンラインまたは対面。', qty: 1, unit: '回', unitPrice: 300000, taxRate: 10, priceSource: 'market' },
  { itemName: '軽減税率対象品目（区分計算の確認用）', spec: '税率8%の行が混ざったときの合計を確認する。', qty: 1, unit: '式', unitPrice: 100000, taxRate: 8, priceSource: 'manual' },
]
const base = {
  quoteNo: 'Q-202608-0001', title: 'ドヤマーケAI導入 お見積り',
  issueDate: new Date('2026-08-08'), expiryDate: new Date('2026-09-07'),
  clientCompany: '株式会社サンプル商事', clientDept: 'マーケティング部', clientPerson: '山田 太郎',
  issuer, lineItems: lineItems as any,
  discountType: 'rate', discountValue: 10,
  paymentTerms: '月末締め翌月末払い（銀行振込）', deliveryTerms: 'ご発注後、約2週間',
  notes: '本見積書の有効期限は発行日より30日間です。',
}
const OUT = '/private/tmp/claude-501/-Users-mitsumori-katsuki/a56d5a1c-ea7b-43fd-a750-03577391e69e/scratchpad'
fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(`${OUT}/quote_draft.html`, renderQuoteHtml({ ...base, status: 'draft' } as any))
fs.writeFileSync(`${OUT}/quote_confirmed.html`, renderQuoteHtml({ ...base, status: 'confirmed' } as any))
console.log('出力:', `${OUT}/quote_draft.html`, '/', `${OUT}/quote_confirmed.html`)
