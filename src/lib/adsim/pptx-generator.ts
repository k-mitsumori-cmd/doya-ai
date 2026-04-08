// ============================================
// PPTX生成（pptxgenjs）- リッチデザイン版
// ============================================
// デジタル庁公式 Blue カラーパレット準拠の提案書 PPTX
// 構成:
// 1: 表紙
// 2: 提案サマリ（数値ハイライト）
// 3: LP 分析
// 4: このLPからこのような広告運用を行います
// 5: シミュレーション結果（全体KPI）
// 6: 媒体別パフォーマンス
// 7: 予算配分の根拠
// 8: CPA / CV の根拠
// 9〜: 提案文10セクション
// 最終: 免責

import PptxGenJS from 'pptxgenjs'
import { SimulationResult } from './simulator'
import { ProposalSection } from './gemini'

export interface PptxInput {
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
  lpAnalysis?: string
  recommendation?: string
  budgetRationale?: string
  cpaRationale?: string
}

// デジタル庁公式 Blue カラーパレット
const BLUE_900 = '0017C1'
const BLUE_1200 = '000060'
const BLUE_600 = '3460FB'
const BLUE_400 = '7096F8'
const BLUE_200 = 'C5D7FB'
const BLUE_50 = 'D9E6FF'
const STANDARD_BG = 'F8F8FB'
const DARK = '1F2937'
const LABEL = '626264'
const WHITE = 'FFFFFF'

const FONT = 'Yu Gothic'

