// ============================================
// PPTX生成（pptxgenjs）
// ============================================
// 提案書PPTXを生成。テンプレート: simple（12スライド想定）
// 1: 表紙
// 2: 提案サマリ
// 3: 予算・期間・媒体配分
// 4: シミュレーション結果（全体KPI）
// 5: 媒体別サマリ
// 6〜: 提案テキスト10セクション
// 最終: 免責

import PptxGenJS from 'pptxgenjs'
import { SimulationResult } from './simulator'
import { ProposalSection } from './gemini'

export interface PptxInput {
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

const INDIGO = '6366F1'
const BLUE = '3B82F6'
const LIGHT_GRAY = 'F3F4F6'
const DARK = '1F2937'

export async function generatePptxBuffer(input: PptxInput): Promise<Uint8Array> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE' // 13.33 x 7.5 inch
  pptx.author = 'ドヤ広告シミュレーションAI'
  pptx.company = input.proposerName || ''
  pptx.title = `${input.clientName} 広告提案書`

  // --- Slide 1: 表紙 ---
  {
    const s = pptx.addSlide()
    s.background = { color: INDIGO }
    s.addText(`${input.clientName}`, {
      x: 0.7, y: 2.3, w: 12, h: 0.8,
      fontSize: 36, bold: true, color: 'FFFFFF', fontFace: 'Yu Gothic',
    })
    s.addText('広告運用 提案書', {
      x: 0.7, y: 3.1, w: 12, h: 1,
      fontSize: 48, bold: true, color: 'FFFFFF', fontFace: 'Yu Gothic',
    })
    s.addText(`${input.productName}  /  ${input.industry}`, {
      x: 0.7, y: 4.5, w: 12, h: 0.5,
      fontSize: 20, color: 'E0E7FF', fontFace: 'Yu Gothic',
    })
    if (input.proposerName) {
      s.addText(`提案者: ${input.proposerName}`, {
        x: 0.7, y: 6.5, w: 12, h: 0.4,
        fontSize: 14, color: 'E0E7FF', fontFace: 'Yu Gothic',
      })
    }
  }

  // --- Slide 2: 提案サマリ ---
  {
    const s = pptx.addSlide()
    addTitle(s, '提案サマリ')
    const summary = input.proposal.find((p) => p.key === 'summary')?.content || ''
    s.addText(summary, {
      x: 0.7, y: 1.3, w: 12, h: 5,
      fontSize: 16, color: DARK, fontFace: 'Yu Gothic', valign: 'top',
    })
  }

  // --- Slide 3: 予算・期間・媒体配分 ---
  {
    const s = pptx.addSlide()
    addTitle(s, '予算・期間・媒体配分')
    s.addText(
      [
        { text: '月額予算\n', options: { fontSize: 14, color: '6B7280', bold: true } },
        { text: `¥${input.monthlyBudget.toLocaleString()}\n\n`, options: { fontSize: 28, color: INDIGO, bold: true } },
        { text: '期間\n', options: { fontSize: 14, color: '6B7280', bold: true } },
        { text: `${input.periodMonths}ヶ月\n\n`, options: { fontSize: 28, color: INDIGO, bold: true } },
        { text: '総予算\n', options: { fontSize: 14, color: '6B7280', bold: true } },
        { text: `¥${input.simulation.overall.totalBudget.toLocaleString()}`, options: { fontSize: 28, color: INDIGO, bold: true } },
      ],
      { x: 0.7, y: 1.3, w: 5, h: 5, fontFace: 'Yu Gothic' }
    )
    // 媒体配分テーブル
    s.addTable(
      [
        [
          { text: '媒体', options: { bold: true, color: 'FFFFFF', fill: { color: INDIGO } } },
          { text: '配分', options: { bold: true, color: 'FFFFFF', fill: { color: INDIGO } } },
        ],
        ...Object.entries(input.mediaAllocation).map(([k, v]) => [
          { text: k, options: { fontFace: 'Yu Gothic' } },
          { text: `${v}%`, options: { fontFace: 'Yu Gothic' } },
        ]),
      ],
      { x: 6.5, y: 1.3, w: 6, fontSize: 14 }
    )
  }

