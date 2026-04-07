// ============================================
// Excel生成（exceljs）
// ============================================
// 媒体別×月次のシミュレーション数値を Excel ワークブックで出力する。
// クライアントに数値の根拠として添付できる「生データ」としての位置付け。

import ExcelJS from 'exceljs'
import { SimulationResult } from './simulator'

export interface ExcelInput {
  clientName: string
  productName: string
  industry: string
  monthlyBudget: number
  periodMonths: number
  simulation: SimulationResult
}

export async function generateExcelBuffer(input: ExcelInput): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'ドヤ広告シミュレーションAI'
  wb.created = new Date()

  // ----- Sheet 1: サマリ -----
  const summary = wb.addWorksheet('サマリ')
  summary.columns = [
    { header: '項目', key: 'k', width: 20 },
    { header: '値', key: 'v', width: 30 },
  ]
  summary.addRows([
    { k: 'クライアント', v: input.clientName },
    { k: '商材', v: input.productName },
    { k: '業種', v: input.industry },
    { k: '月額予算', v: input.monthlyBudget },
    { k: '期間（月）', v: input.periodMonths },
    { k: '総予算', v: input.simulation.overall.totalBudget },
    { k: '総Impression', v: input.simulation.overall.totalImpression },
    { k: '総Click', v: input.simulation.overall.totalClick },
    { k: '総CV', v: input.simulation.overall.totalCv },
    { k: '平均CPA', v: input.simulation.overall.avgCpa },
    { k: '平均ROAS', v: input.simulation.overall.avgRoas },
  ])
  summary.getRow(1).font = { bold: true }
  summary.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF6366F1' },
  }
  summary.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

  // ----- Sheet 2: 媒体別サマリ -----
  const mediaSheet = wb.addWorksheet('媒体別サマリ')
  mediaSheet.columns = [
    { header: '媒体', key: 'name', width: 24 },
    { header: '総予算', key: 'budget', width: 14 },
    { header: 'Impression', key: 'imp', width: 14 },
    { header: 'Click', key: 'click', width: 12 },
    { header: 'CV', key: 'cv', width: 10 },
    { header: '平均CPA', key: 'cpa', width: 12 },
    { header: '平均ROAS', key: 'roas', width: 12 },
  ]
  for (const m of input.simulation.media) {
    mediaSheet.addRow({
      name: m.mediaName,
      budget: m.totalBudget,
      imp: m.summary.impression,
      click: m.summary.click,
      cv: m.summary.cv,
      cpa: m.summary.avgCpa,
      roas: m.summary.avgRoas,
    })
  }
  mediaSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  mediaSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF6366F1' },
  }

  // ----- Sheet 3以降: 媒体別 月次シミュレーション -----
  for (const m of input.simulation.media) {
    const ws = wb.addWorksheet(m.mediaName.substring(0, 28))
    ws.columns = [
      { header: '月', key: 'month', width: 8 },
      { header: '予算', key: 'budget', width: 14 },
      { header: 'Impression', key: 'imp', width: 14 },
      { header: 'Click', key: 'click', width: 12 },
      { header: 'CTR', key: 'ctr', width: 10 },
      { header: 'CPC', key: 'cpc', width: 10 },
      { header: 'CV', key: 'cv', width: 10 },
      { header: 'CVR', key: 'cvr', width: 10 },
      { header: 'CPA', key: 'cpa', width: 10 },
      { header: 'ROAS', key: 'roas', width: 10 },
    ]
    for (const row of m.monthly) {
      ws.addRow({
        month: `${row.month}ヶ月目`,
        budget: row.budget,
        imp: row.impression,
        click: row.click,
        ctr: `${(row.ctr * 100).toFixed(2)}%`,
        cpc: row.cpc,
        cv: row.cv,
        cvr: `${(row.cvr * 100).toFixed(2)}%`,
        cpa: row.cpa,
        roas: row.roas,
      })
    }
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF6366F1' },
    }
  }

  const buf = await wb.xlsx.writeBuffer()
  return new Uint8Array(buf)
}
