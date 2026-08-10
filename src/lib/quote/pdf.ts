// ============================================
// ドヤ見積もりAI 見積書PDF
// ============================================
// puppeteer-core + @sparticuz/chromium で HTML → PDF。
// ヘッドレスChromeが Noto CJK を内蔵しているため日本語が文字化けしない。
// 起動パターンは src/lib/mensetsu/pdf.ts / adsim/pdf-generator.ts を踏襲。
//
// ⚠️ 商談の場でそのまま相手に渡る紙。以下は仕様上の必須要件:
//   - status が draft のものには「社内確認用」の透かしを必ず入れる
//     （AIが出した金額を確認前に客先へ出させないための最後の砦）
//   - 金額が未確定の行は「要見積」と印字し、0円と誤解させない

import { billableLines, calcTotals, isBillableLine } from './money'

export interface QuotePdfInput {
  quoteNo: string
  title: string
  status: string
  issueDate: Date
  expiryDate: Date
  clientCompany: string | null
  clientDept: string | null
  clientPerson: string | null
  issuer: {
    companyName: string
    postalCode: string | null
    address: string | null
    tel: string | null
    personName: string | null
    invoiceNo: string | null
  }
  lineItems: Array<{
    itemName: string
    spec: string | null
    qty: number
    unit: string
    unitPrice: number
    taxRate: number
    priceSource: string
  }>
  discountType: string | null
  discountValue: number
  paymentTerms: string | null
  deliveryTerms: string | null
  notes: string | null
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function nl2br(s: unknown): string {
  return esc(s).replace(/\n/g, '<br>')
}

function yen(n: number): string {
  return `¥${Math.round(n).toLocaleString('ja-JP')}`
}

function jpDate(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

/**
 * 見積書のHTMLを組み立てる。
 * ⚠️ export しているのは、PDF化そのものが Vercel（Linux）でしか動かず、
 *    レイアウトの確認を手元で行えるようにするため。
 */
export function renderQuoteHtml(q: QuotePdfInput): string {
  // ⚠️ 合計は必ず billableLines を通す。ここで全行を渡していたため、
  //    「要見積」と印字した行の金額がPDFの総額にだけ加算され、
  //    顧客に届く見積書の合計が画面ともDBとも食い違っていた。
  const totals = calcTotals(
    billableLines(q.lineItems).map((l) => ({ qty: l.qty, unitPrice: l.unitPrice, taxRate: l.taxRate })),
    q.discountType,
    q.discountValue
  )

  const rows = q.lineItems
    .map((l) => {
      // 根拠が無い行は 0円ではなく「要見積」として出す。
      // 0円と印字すると無償提供の意思表示に読めてしまう。
      // ⚠️ 合計に含めるかの判定と必ず同じ関数を使う（ズレると印字と総額が矛盾する）
      const undecided = !isBillableLine(l)
      const amount = l.qty * l.unitPrice
      return `<tr>
        <td class="name">${esc(l.itemName)}${l.spec ? `<div class="spec">${nl2br(l.spec)}</div>` : ''}</td>
        <td class="num">${esc(l.qty)}</td>
        <td class="unit">${esc(l.unit)}</td>
        <td class="num">${undecided ? '<span class="tbd">要見積</span>' : yen(l.unitPrice)}</td>
        <td class="num">${undecided ? '<span class="tbd">要見積</span>' : yen(amount)}</td>
      </tr>`
    })
    .join('')

  const taxRows = Object.entries(totals.taxByRate)
    .map(([rate, tax]) => `<tr><th>消費税（${rate}%）</th><td>${yen(tax)}</td></tr>`)
    .join('')

  const isDraft = q.status === 'draft'

  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: "Noto Sans JP", "Hiragino Sans", sans-serif; color: #16233d; font-size: 10.5pt; }
  .page { position: relative; width: 210mm; min-height: 297mm; padding: 16mm 15mm; }
  /* ⚠️ position:fixed はビューポート（1240px）基準になり、A4紙面（210mm≒794px）の
     中央からずれて右へはみ出す。紙面（.page は position:relative）の中に
     absolute で置き、紙の幅を基準に中央へ寄せる。
     絶対配置なので1ページ目にのみ出るが、合計金額が載るのは1ページ目であり、
     画面側にも下書きの警告を出しているため実用上はこれで足りる。 */
  .watermark { position: absolute; top: 42%; left: 0; width: 100%; text-align: center;
    font-size: 64pt; font-weight: 800; color: rgba(255,30,114,0.10);
    transform: rotate(-24deg); letter-spacing: 0.1em; pointer-events: none; z-index: 0; }
  .inner { position: relative; z-index: 1; }
  h1 { font-size: 22pt; letter-spacing: 0.28em; text-align: center; margin: 0 0 10mm; font-weight: 700; }
  .head { display: flex; justify-content: space-between; gap: 12mm; margin-bottom: 8mm; }
  .to { flex: 1; }
  .to .company { font-size: 14pt; font-weight: 700; border-bottom: 1.5px solid #16233d; padding-bottom: 2mm; }
  .to .meta { font-size: 9.5pt; color: #5a678a; margin-top: 2mm; line-height: 1.7; }
  .from { width: 62mm; font-size: 9.5pt; line-height: 1.7; }
  .from .company { font-weight: 700; font-size: 11pt; }
  .from .row { color: #5a678a; }
  .dates { font-size: 9.5pt; color: #5a678a; text-align: right; margin-bottom: 3mm; line-height: 1.7; }
  .total-box { background: #f2f6ff; border: 1.5px solid #0066ff; border-radius: 3mm;
    padding: 5mm 6mm; margin-bottom: 7mm; display: flex; align-items: baseline; justify-content: space-between; }
  .total-box .label { font-size: 11pt; font-weight: 700; }
  .total-box .value { font-size: 20pt; font-weight: 800; color: #0066ff; }
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 6mm; }
  table.items th { background: #16233d; color: #fff; font-size: 9.5pt; font-weight: 600; padding: 2.5mm 3mm; text-align: left; }
  table.items td { border-bottom: 1px solid #dbe3f2; padding: 3mm; vertical-align: top; font-size: 10pt; }
  table.items td.num { text-align: right; white-space: nowrap; }
  table.items td.unit { text-align: center; white-space: nowrap; color: #5a678a; }
  table.items .spec { font-size: 8.5pt; color: #5a678a; margin-top: 1mm; line-height: 1.6; }
  .tbd { color: #ff1e72; font-weight: 600; }
  .summary { width: 78mm; margin-left: auto; }
  .summary table { width: 100%; border-collapse: collapse; }
  .summary th { text-align: left; padding: 2mm 3mm; font-size: 9.5pt; font-weight: 500; color: #5a678a; }
  .summary td { text-align: right; padding: 2mm 3mm; font-size: 10pt; white-space: nowrap; }
  .summary tr.grand th, .summary tr.grand td { border-top: 1.5px solid #16233d; font-weight: 800; font-size: 12pt; color: #16233d; padding-top: 3mm; }
  .notes { margin-top: 8mm; border-top: 1px solid #dbe3f2; padding-top: 4mm; font-size: 9.5pt; line-height: 1.8; }
  .notes h2 { font-size: 10pt; margin: 0 0 1.5mm; color: #5a678a; font-weight: 600; }
  .notes .block { margin-bottom: 4mm; }
  .foot { margin-top: 10mm; text-align: center; font-size: 8pt; color: #9aa7c2; }
</style></head><body>
<div class="page">
  ${isDraft ? '<div class="watermark">社内確認用</div>' : ''}
  <div class="inner">
    <h1>御 見 積 書</h1>

    <div class="dates">
      見積番号: ${esc(q.quoteNo)}<br>
      発行日: ${jpDate(q.issueDate)}<br>
      有効期限: ${jpDate(q.expiryDate)}
    </div>

    <div class="head">
      <div class="to">
        <div class="company">${esc(q.clientCompany || '')} 御中</div>
        <div class="meta">
          ${q.clientDept ? esc(q.clientDept) + '<br>' : ''}
          ${q.clientPerson ? esc(q.clientPerson) + ' 様<br>' : ''}
          下記のとおりお見積り申し上げます。
        </div>
      </div>
      <div class="from">
        <div class="company">${esc(q.issuer.companyName)}</div>
        ${q.issuer.postalCode ? `<div class="row">〒${esc(q.issuer.postalCode)}</div>` : ''}
        ${q.issuer.address ? `<div class="row">${esc(q.issuer.address)}</div>` : ''}
        ${q.issuer.tel ? `<div class="row">TEL: ${esc(q.issuer.tel)}</div>` : ''}
        ${q.issuer.personName ? `<div class="row">担当: ${esc(q.issuer.personName)}</div>` : ''}
        ${q.issuer.invoiceNo ? `<div class="row">登録番号: ${esc(q.issuer.invoiceNo)}</div>` : ''}
      </div>
    </div>

    <div class="total-box">
      <span class="label">御見積金額（税込）</span>
      <span class="value">${yen(totals.totalInclTax)}</span>
    </div>

    <table class="items">
      <thead><tr>
        <th style="width:52%">品目</th><th style="width:9%">数量</th>
        <th style="width:11%">単位</th><th style="width:14%">単価</th><th style="width:14%">金額</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="summary"><table>
      <tr><th>小計</th><td>${yen(totals.totalExclTax + totals.discountAmount)}</td></tr>
      ${totals.discountAmount > 0 ? `<tr><th>値引き</th><td>-${yen(totals.discountAmount)}</td></tr>` : ''}
      <tr><th>税抜合計</th><td>${yen(totals.totalExclTax)}</td></tr>
      ${taxRows}
      <tr class="grand"><th>合計</th><td>${yen(totals.totalInclTax)}</td></tr>
    </table></div>

    <div class="notes">
      ${q.deliveryTerms ? `<div class="block"><h2>納期</h2>${nl2br(q.deliveryTerms)}</div>` : ''}
      ${q.paymentTerms ? `<div class="block"><h2>お支払い条件</h2>${nl2br(q.paymentTerms)}</div>` : ''}
      ${q.notes ? `<div class="block"><h2>備考</h2>${nl2br(q.notes)}</div>` : ''}
      ${
        q.lineItems.some((l) => !isBillableLine(l))
          ? '<div class="block"><h2>ご注意</h2>「要見積」と記載の項目は、要件確定後に別途お見積りいたします。上記合計には含まれておりません。</div>'
          : ''
      }
    </div>

    <div class="foot">${esc(q.title)}</div>
  </div>
</div>
</body></html>`
}

export async function generateQuotePdf(input: QuotePdfInput): Promise<Uint8Array> {
  let puppeteer: any
  let chromium: any
  try {
    const p = await import('puppeteer-core')
    puppeteer = (p as any).default || p
    const c = await import('@sparticuz/chromium')
    chromium = (c as any).default || c
  } catch (err) {
    throw new Error(`puppeteer 初期化失敗: ${err instanceof Error ? err.message : String(err)}`)
  }

  const html = renderQuoteHtml(input)

  let browser: any
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1240, height: 1754 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
    })
    return new Uint8Array(pdf)
  } finally {
    if (browser) {
      try {
        await browser.close()
      } catch {
        /* ignore */
      }
    }
  }
}
