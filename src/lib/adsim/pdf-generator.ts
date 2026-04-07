// ============================================
// PDF生成（Puppeteer HTML → PDF）
// ============================================
// HTMLテンプレートを組み立てて puppeteer-core + @sparticuz/chromium で PDF化する。
// この方式の利点:
// - 日本語が文字化けしない（ヘッドレスChromeが Noto CJK を内蔵）
// - CSS で自由にデザイン調整可能
// - グラフの代わりにCSSで簡易インフォグラフィックが作れる
//
// 既存の banner/from-url route と同じ puppeteer 起動パターンを踏襲。

import { SimulationResult } from './simulator'
import { ProposalSection } from './gemini'

export interface PdfInput {
  clientName: string
  productName: string
  industry: string
  monthlyBudget: number
  periodMonths: number
  mediaAllocation: Record<string, number>
  proposerName?: string | null
  simulation: SimulationResult
  proposal: ProposalSection[]
}

// ----------------------------------------
// HTML テンプレート
// ----------------------------------------
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderHtml(input: PdfInput): string {
  const { simulation, proposal } = input
  const overall = simulation.overall

  const mediaRows = simulation.media
    .map(
      (m) => `
    <tr>
      <td>${escapeHtml(m.mediaName)}</td>
      <td>¥${m.totalBudget.toLocaleString()}</td>
      <td>${m.summary.impression.toLocaleString()}</td>
      <td>${m.summary.click.toLocaleString()}</td>
      <td>${m.summary.cv.toLocaleString()}</td>
      <td>¥${m.summary.avgCpa.toLocaleString()}</td>
      <td>${m.summary.avgRoas}</td>
    </tr>`
    )
    .join('')

  const proposalSections = proposal
    .map(
      (sec) => `
    <section class="section">
      <h2>${escapeHtml(sec.title)}</h2>
      <p>${escapeHtml(sec.content).replace(/\n/g, '<br />')}</p>
    </section>`
    )
    .join('')

  const allocationPills = Object.entries(input.mediaAllocation)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `<span class="pill">${escapeHtml(k)} ${v}%</span>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(input.clientName)} 広告提案書</title>
<style>
  @page { size: A4; margin: 20mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", "Noto Sans JP", "Yu Gothic", sans-serif;
    color: #1f2937;
    margin: 0;
    line-height: 1.7;
    font-size: 11pt;
  }
  .cover {
    page-break-after: always;
    text-align: left;
    padding: 80px 40px;
    background: linear-gradient(135deg, #6366f1 0%, #3b82f6 100%);
    color: white;
    min-height: 90vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .cover .client { font-size: 28pt; font-weight: 700; margin-bottom: 8px; }
  .cover .title { font-size: 42pt; font-weight: 800; margin-bottom: 32px; }
  .cover .meta { font-size: 14pt; opacity: 0.9; }
  .cover .footer { margin-top: 60px; font-size: 11pt; opacity: 0.8; }

  h1 {
    font-size: 20pt;
    color: #6366f1;
    border-bottom: 3px solid #6366f1;
    padding-bottom: 8px;
    margin-top: 0;
  }
  h2 {
    font-size: 15pt;
    color: #6366f1;
    margin-top: 24px;
    margin-bottom: 8px;
  }
  p { margin: 0 0 12px; }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin: 20px 0;
  }
  .kpi-card {
    background: #f3f4f6;
    border-radius: 8px;
    padding: 16px;
    text-align: center;
  }
  .kpi-card .label { font-size: 9pt; color: #6b7280; margin-bottom: 4px; }
  .kpi-card .value { font-size: 18pt; font-weight: 700; color: #6366f1; }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 9pt;
  }
  th {
    background: #6366f1;
    color: white;
    padding: 8px;
    text-align: left;
    font-weight: 600;
  }
  td {
    border-bottom: 1px solid #e5e7eb;
    padding: 8px;
  }
  tr:nth-child(even) td { background: #f9fafb; }

  .pill {
    display: inline-block;
    background: #eef2ff;
    color: #4338ca;
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 9pt;
    margin-right: 4px;
    margin-bottom: 4px;
  }

  .section {
    page-break-inside: avoid;
    margin-bottom: 24px;
  }
  .page-break { page-break-before: always; }

  .disclaimer {
    background: #fffbeb;
    border: 1px solid #fbbf24;
    border-radius: 8px;
    padding: 16px;
    font-size: 9pt;
    color: #78350f;
    margin-top: 40px;
  }
</style>
</head>
<body>

<!-- 表紙 -->
<div class="cover">
  <div class="client">${escapeHtml(input.clientName)} 様</div>
  <div class="title">広告運用 提案書</div>
  <div class="meta">
    ${escapeHtml(input.productName)} / ${escapeHtml(input.industry)}<br />
    月額 ¥${input.monthlyBudget.toLocaleString()} × ${input.periodMonths}ヶ月
  </div>
  ${input.proposerName ? `<div class="footer">提案者: ${escapeHtml(input.proposerName)}</div>` : ''}
</div>

<!-- 提案サマリ -->
<h1>シミュレーション結果サマリ</h1>
<div style="margin: 8px 0 16px;">${allocationPills}</div>
<div class="kpi-grid">
  <div class="kpi-card"><div class="label">総予算</div><div class="value">¥${overall.totalBudget.toLocaleString()}</div></div>
  <div class="kpi-card"><div class="label">総Impression</div><div class="value">${overall.totalImpression.toLocaleString()}</div></div>
  <div class="kpi-card"><div class="label">総Click</div><div class="value">${overall.totalClick.toLocaleString()}</div></div>
  <div class="kpi-card"><div class="label">総CV</div><div class="value">${overall.totalCv.toLocaleString()}</div></div>
  <div class="kpi-card"><div class="label">平均CPA</div><div class="value">¥${overall.avgCpa.toLocaleString()}</div></div>
  <div class="kpi-card"><div class="label">平均ROAS</div><div class="value">${overall.avgRoas}</div></div>
</div>

<h2>媒体別パフォーマンス</h2>
<table>
  <thead>
    <tr>
      <th>媒体</th><th>総予算</th><th>Imp</th><th>Click</th><th>CV</th><th>CPA</th><th>ROAS</th>
    </tr>
  </thead>
  <tbody>${mediaRows}</tbody>
</table>

<!-- 提案テキスト -->
<div class="page-break"></div>
<h1>提案内容</h1>
${proposalSections}

<!-- 免責 -->
<div class="disclaimer">
  <strong>免責事項:</strong><br />
  本資料に記載されたシミュレーション数値は、業界平均ベンチマークおよびAIによる推定値であり、実際の広告運用結果を保証するものではありません。実運用時は媒体のオークション状況、クリエイティブ品質、LPコンバージョン率などにより結果が変動します。
</div>

</body>
</html>`
}

// ----------------------------------------
// Puppeteer で PDF 化
// ----------------------------------------
export async function generatePdfBuffer(input: PdfInput): Promise<Uint8Array> {
  // 動的 import で Edge Runtime でもビルド時エラーを回避
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

  const html = renderHtml(input)

  let browser: any
  try {
    const executablePath = await chromium.executablePath()
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1240, height: 1754 }, // A4 @ 150dpi
      executablePath,
      headless: chromium.headless,
    })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 })
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
    })
    return new Uint8Array(pdfBuffer)
  } finally {
    if (browser) {
      try {
        await browser.close()
      } catch {
        // ignore
      }
    }
  }
}
