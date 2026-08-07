// ============================================
// ドヤ面接官 評価レポートPDF（F2-5）
// ============================================
// puppeteer-core + @sparticuz/chromium で HTML → PDF。
// ヘッドレスChromeが Noto CJK を内蔵しているため日本語が文字化けしない。
// jsPDF 単体はフォント埋め込みが必要になるため、文書PDFには使わない。
// 起動パターンは src/lib/adsim/pdf-generator.ts を踏襲。

import { VERDICT_LABELS, type Verdict } from './types'

export interface ReportPdfInput {
  companyName: string
  jobTitle: string
  levelLabel: string
  candidateName: string | null
  interviewedAt: Date | null
  durationMin: number
  verdict: Verdict | null
  average: number | null
  overallComment: string | null
  recruiterReport: string | null
  criteria: Array<{
    name: string
    description: string | null
    score: number | null
    insufficient: boolean
    rationale: string | null
    quotes: string[]
  }>
  turns: Array<{ speaker: string; text: string }>
  /** 逐語ログを載せるか（機微なので既定は載せない） */
  includeTranscript: boolean
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

const VERDICT_COLOR: Record<string, string> = {
  recommend: '#137333',
  conditional: '#a06800',
  hold: '#3c4043',
  reject: '#c5221f',
}

function renderHtml(d: ReportPdfInput): string {
  const dateStr = d.interviewedAt
    ? new Intl.DateTimeFormat('ja-JP', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Tokyo' }).format(
        d.interviewedAt
      )
    : '未実施'

  const criteriaHtml = d.criteria
    .map(
      (c) => `
      <div class="criterion">
        <div class="crit-head">
          <div>
            <p class="crit-name">${esc(c.name)}</p>
            ${c.description ? `<p class="crit-desc">${esc(c.description)}</p>` : ''}
          </div>
          <div class="crit-score">${
            c.insufficient || c.score == null ? '<span class="insufficient">情報不足</span>' : `${c.score}<span class="of">/5</span>`
          }</div>
        </div>
        ${c.rationale ? `<p class="crit-rationale">${nl2br(c.rationale)}</p>` : ''}
        ${
          c.quotes.length > 0
            ? `<ul class="quotes">${c.quotes.map((q) => `<li>「${esc(q)}」</li>`).join('')}</ul>`
            : ''
        }
      </div>`
    )
    .join('')

  const transcriptHtml = d.includeTranscript
    ? `<section class="page-break">
         <h2>逐語ログ</h2>
         ${d.turns
           .map(
             (t) =>
               `<p class="turn"><span class="${t.speaker === 'interviewer' ? 'sp-i' : 'sp-c'}">${
                 t.speaker === 'interviewer' ? '面接官' : '応募者'
               }：</span>${esc(t.text)}</p>`
           )
           .join('')}
       </section>`
    : ''

  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Noto Sans JP", "Hiragino Sans", sans-serif; color: #0a0f3c; }
  .sheet { padding: 18mm 16mm; }
  h1 { font-size: 20pt; margin: 0 0 2mm; letter-spacing: -0.01em; }
  h2 { font-size: 12pt; margin: 8mm 0 3mm; padding-bottom: 2mm; border-bottom: 2px solid #0066ff; }
  .brand { font-size: 8pt; font-weight: 700; color: #0066ff; letter-spacing: .08em; }
  .meta { font-size: 9pt; color: #425071; line-height: 1.8; margin: 0 0 6mm; }
  .notice { background: #fff8e1; border: 1px solid #ffe0b2; padding: 4mm; border-radius: 2mm;
            font-size: 8.5pt; line-height: 1.7; color: #7a5200; margin-bottom: 6mm; }
  .notice strong { font-weight: 700; }
  .summary { display: flex; align-items: center; gap: 6mm; padding: 5mm;
             background: #f5f8ff; border-radius: 2mm; margin-bottom: 4mm; }
  .verdict { font-size: 16pt; font-weight: 700; }
  .avg { font-size: 10pt; color: #425071; }
  .overall { font-size: 9.5pt; line-height: 1.85; color: #29334f; margin: 0; }
  .criterion { border: 1px solid #e6edfb; border-radius: 2mm; padding: 4mm; margin-bottom: 3mm;
               page-break-inside: avoid; }
  .crit-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 4mm; }
  .crit-name { font-size: 10pt; font-weight: 700; margin: 0; }
  .crit-desc { font-size: 8pt; color: #6b7794; margin: 1mm 0 0; }
  .crit-score { font-size: 18pt; font-weight: 700; color: #0066ff; white-space: nowrap; }
  .crit-score .of { font-size: 9pt; color: #8a94ad; margin-left: 1mm; }
  .insufficient { font-size: 9pt; font-weight: 700; color: #8a94ad; }
  .crit-rationale { font-size: 9pt; line-height: 1.8; color: #29334f; margin: 3mm 0 0; }
  .quotes { margin: 3mm 0 0; padding: 0; list-style: none; }
  .quotes li { font-size: 8.5pt; line-height: 1.7; color: #0a0f3c; background: #f7faff;
               border-left: 2px solid #cfe3ff; padding: 2mm 3mm; margin-bottom: 1.5mm; }
  .report { font-size: 9.5pt; line-height: 1.85; color: #29334f; white-space: pre-wrap; }
  .page-break { page-break-before: always; }
  .turn { font-size: 8.5pt; line-height: 1.75; margin: 0 0 2mm; color: #29334f; }
  .sp-i { font-weight: 700; color: #0066ff; }
  .sp-c { font-weight: 700; color: #0a0f3c; }
  footer { margin-top: 8mm; padding-top: 3mm; border-top: 1px solid #e6edfb;
           font-size: 7.5pt; color: #8a94ad; line-height: 1.7; }
</style></head>
<body><div class="sheet">
  <p class="brand">MENSETSU REPORT</p>
  <h1>面接評価レポート</h1>
  <p class="meta">
    ${esc(d.companyName)}　/　${esc(d.jobTitle)}（${esc(d.levelLabel)}）<br>
    応募者: ${esc(d.candidateName || '（名前未入力）')}　/　実施: ${esc(dateStr)}　/　想定${d.durationMin}分
  </p>

  <div class="notice">
    本レポートの判定は<strong>AIによる推薦度</strong>であり、合否ではありません。
    AIの評価のみで不合格を確定させず、必ず採用担当者が内容を確認したうえで判断してください。
    また、本人に責任のない事項・本来自由であるべき事項は評価に用いていません。
  </div>

  ${
    d.verdict
      ? `<div class="summary">
           <span class="verdict" style="color:${VERDICT_COLOR[d.verdict] || '#3c4043'}">${esc(
            VERDICT_LABELS[d.verdict] || d.verdict
          )}</span>
           ${d.average != null ? `<span class="avg">平均スコア ${d.average} / 5</span>` : ''}
         </div>`
      : ''
  }
  ${d.overallComment ? `<p class="overall">${nl2br(d.overallComment)}</p>` : ''}

  <h2>評価軸ごとの結果</h2>
  ${criteriaHtml || '<p class="overall">評価がまだ実行されていません。</p>'}

  ${d.recruiterReport ? `<h2>採用担当者向け所見</h2><p class="report">${nl2br(d.recruiterReport)}</p>` : ''}

  ${transcriptHtml}

  <footer>
    このレポートはドヤ面接官（doya-ai.surisuta.jp/mensetsu）が自動生成しました。<br>
    応募者の個人データは組織設定の保持期間を過ぎると自動的に削除されます。
  </footer>
</div></body></html>`
}

export async function generateReportPdf(input: ReportPdfInput): Promise<Uint8Array> {
  // 動的 import（ビルド時のバンドル肥大とEdge Runtimeでのエラーを避ける）
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
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1240, height: 1754 }, // A4 @150dpi
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