  // --- Slide 4: KPIサマリ ---
  {
    const s = pptx.addSlide()
    addTitle(s, 'シミュレーション結果（全体）')
    const overall = input.simulation.overall
    const kpis: [string, string][] = [
      ['総Impression', overall.totalImpression.toLocaleString()],
      ['総Click', overall.totalClick.toLocaleString()],
      ['総CV', overall.totalCv.toLocaleString()],
      ['平均CPA', `¥${overall.avgCpa.toLocaleString()}`],
      ['平均ROAS', String(overall.avgRoas)],
      ['総予算', `¥${overall.totalBudget.toLocaleString()}`],
    ]
    kpis.forEach(([label, value], i) => {
      const col = i % 3
      const row = Math.floor(i / 3)
      const x = 0.7 + col * 4.3
      const y = 1.5 + row * 2.3
      s.addShape('rect' as any, {
        x, y, w: 4, h: 2,
        fill: { color: LIGHT_GRAY },
        line: { color: LIGHT_GRAY },
      })
      s.addText(label, {
        x, y: y + 0.2, w: 4, h: 0.4,
        fontSize: 14, color: '6B7280', align: 'center', fontFace: 'Yu Gothic',
      })
      s.addText(value, {
        x, y: y + 0.7, w: 4, h: 1,
        fontSize: 28, bold: true, color: INDIGO, align: 'center', fontFace: 'Yu Gothic',
      })
    })
  }

  // --- Slide 5: 媒体別サマリ ---
  {
    const s = pptx.addSlide()
    addTitle(s, '媒体別パフォーマンス')
    const rows: any[] = [
      ['媒体', '総予算', 'Imp', 'Click', 'CV', 'CPA', 'ROAS'].map((h) => ({
        text: h,
        options: { bold: true, color: 'FFFFFF', fill: { color: INDIGO }, fontFace: 'Yu Gothic' },
      })),
    ]
    for (const m of input.simulation.media) {
      rows.push([
        { text: m.mediaName, options: { fontFace: 'Yu Gothic' } },
        { text: `¥${m.totalBudget.toLocaleString()}`, options: { fontFace: 'Yu Gothic' } },
        { text: m.summary.impression.toLocaleString(), options: { fontFace: 'Yu Gothic' } },
        { text: m.summary.click.toLocaleString(), options: { fontFace: 'Yu Gothic' } },
        { text: m.summary.cv.toLocaleString(), options: { fontFace: 'Yu Gothic' } },
        { text: `¥${m.summary.avgCpa.toLocaleString()}`, options: { fontFace: 'Yu Gothic' } },
        { text: String(m.summary.avgRoas), options: { fontFace: 'Yu Gothic' } },
      ])
    }
    s.addTable(rows, { x: 0.7, y: 1.5, w: 12, fontSize: 14 })
  }

  // --- Slides 6〜: 提案テキスト各セクション ---
  for (const sec of input.proposal) {
    if (sec.key === 'summary') continue // サマリは既に出力済み
    const s = pptx.addSlide()
    addTitle(s, sec.title)
    s.addText(sec.content, {
      x: 0.7, y: 1.3, w: 12, h: 5.5,
      fontSize: 14, color: DARK, fontFace: 'Yu Gothic', valign: 'top',
    })
  }

  // --- 最終スライド: 免責 ---
  {
    const s = pptx.addSlide()
    s.background = { color: LIGHT_GRAY }
    s.addText('免責事項', {
      x: 0.7, y: 0.5, w: 12, h: 0.6,
      fontSize: 24, bold: true, color: DARK, fontFace: 'Yu Gothic',
    })
    s.addText(
      '本資料に記載されたシミュレーション数値は、業界平均ベンチマークおよびAIによる推定値であり、' +
      '実際の広告運用結果を保証するものではありません。実運用時は媒体のオークション状況、' +
      'クリエイティブ品質、LPコンバージョン率などにより結果が変動します。',
      { x: 0.7, y: 1.5, w: 12, h: 3, fontSize: 14, color: DARK, fontFace: 'Yu Gothic' }
    )
    s.addText('ドヤ広告シミュレーションAI', {
      x: 0.7, y: 6.5, w: 12, h: 0.4,
      fontSize: 10, color: '9CA3AF', align: 'right', fontFace: 'Yu Gothic',
    })
  }

  // pptxgenjs writeFile は node 環境で Uint8Array を返す設定が必要
  const buf = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer
  return new Uint8Array(buf)
}

function addTitle(slide: any, title: string) {
  slide.addShape('rect' as any, {
    x: 0, y: 0, w: 13.33, h: 0.9,
    fill: { color: INDIGO },
    line: { color: INDIGO },
  })
  slide.addText(title, {
    x: 0.5, y: 0.15, w: 12, h: 0.6,
    fontSize: 24, bold: true, color: 'FFFFFF', fontFace: 'Yu Gothic',
  })
}
