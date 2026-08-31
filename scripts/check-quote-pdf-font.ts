// ============================================
// 見積書PDFに日本語が出るかを実際に生成して確かめる
// ============================================
// 本番(Lambda)には日本語フォントが無く、登録を忘れると日本語が全て空白になる。
// ローカルのmacOSはヒラギノがあるため素通りしてしまうので、
// このスクリプトは **フォント解決先をアプリ同梱の1本だけに絞って** 検証する。
//
//   npx tsx scripts/check-quote-pdf-font.ts
//
// 課金APIは呼ばない（Chromiumでレンダリングするだけ）。
import fs from 'fs'
import path from 'path'
import { renderQuoteHtml } from '../src/lib/quote/pdf'

// Lambda用Chromium(Linuxバイナリ)はmacOSで起動できないため、検証はシステムのChromeで行う。
// 見たいのは「同梱フォントだけでレイアウトと日本語が成立するか」なので目的は満たせる。
const LOCAL_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const OUT = path.resolve(__dirname, '../reference/generated-assets/2026-08-31-quote-pdf-check')

async function main() {
  fs.mkdirSync(OUT, { recursive: true })

  const html = renderQuoteHtml({
    quoteNo: 'Q-202608-0002',
    title: 'ドヤマーケAI お見積り',
    status: 'confirmed',
    issueDate: new Date('2026-08-31'),
    expiryDate: new Date('2026-09-30'),
    clientCompany: '株式会社スリスタ',
    clientDept: 'マーケティング部',
    clientPerson: '三森 捷暉',
    issuer: {
      companyName: '株式会社スリスタ',
      postalCode: '150-0001',
      address: '東京都渋谷区神宮前1-2-3 スリスタビル5F',
      tel: '03-1234-5678',
      personName: '営業部 三森',
      invoiceNo: 'T1234567890123',
    },
    lineItems: [
      {
        itemName: 'ドヤマーケAI 統一プラン 6ヶ月',
        spec: '全18サービスのAI SaaSをPROで利用。記事作成・バナー・面接官などを含む。',
        qty: 6, unit: '月', unitPrice: 9980, taxRate: 10, priceSource: 'own_price',
      },
      {
        itemName: 'SEO記事作成 3本×6ヶ月',
        spec: 'SEO+LLMO対応の記事を1本5,000字で納品。',
        qty: 18, unit: '本', unitPrice: 45000, taxRate: 10, priceSource: 'market',
      },
      {
        itemName: '初期設定・オンボーディング',
        spec: '「要見積」の行が合計に入らないことの確認用。',
        qty: 1, unit: '式', unitPrice: 0, taxRate: 10, priceSource: 'unknown',
      },
    ],
    discountType: null,
    discountValue: 0,
    paymentTerms: '月末締め翌月末払い',
    deliveryTerms: 'ご発注後、5営業日以内',
    notes: '本見積の有効期限は発行日から30日間です。',
  })

  fs.writeFileSync(path.join(OUT, 'quote.html'), html)

  const puppeteer = (await import('puppeteer-core')).default
  const browser = await puppeteer.launch({ executablePath: LOCAL_CHROME, headless: true })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'domcontentloaded' })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
    })
    const file = path.join(OUT, 'quote.pdf')
    fs.writeFileSync(file, pdf)
    console.log(`  ✓ ${Math.round(pdf.length / 1024)}KB → ${file}`)
  } finally {
    await browser.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