export async function generatePptxBuffer(input: PptxInput): Promise<Uint8Array> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE' // 13.33 x 7.5 inch
  pptx.author = 'ドヤ広告シミュレーションAI'
  pptx.company = input.proposerName || ''
  pptx.title = `${input.clientName} 広告提案書`

  const totalBudget = input.monthlyBudget * input.periodMonths
  const overall = input.simulation.overall
  const industryLabel = input.industryName || input.industry

  // ============================================
  // SLIDE 1: 表紙
  // ============================================
  {
    const s = pptx.addSlide()
    s.background = { color: BLUE_1200 }

    // グラデーション風の重なる円
    s.addShape('ellipse' as any, {
      x: 9, y: -2, w: 8, h: 8,
      fill: { color: BLUE_600, transparency: 70 },
      line: { color: BLUE_600, transparency: 100 },
    })
    s.addShape('ellipse' as any, {
      x: -3, y: 4, w: 7, h: 7,
      fill: { color: BLUE_900, transparency: 60 },
      line: { color: BLUE_900, transparency: 100 },
    })

    // バッジ
    s.addShape('roundRect' as any, {
      x: 0.7, y: 0.7, w: 3.5, h: 0.5,
      fill: { color: WHITE, transparency: 80 },
      line: { color: WHITE, transparency: 70 },
      rectRadius: 0.25,
    })
    s.addText(`AD PROPOSAL · ${industryLabel}`, {
      x: 0.7, y: 0.7, w: 3.5, h: 0.5,
      fontSize: 11, bold: true, color: WHITE, fontFace: FONT, align: 'center',
    })

    // クライアント名
    s.addText(`${input.clientName} 様`, {
      x: 0.7, y: 1.8, w: 12, h: 0.8,
      fontSize: 28, bold: true, color: WHITE, fontFace: FONT,
    })

    // 大タイトル
    s.addText('広告運用 提案書', {
      x: 0.7, y: 2.7, w: 12, h: 1.3,
      fontSize: 56, bold: true, color: WHITE, fontFace: FONT,
    })

    // メタ情報ボックス
    s.addShape('roundRect' as any, {
      x: 0.7, y: 4.5, w: 7.5, h: 1.7,
      fill: { color: WHITE, transparency: 90 },
      line: { color: WHITE, transparency: 70 },
      rectRadius: 0.15,
    })
    s.addText(
      [
        { text: '商材: ', options: { fontSize: 12, color: BLUE_50, bold: true } },
        { text: `${input.productName}\n`, options: { fontSize: 14, color: WHITE, bold: true } },
        { text: '業種: ', options: { fontSize: 12, color: BLUE_50, bold: true } },
        { text: `${industryLabel}\n`, options: { fontSize: 14, color: WHITE, bold: true } },
        { text: '予算: ', options: { fontSize: 12, color: BLUE_50, bold: true } },
        {
          text: `月額 ¥${input.monthlyBudget.toLocaleString()} × ${input.periodMonths}ヶ月（総額 ¥${totalBudget.toLocaleString()}）`,
          options: { fontSize: 14, color: WHITE, bold: true },
        },
      ],
      { x: 0.95, y: 4.65, w: 7.2, h: 1.5, fontFace: FONT, valign: 'top' }
    )

    // 提案者
    if (input.proposerName) {
      s.addText(`提案者: ${input.proposerName}`, {
        x: 0.7, y: 6.7, w: 12, h: 0.4,
        fontSize: 12, color: BLUE_50, bold: true, fontFace: FONT,
      })
    }
  }

  // ============================================
  // SLIDE 2: 提案サマリ（数値ハイライト）
  // ============================================
  {
    const s = pptx.addSlide()
    s.background = { color: STANDARD_BG }
    addHeader(s, '提案サマリ', '数値で見る具体的な広告運用提案')

    // 6つの数値カード（2行3列）
    const stats = [
      { label: '月額予算', value: `¥${(input.monthlyBudget / 10000).toLocaleString()}万`, sub: `${input.periodMonths}ヶ月運用` },
      { label: '総予算', value: `¥${(totalBudget / 10000).toLocaleString()}万`, sub: '期間トータル' },
      { label: '想定CV数', value: overall.totalCv.toLocaleString(), sub: '件 / 期間中' },
      { label: '平均CPA', value: `¥${overall.avgCpa.toLocaleString()}`, sub: '1CVあたり', highlight: true },
      { label: '想定ROAS', value: `${overall.avgRoas}%`, sub: '費用対効果', highlight: true },
      { label: '月間Click', value: Math.round(overall.totalClick / input.periodMonths).toLocaleString(), sub: '平均クリック数' },
    ]

    stats.forEach((stat, i) => {
      const col = i % 3
      const row = Math.floor(i / 3)
      const x = 0.6 + col * 4.2
      const y = 1.8 + row * 2.0
      const w = 4.0
      const h = 1.7

      if (stat.highlight) {
        s.addShape('roundRect' as any, {
          x, y, w, h,
          fill: { color: BLUE_900 },
          line: { color: BLUE_900 },
          rectRadius: 0.12,
        })
      } else {
        s.addShape('roundRect' as any, {
          x, y, w, h,
          fill: { color: WHITE },
          line: { color: BLUE_200 },
          rectRadius: 0.12,
        })
      }

      s.addText(stat.label, {
        x: x + 0.2, y: y + 0.2, w: w - 0.4, h: 0.3,
        fontSize: 10, bold: true, color: stat.highlight ? BLUE_50 : LABEL, fontFace: FONT,
      })
      s.addText(stat.value, {
        x: x + 0.2, y: y + 0.55, w: w - 0.4, h: 0.7,
        fontSize: 26, bold: true, color: stat.highlight ? WHITE : BLUE_900, fontFace: FONT,
      })
      s.addText(stat.sub, {
        x: x + 0.2, y: y + 1.25, w: w - 0.4, h: 0.3,
        fontSize: 9, bold: true, color: stat.highlight ? BLUE_50 : LABEL, fontFace: FONT,
      })
    })
  }

  // ============================================
  // SLIDE 3: LP 分析
  // ============================================
  if (input.lpAnalysis) {
    const s = pptx.addSlide()
    s.background = { color: STANDARD_BG }
    addHeader(s, 'LP 分析', 'このランディングページから読み取れる強み・訴求点・課題')
    s.addText(input.lpAnalysis, {
      x: 0.7, y: 1.7, w: 12, h: 5.3,
      fontSize: 14, color: DARK, bold: false, fontFace: FONT, valign: 'top',
      paraSpaceAfter: 6,
    })
  }

  // ============================================
  // SLIDE 4: このLPから、このような広告運用を行います（重要）
  // ============================================
  if (input.recommendation) {
    const s = pptx.addSlide()
    s.background = { color: BLUE_900 }

    s.addShape('ellipse' as any, {
      x: 10, y: -2, w: 6, h: 6,
      fill: { color: BLUE_600, transparency: 70 },
      line: { color: BLUE_600, transparency: 100 },
    })

    s.addShape('roundRect' as any, {
      x: 0.7, y: 0.5, w: 4, h: 0.5,
      fill: { color: WHITE, transparency: 80 },
      line: { color: WHITE, transparency: 70 },
      rectRadius: 0.25,
    })
    s.addText('STRATEGY', {
      x: 0.7, y: 0.5, w: 4, h: 0.5,
      fontSize: 11, bold: true, color: WHITE, fontFace: FONT, align: 'center',
    })

    s.addText('このLPから、こんな広告運用を提案します', {
      x: 0.7, y: 1.2, w: 12, h: 1,
      fontSize: 32, bold: true, color: WHITE, fontFace: FONT,
    })

    s.addShape('roundRect' as any, {
      x: 0.7, y: 2.5, w: 12, h: 4.5,
      fill: { color: WHITE, transparency: 92 },
      line: { color: WHITE, transparency: 80 },
      rectRadius: 0.15,
    })
    s.addText(input.recommendation, {
      x: 0.95, y: 2.7, w: 11.5, h: 4.1,
      fontSize: 14, color: WHITE, bold: true, fontFace: FONT, valign: 'top',
      paraSpaceAfter: 6,
    })
  }

  // ============================================
  // SLIDE 5: シミュレーション結果（全体KPI 6項目）
  // ============================================
  {
    const s = pptx.addSlide()
    s.background = { color: STANDARD_BG }
    addHeader(s, 'シミュレーション結果（全体）', '媒体別×月次のパフォーマンス予測')

    const kpis: [string, string][] = [
      ['総予算', `¥${overall.totalBudget.toLocaleString()}`],
      ['総Impression', overall.totalImpression.toLocaleString()],
      ['総Click', overall.totalClick.toLocaleString()],
      ['総CV', overall.totalCv.toLocaleString()],
      ['平均CPA', `¥${overall.avgCpa.toLocaleString()}`],
      ['平均ROAS', `${overall.avgRoas}%`],
    ]
    kpis.forEach(([label, value], i) => {
      const col = i % 3
      const row = Math.floor(i / 3)
      const x = 0.6 + col * 4.2
      const y = 1.8 + row * 2.3
      s.addShape('roundRect' as any, {
        x, y, w: 4.0, h: 2.0,
        fill: { color: BLUE_50 },
        line: { color: BLUE_200 },
        rectRadius: 0.12,
      })
      s.addText(label, {
        x: x + 0.2, y: y + 0.3, w: 3.6, h: 0.4,
        fontSize: 12, color: LABEL, bold: true, align: 'center', fontFace: FONT,
      })
      s.addText(value, {
        x: x + 0.2, y: y + 0.85, w: 3.6, h: 1,
        fontSize: 28, bold: true, color: BLUE_900, align: 'center', fontFace: FONT,
      })
    })
  }

  // ============================================
  // SLIDE 6: 媒体別パフォーマンス
  // ============================================
  {
    const s = pptx.addSlide()
    s.background = { color: STANDARD_BG }
    addHeader(s, '媒体別パフォーマンス', '媒体ごとの予算・指標')

    const headerOpts = { bold: true, color: WHITE, fill: { color: BLUE_900 }, fontFace: FONT }
    const rows: any[] = [
      ['媒体', '総予算', 'Imp', 'Click', 'CV', 'CPA', 'ROAS'].map((h) => ({
        text: h,
        options: headerOpts,
      })),
    ]
    for (const m of input.simulation.media) {
      rows.push([
        { text: m.mediaName, options: { fontFace: FONT, bold: true } },
        { text: `¥${m.totalBudget.toLocaleString()}`, options: { fontFace: FONT, bold: true } },
        { text: m.summary.impression.toLocaleString(), options: { fontFace: FONT, bold: true } },
        { text: m.summary.click.toLocaleString(), options: { fontFace: FONT, bold: true } },
        { text: m.summary.cv.toLocaleString(), options: { fontFace: FONT, bold: true } },
        { text: `¥${m.summary.avgCpa.toLocaleString()}`, options: { fontFace: FONT, bold: true } },
        { text: `${m.summary.avgRoas}%`, options: { fontFace: FONT, bold: true } },
      ])
    }
    s.addTable(rows, {
      x: 0.7, y: 1.7, w: 12,
      fontSize: 13,
      border: { type: 'solid', pt: 1, color: BLUE_200 },
      rowH: 0.5,
    })
  }

  // ============================================
  // SLIDE 7: 予算配分の根拠
  // ============================================
  if (input.budgetRationale) {
    const s = pptx.addSlide()
    s.background = { color: STANDARD_BG }
    addHeader(s, '予算配分の根拠', 'なぜこの媒体ミックスにしたのか')
    s.addText(input.budgetRationale, {
      x: 0.7, y: 1.7, w: 12, h: 5.3,
      fontSize: 14, color: DARK, bold: false, fontFace: FONT, valign: 'top',
      paraSpaceAfter: 6,
    })
  }

  // ============================================
  // SLIDE 8: 平均CPA・CVの根拠
  // ============================================
  if (input.cpaRationale) {
    const s = pptx.addSlide()
    s.background = { color: STANDARD_BG }
    addHeader(s, '平均CPA・CVの根拠', '目標値の算定根拠')
    s.addText(input.cpaRationale, {
      x: 0.7, y: 1.7, w: 12, h: 5.3,
      fontSize: 14, color: DARK, bold: false, fontFace: FONT, valign: 'top',
      paraSpaceAfter: 6,
    })
  }

  // ============================================
  // SLIDES 9〜: 提案文 10セクション
  // ============================================
  for (const sec of input.proposal) {
    const s = pptx.addSlide()
    s.background = { color: STANDARD_BG }
    addHeader(s, sec.title, '')
    s.addText(sec.content, {
      x: 0.7, y: 1.7, w: 12, h: 5.3,
      fontSize: 14, color: DARK, fontFace: FONT, valign: 'top',
      paraSpaceAfter: 6,
    })
  }

  // ============================================
  // 最終: 免責
  // ============================================
  {
    const s = pptx.addSlide()
    s.background = { color: STANDARD_BG }

    s.addShape('roundRect' as any, {
      x: 1.5, y: 2.0, w: 10.3, h: 3.5,
      fill: { color: 'FFFBEB' },
      line: { color: 'F59E0B' },
      rectRadius: 0.15,
    })
    s.addText('免責事項', {
      x: 1.7, y: 2.3, w: 10, h: 0.6,
      fontSize: 22, bold: true, color: '78350F', fontFace: FONT,
    })
    s.addText(
      '本資料に記載されたシミュレーション数値は、業界平均ベンチマークおよびAIによる推定値であり、実際の広告運用結果を保証するものではありません。実運用時は媒体のオークション状況、クリエイティブ品質、LPコンバージョン率などにより結果が変動します。',
      {
        x: 1.7, y: 3.1, w: 9.9, h: 2.3,
        fontSize: 13, color: '78350F', bold: true, fontFace: FONT, valign: 'top',
        paraSpaceAfter: 6,
      }
    )

    s.addText('ドヤ広告シミュレーションAI', {
      x: 0.7, y: 6.8, w: 12, h: 0.4,
      fontSize: 10, color: '9CA3AF', bold: true, align: 'right', fontFace: FONT,
    })
  }

  const buf = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer
  return new Uint8Array(buf)
}

// ----------------------------------------
// 各スライドの上部ヘッダー（青いライン + タイトル + サブタイトル）
// ----------------------------------------
function addHeader(slide: any, title: string, subtitle: string) {
  // 上部のグラデ風バー
  slide.addShape('rect' as any, {
    x: 0, y: 0, w: 13.33, h: 0.15,
    fill: { color: BLUE_900 },
    line: { color: BLUE_900 },
  })
  slide.addShape('rect' as any, {
    x: 0, y: 0.15, w: 13.33, h: 0.05,
    fill: { color: BLUE_600 },
    line: { color: BLUE_600 },
  })
  // タイトル
  slide.addText(title, {
    x: 0.7, y: 0.45, w: 12, h: 0.7,
    fontSize: 26, bold: true, color: BLUE_900, fontFace: FONT,
  })
  // サブタイトル
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.7, y: 1.15, w: 12, h: 0.4,
      fontSize: 11, color: LABEL, bold: true, fontFace: FONT,
    })
  }
  // 細い区切り線
  slide.addShape('line' as any, {
    x: 0.7, y: 1.55, w: 12, h: 0,
    line: { color: BLUE_200, width: 1 },
  })
}
