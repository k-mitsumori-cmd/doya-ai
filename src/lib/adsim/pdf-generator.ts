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
  industryName?: string
  monthlyBudget: number
  periodMonths: number
  mediaAllocation: Record<string, number>
  proposerName?: string | null
  simulation: SimulationResult
  proposal: ProposalSection[]
  // 拡張: LP 詳細
  ogImage?: string | null
  lpAnalysis?: string
  recommendation?: string
  budgetRationale?: string
  cpaRationale?: string
  lpUrl?: string | null
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
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", "Noto Sans JP", "Yu Gothic", sans-serif;
    color: #1f2937;
    margin: 0;
    line-height: 1.85;
    letter-spacing: 0.04em;
    font-size: 10.5pt;
    font-weight: 600;
  }
  /* === 表紙 === */
  .cover {
    page-break-after: always;
    padding: 0;
    background: linear-gradient(135deg, #0017C1 0%, #3460FB 50%, #000060 100%);
    color: white;
    min-height: 96vh;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
    overflow: hidden;
  }
  .cover-bg-orb1 {
    position: absolute;
    top: -120px;
    right: -100px;
    width: 400px;
    height: 400px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%);
  }
  .cover-bg-orb2 {
    position: absolute;
    bottom: -120px;
    left: -80px;
    width: 350px;
    height: 350px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
  }
  .cover-content {
    padding: 60px 50px;
    position: relative;
    z-index: 1;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  ${input.ogImage ? `
  .cover-image {
    width: 100%;
    height: 240px;
    background-image: linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,23,193,0.7) 100%), url('${input.ogImage}');
    background-size: cover;
    background-position: center;
    margin-bottom: 30px;
    border-radius: 16px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.3);
  }` : ''}
  .cover .badge {
    display: inline-block;
    background: rgba(255,255,255,0.18);
    backdrop-filter: blur(10px);
    color: white;
    padding: 8px 18px;
    border-radius: 999px;
    font-size: 10pt;
    font-weight: 800;
    margin-bottom: 24px;
    border: 1px solid rgba(255,255,255,0.3);
    letter-spacing: 0.08em;
  }
  .cover .client {
    font-size: 26pt;
    font-weight: 800;
    margin-bottom: 8px;
    letter-spacing: 0.05em;
  }
  .cover .title {
    font-size: 48pt;
    font-weight: 900;
    margin-bottom: 32px;
    letter-spacing: 0.06em;
    line-height: 1.2;
  }
  .cover .meta {
    font-size: 13pt;
    opacity: 0.95;
    font-weight: 700;
    line-height: 1.8;
  }
  .cover .footer {
    padding: 20px 50px;
    font-size: 10pt;
    opacity: 0.8;
    font-weight: 700;
    border-top: 1px solid rgba(255,255,255,0.2);
    position: relative;
    z-index: 1;
  }

  /* === 内容ページ === */
  .page { padding: 0; }
  h1 {
    font-size: 22pt;
    font-weight: 900;
    color: #0017C1;
    margin: 0 0 8px 0;
    letter-spacing: 0.06em;
    padding-bottom: 12px;
    border-bottom: 4px solid;
    border-image: linear-gradient(90deg, #0017C1, #3460FB, #7096F8) 1;
  }
  h1 .h1-sub {
    display: block;
    font-size: 10pt;
    color: #626264;
    font-weight: 700;
    margin-top: 4px;
    letter-spacing: 0.05em;
  }
  h2 {
    font-size: 14pt;
    font-weight: 900;
    color: #0017C1;
    margin: 28px 0 12px;
    letter-spacing: 0.05em;
  }
  p {
    margin: 0 0 14px;
    font-weight: 600;
    letter-spacing: 0.04em;
    line-height: 1.95;
  }
  strong, b { font-weight: 900; color: #000060; }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
    margin: 22px 0;
  }
  .kpi-card {
    background: linear-gradient(135deg, #F8F8FB 0%, #D9E6FF 100%);
    border-radius: 14px;
    padding: 20px;
    text-align: center;
    border: 1px solid #C5D7FB;
    box-shadow: 0 4px 12px rgba(0,23,193,0.08);
  }
  .kpi-card .label {
    font-size: 9pt;
    color: #626264;
    margin-bottom: 8px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .kpi-card .value {
    font-size: 20pt;
    font-weight: 900;
    color: #0017C1;
    letter-spacing: 0.04em;
  }

  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    margin: 18px 0;
    font-size: 9pt;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 16px rgba(0,23,193,0.1);
  }
  th {
    background: linear-gradient(135deg, #0017C1 0%, #3460FB 100%);
    color: white;
    padding: 12px 10px;
    text-align: left;
    font-weight: 900;
    letter-spacing: 0.05em;
  }
  td {
    border-bottom: 1px solid #E5E7EB;
    padding: 12px 10px;
    font-weight: 700;
    letter-spacing: 0.03em;
  }
  tr:nth-child(even) td { background: #F8F8FB; }
  tr:last-child td { border-bottom: none; }

  .pill {
    display: inline-block;
    background: linear-gradient(135deg, #D9E6FF 0%, #C5D7FB 100%);
    color: #0017C1;
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 9pt;
    font-weight: 900;
    margin-right: 6px;
    margin-bottom: 6px;
    letter-spacing: 0.04em;
    border: 1px solid #7096F8;
  }

  .section {
    page-break-inside: avoid;
    margin-bottom: 28px;
  }
  .highlight-section {
    background: linear-gradient(135deg, #F8F8FB 0%, #D9E6FF 100%);
    border-left: 6px solid #0017C1;
    border-radius: 14px;
    padding: 24px 28px;
    margin: 24px 0;
    box-shadow: 0 4px 16px rgba(0,23,193,0.08);
  }
  .highlight-section h2 { margin-top: 0; }
  .page-break { page-break-before: always; }

  .disclaimer {
    background: linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%);
    border: 1px solid #F59E0B;
    border-radius: 12px;
    padding: 18px 22px;
    font-size: 9pt;
    color: #78350F;
    margin-top: 40px;
    font-weight: 700;
  }
</style>
</head>
<body>

<!-- 表紙 -->
<div class="cover">
  <div class="cover-bg-orb1"></div>
  <div class="cover-bg-orb2"></div>
  <div class="cover-content">
    ${input.ogImage ? `<div class="cover-image"></div>` : ''}
    <div class="badge">AD PROPOSAL · ${escapeHtml(input.industryName || input.industry)}</div>
    <div class="client">${escapeHtml(input.clientName)} 様</div>
    <div class="title">広告運用 提案書</div>
    <div class="meta">
      <strong>${escapeHtml(input.productName)}</strong><br />
      月額 <strong>¥${input.monthlyBudget.toLocaleString()}</strong> × <strong>${input.periodMonths}ヶ月</strong>
      （総額 <strong>¥${(input.monthlyBudget * input.periodMonths).toLocaleString()}</strong>）
    </div>
  </div>
  ${input.proposerName ? `<div class="footer">提案者: <strong>${escapeHtml(input.proposerName)}</strong></div>` : '<div class="footer">&nbsp;</div>'}
</div>

<!-- LP 分析 -->
${input.lpAnalysis ? `
<div class="page">
  <h1>LP 分析<span class="h1-sub">このランディングページから読み取れる強み・訴求点・課題</span></h1>
  <p>${escapeHtml(input.lpAnalysis).replace(/\n/g, '<br />')}</p>
</div>
` : ''}

<!-- このLPから、このような広告運用を行います（重要セクション） -->
${input.recommendation ? `
<div class="highlight-section">
  <h2>このLPから、このような広告運用を行います</h2>
  <p><strong>${escapeHtml(input.recommendation).replace(/\n/g, '<br />')}</strong></p>
</div>
` : ''}

<!-- シミュレーション結果サマリ -->
<div class="page-break"></div>
<h1>シミュレーション結果サマリ<span class="h1-sub">媒体別×月次のパフォーマンス予測</span></h1>
<div style="margin: 14px 0 18px;">${allocationPills}</div>
<div class="kpi-grid">
  <div class="kpi-card"><div class="label">総予算</div><div class="value">¥${overall.totalBudget.toLocaleString()}</div></div>
  <div class="kpi-card"><div class="label">総Impression</div><div class="value">${overall.totalImpression.toLocaleString()}</div></div>
  <div class="kpi-card"><div class="label">総Click</div><div class="value">${overall.totalClick.toLocaleString()}</div></div>
  <div class="kpi-card"><div class="label">総CV</div><div class="value">${overall.totalCv.toLocaleString()}</div></div>
  <div class="kpi-card"><div class="label">平均CPA</div><div class="value">¥${overall.avgCpa.toLocaleString()}</div></div>
  <div class="kpi-card"><div class="label">平均ROAS</div><div class="value">${overall.avgRoas}%</div></div>
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

<!-- 予算配分の根拠 -->
${input.budgetRationale ? `
<div class="section">
  <h2>予算配分の根拠</h2>
  <p>${escapeHtml(input.budgetRationale).replace(/\n/g, '<br />')}</p>
</div>
` : ''}

<!-- CPA・CV の根拠 -->
${input.cpaRationale ? `
<div class="section">
  <h2>平均CPA・CVの根拠</h2>
  <p>${escapeHtml(input.cpaRationale).replace(/\n/g, '<br />')}</p>
</div>
` : ''}

<!-- 提案テキスト10セクション -->
<div class="page-break"></div>
<h1>提案内容<span class="h1-sub">全 10 セクション</span></h1>
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
    // networkidle0 だと OG image 取得失敗時に詰まるので domcontentloaded に
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 })
    // 画像読み込みは最大 5秒だけ待つ
    try {
      await page.evaluate(async () => {
        const imgs = Array.from(document.images)
        await Promise.race([
          Promise.all(imgs.map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r })))),
          new Promise((r) => setTimeout(r, 5000)),
        ])
      })
    } catch {
      // ignore
    }
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
