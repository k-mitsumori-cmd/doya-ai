// ============================================
// PDFに日本語が出るかを実際に生成して確かめる（見積書 / 面接レポート）
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
import { renderHtml as renderMensetsuHtml } from '../src/lib/mensetsu/pdf'

// Lambda用Chromium(Linuxバイナリ)はmacOSで起動できないため、検証はシステムのChromeで行う。
// 見たいのは「同梱フォントだけでレイアウトと日本語が成立するか」なので目的は満たせる。
const LOCAL_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const OUT = path.resolve(__dirname, '../reference/generated-assets/2026-08-31-quote-pdf-check')

/** HTMLをローカルChromeでPDFにし、埋め込みフォントを数えて返す */
async function toPdf(html: string, name: string) {
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
    const file = path.join(OUT, name)
    fs.writeFileSync(file, pdf)
    const buf = Buffer.from(pdf)
    const embedded = (buf.toString('latin1').match(/\/FontFile2|\/FontFile3/g) || []).length
    console.log(`  ✓ ${name}  ${Math.round(buf.length / 1024)}KB / 埋め込みフォント ${embedded}件`)
  } finally {
    await browser.close()
  }
}

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
  await toPdf(html, 'quote.pdf')

  // 面接レポートも同じ不具合を抱えていたので一緒に確認する
  const mensetsuHtml = renderMensetsuHtml({
    companyName: '株式会社スリスタ',
    jobTitle: 'フロントエンドエンジニア',
    levelLabel: '中途・シニア',
    candidateName: '山田 太郎',
    interviewedAt: new Date('2026-08-31'),
    durationMin: 28,
    verdict: 'recommend',
    average: 4.2,
    overallComment: '設計の意図を自分の言葉で説明できており、実務での判断力が確認できました。',
    recruiterReport: '次の面接では、チーム間の調整経験を深掘りすることを推奨します。',
    criteria: [
      { name: '技術的な深さ', description: '実装の裏側を説明できるか', score: 5, insufficient: false, rationale: '状態管理の選定理由を具体例つきで説明。', quotes: ['再描画の範囲を抑えるためにZustandを選びました'] },
      { name: 'コミュニケーション', description: '相手に合わせて説明できるか', score: 4, insufficient: false, rationale: '専門用語を噛み砕いて説明していた。', quotes: [] },
      { name: 'カルチャーフィット', description: null, score: null, insufficient: true, rationale: '判断できる発言が不足。', quotes: [] },
    ],
    turns: [
      { speaker: 'AI面接官', text: '直近で一番難しかった実装を教えてください。' },
      { speaker: '応募者', text: '大量の行を扱う表で、描画が詰まる問題に取り組みました。' },
    ],
    includeTranscript: true,
  })
  fs.writeFileSync(path.join(OUT, 'mensetsu.html'), mensetsuHtml)
  await toPdf(mensetsuHtml, 'mensetsu.pdf')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
