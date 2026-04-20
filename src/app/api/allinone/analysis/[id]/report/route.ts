/**
 * GET /api/allinone/analysis/[id]/report?format=md|pptx|xlsx|pdf
 * 分析レポートを指定フォーマットで出力。
 * 現状は md / xlsx / pptx を実装。pdf は puppeteer 経由を予定。
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import ExcelJS from 'exceljs'
import PptxGenJS from 'pptxgenjs'

export const runtime = 'nodejs'
export const maxDuration = 120
export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const format = (req.nextUrl.searchParams.get('format') || 'md').toLowerCase()
  const a = await prisma.allinoneAnalysis.findUnique({
    where: { id: params.id },
    include: { chats: { orderBy: { createdAt: 'asc' } } },
  })
  if (!a) return new Response('not found', { status: 404 })

  const fileBase = `allinone_${a.id}`

  if (format === 'md') {
    const md = buildMarkdown(a)
    return new Response(md, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileBase}.md"`,
      },
    })
  }

  if (format === 'xlsx') {
    const buf = await buildExcel(a)
    return new Response(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileBase}.xlsx"`,
      },
    })
  }

  if (format === 'pptx') {
    const buf = await buildPptx(a)
    return new Response(buf, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${fileBase}.pptx"`,
      },
    })
  }

  if (format === 'json') {
    return Response.json({ analysis: a })
  }

  return new Response('unsupported format', { status: 400 })
}

// ============================================
// Markdown
// ============================================

function buildMarkdown(a: any): string {
  const s = a.summary || {}
  const site = a.siteAnalysis || {}
  const seo = a.seoAnalysis || {}
  const personas: any[] = a.personas || []
  const branding = a.branding || {}
  const visuals: any[] = a.keyVisuals || []
  const actions: any[] = a.actionPlan || []

  const lines: string[] = []
  lines.push(`# ドヤマーケAI レポート`)
  lines.push('')
  lines.push(`**URL**: ${a.url}`)
  lines.push(`**分析日**: ${a.createdAt}`)
  lines.push(`**総合スコア**: ${a.overallScore ?? '?'}/100`)
  lines.push('')
  if (s.headline) {
    lines.push(`> ${s.headline}`)
    lines.push('')
  }
  if (s.elevatorPitch) {
    lines.push(`## サイト要約`)
    lines.push(s.elevatorPitch)
    lines.push('')
  }

  // レーダー
  if (a.radar) {
    const r: any = a.radar
    lines.push(`## 5軸スコア`)
    lines.push(`- サイト力: ${r.site ?? '?'}`)
    lines.push(`- SEO: ${r.seo ?? '?'}`)
    lines.push(`- コンテンツ: ${r.content ?? '?'}`)
    lines.push(`- ターゲティング: ${r.targeting ?? '?'}`)
    lines.push(`- 訴求力: ${r.appeal ?? '?'}`)
    lines.push('')
  }

  // Top 3 Actions
  if (s.topThreeActions?.length) {
    lines.push(`## 最優先アクション TOP3`)
    s.topThreeActions.forEach((act: any, i: number) => {
      lines.push(`${i + 1}. **${act.title}** — ${act.why}`)
    })
    lines.push('')
  }

  // サイト分析
  lines.push(`## サイト診断`)
  if (site.firstImpression) lines.push(`**第一印象**: ${site.firstImpression} (${site.firstImpressionScore ?? '?'}/100)`)
  if (site.strengths?.length) lines.push(`\n**強み**:\n${site.strengths.map((x: string) => `- ${x}`).join('\n')}`)
  if (site.weaknesses?.length) lines.push(`\n**弱み**:\n${site.weaknesses.map((x: string) => `- ${x}`).join('\n')}`)
  if (site.issues?.length) {
    lines.push(`\n**課題一覧**:`)
    site.issues.forEach((iss: any) => {
      lines.push(`- [${iss.severity}] ${iss.title} — ${iss.description}`)
      lines.push(`  - 直し方: ${iss.suggestion}`)
    })
  }
  lines.push('')

  // SEO
  lines.push(`## SEO 分析`)
  if (seo.estimatedTargetKeywords?.length)
    lines.push(`**想定キーワード**: ${seo.estimatedTargetKeywords.join(', ')}`)
  if (seo.missingKeywords?.length)
    lines.push(`**不足キーワード**: ${seo.missingKeywords.join(', ')}`)
  if (seo.contentGaps?.length) {
    lines.push(`\n**コンテンツギャップ**:`)
    seo.contentGaps.forEach((g: any) => {
      lines.push(`- [${g.severity}] ${g.title} — ${g.description}`)
      lines.push(`  - 提案: ${g.suggestion}`)
    })
  }
  if (seo.quickWins?.length) {
    lines.push(`\n**クイックウィン**:`)
    seo.quickWins.forEach((qw: any) => {
      lines.push(`- ${qw.title} (効果: ${qw.impact} / 手間: ${qw.effort}) — ${qw.detail}`)
    })
  }
  lines.push('')

  // ペルソナ
  if (personas.length) {
    lines.push(`## ペルソナ (${personas.length}名)`)
    personas.forEach((p) => {
      lines.push(`### ${p.name} (${p.age}歳 ${p.occupation})`)
      if (p.quote) lines.push(`> ${p.quote}`)
      if (p.motivation) lines.push(`- 動機: ${p.motivation}`)
      if (p.painPoint) lines.push(`- 痛み: ${p.painPoint}`)
      if (p.buyingTrigger) lines.push(`- 購入トリガー: ${p.buyingTrigger}`)
      if (p.objection) lines.push(`- 懸念: ${p.objection}`)
      lines.push('')
    })
  }

  // ブランディング
  if (branding.tone) {
    lines.push(`## ブランディング`)
    lines.push(`- トーン: ${branding.tone}`)
    if (branding.palette?.length) lines.push(`- パレット: ${branding.palette.join(', ')}`)
    if (branding.fontImpression) lines.push(`- フォント: ${branding.fontImpression}`)
    if (branding.visualStyle) lines.push(`- ビジュアル: ${branding.visualStyle}`)
    if (branding.improvements?.length) {
      lines.push(`- 改善案:`)
      branding.improvements.forEach((x: string) => lines.push(`  - ${x}`))
    }
    lines.push('')
  }

  // ビジュアル
  if (visuals.length) {
    lines.push(`## キービジュアル 3案`)
    visuals.forEach((v) => {
      lines.push(`### ${v.id}. ${v.concept}`)
      lines.push(`- ${v.headline}`)
      lines.push(`- ${v.subcopy}`)
      lines.push('')
    })
  }

  // アクション
  if (actions.length) {
    lines.push(`## アクションプラン (${actions.length}件)`)
    lines.push('| # | 優先度 | タイトル | 手間 | 日数 | 連携 |')
    lines.push('|---|---|---|---|---|---|')
    actions.forEach((act: any, i: number) => {
      lines.push(
        `| ${i + 1} | P${act.priority} | ${act.title} | ${act.effort} | ${act.durationDays}日 | ${act.relatedService || '-'} |`
      )
    })
    actions.forEach((act: any, i: number) => {
      lines.push(`\n**${i + 1}. ${act.title}**`)
      lines.push(`- 内容: ${act.description}`)
      lines.push(`- 期待効果: ${act.expectedImpact}`)
    })
    lines.push('')
  }

  // チャット履歴
  if (a.chats?.length) {
    lines.push(`## AI チャット履歴`)
    a.chats.forEach((c: any) => {
      lines.push(`- **${c.role === 'user' ? 'あなた' : 'AI'}**: ${c.content}`)
    })
  }

  lines.push(`\n---\n*Generated by ドヤマーケAI*`)
  return lines.join('\n')
}

// ============================================
// Excel
// ============================================

async function buildExcel(a: any): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'ドヤマーケAI'

  // サマリ
  const s0 = wb.addWorksheet('サマリ')
  s0.addRow(['URL', a.url])
  s0.addRow(['総合スコア', a.overallScore ?? ''])
  s0.addRow(['タイトル', a.title ?? ''])
  s0.addRow(['説明', a.description ?? ''])
  if (a.radar) {
    const r: any = a.radar
    s0.addRow([])
    s0.addRow(['【5軸スコア】'])
    s0.addRow(['サイト力', r.site])
    s0.addRow(['SEO', r.seo])
    s0.addRow(['コンテンツ', r.content])
    s0.addRow(['ターゲティング', r.targeting])
    s0.addRow(['訴求力', r.appeal])
  }

  // サイト課題
  const s1 = wb.addWorksheet('サイト課題')
  s1.addRow(['カテゴリ', '重要度', 'タイトル', '課題内容', '改善提案'])
  for (const iss of a.siteAnalysis?.issues || []) {
    s1.addRow([iss.category, iss.severity, iss.title, iss.description, iss.suggestion])
  }

  // SEO ギャップ
  const s2 = wb.addWorksheet('SEOコンテンツギャップ')
  s2.addRow(['タイプ', '重要度', 'タイトル', '説明', '提案', '連携サービス'])
  for (const g of a.seoAnalysis?.contentGaps || []) {
    s2.addRow([g.type, g.severity, g.title, g.description, g.suggestion, g.relatedService || ''])
  }

  // ペルソナ
  const s3 = wb.addWorksheet('ペルソナ')
  s3.addRow(['名前', '年齢', '職業', '動機', '痛み', '購入トリガー', '懸念'])
  for (const p of a.personas || []) {
    s3.addRow([p.name, p.age, p.occupation, p.motivation, p.painPoint, p.buyingTrigger, p.objection])
  }

  // アクション
  const s4 = wb.addWorksheet('アクションプラン')
  s4.addRow(['#', '優先度', 'タイトル', '内容', '期待効果', '手間', '日数', '連携'])
  for (const [i, act] of (a.actionPlan || []).entries()) {
    s4.addRow([
      i + 1,
      act.priority,
      act.title,
      act.description,
      act.expectedImpact,
      act.effort,
      act.durationDays,
      act.relatedService || '',
    ])
  }

  // 幅調整
  for (const sheet of [s0, s1, s2, s3, s4]) {
    sheet.columns.forEach((col) => {
      col.width = 28
      col.alignment = { wrapText: true, vertical: 'top' }
    })
    if (sheet.getRow(1)) {
      sheet.getRow(1).font = { bold: true }
    }
  }

  const buf = await wb.xlsx.writeBuffer()
  return new Uint8Array(buf as ArrayBuffer)
}

// ============================================
// PPTX
// ============================================

async function buildPptx(a: any): Promise<Uint8Array> {
  const pres = new PptxGenJS()
  pres.layout = 'LAYOUT_WIDE' // 13.33 x 7.5
  pres.theme = { headFontFace: 'Noto Sans JP', bodyFontFace: 'Noto Sans JP' }

  // タイトル
  const s0 = pres.addSlide()
  s0.background = { color: 'FFFFFF' }
  s0.addText('ドヤマーケAI', { x: 0.5, y: 0.5, w: 12, h: 0.7, fontSize: 18, color: '7C5CFF', bold: true })
  s0.addText(a.title || a.url, { x: 0.5, y: 1.4, w: 12, h: 1.5, fontSize: 36, color: '0B0E24', bold: true })
  s0.addText(a.summary?.headline || '', { x: 0.5, y: 3.0, w: 12, h: 1.2, fontSize: 18, color: '1E2240' })
  s0.addText(`総合スコア ${a.overallScore ?? '-'} / 100`, {
    x: 0.5,
    y: 4.5,
    w: 6,
    h: 1,
    fontSize: 48,
    color: '7C5CFF',
    bold: true,
  })

  // サマリ
  if (a.summary?.topThreeActions?.length) {
    const s = pres.addSlide()
    s.addText('最優先アクション TOP3', { x: 0.5, y: 0.3, w: 12, h: 0.7, fontSize: 24, bold: true, color: '0B0E24' })
    a.summary.topThreeActions.forEach((act: any, i: number) => {
      const y = 1.3 + i * 1.8
      s.addShape(pres.ShapeType.roundRect, {
        x: 0.5,
        y,
        w: 12,
        h: 1.5,
        fill: { color: 'F7F8FC' },
        line: { color: 'E6E8F0', width: 1 },
        rectRadius: 0.15,
      })
      s.addText(`${i + 1}. ${act.title}`, {
        x: 0.8,
        y: y + 0.2,
        w: 11,
        h: 0.6,
        fontSize: 18,
        bold: true,
        color: '7C5CFF',
      })
      s.addText(act.why, { x: 0.8, y: y + 0.8, w: 11, h: 0.6, fontSize: 14, color: '1E2240' })
    })
  }

  // サイト課題
  if (a.siteAnalysis?.issues?.length) {
    const s = pres.addSlide()
    s.addText('サイトの課題', { x: 0.5, y: 0.3, w: 12, h: 0.7, fontSize: 24, bold: true, color: '0B0E24' })
    const rows = [
      [
        { text: 'カテゴリ', options: { bold: true, fill: { color: '0B0E24' }, color: 'FFFFFF' } },
        { text: '重要度', options: { bold: true, fill: { color: '0B0E24' }, color: 'FFFFFF' } },
        { text: '内容', options: { bold: true, fill: { color: '0B0E24' }, color: 'FFFFFF' } },
        { text: '対処', options: { bold: true, fill: { color: '0B0E24' }, color: 'FFFFFF' } },
      ],
      ...a.siteAnalysis.issues.slice(0, 8).map((i: any) => [
        i.category,
        i.severity,
        i.title,
        i.suggestion,
      ]),
    ]
    s.addTable(rows, { x: 0.5, y: 1.1, w: 12, fontSize: 12, colW: [1.5, 1.5, 4.5, 4.5] })
  }

  // SEO ギャップ
  if (a.seoAnalysis?.contentGaps?.length) {
    const s = pres.addSlide()
    s.addText('SEO コンテンツギャップ', { x: 0.5, y: 0.3, w: 12, h: 0.7, fontSize: 24, bold: true, color: '0B0E24' })
    a.seoAnalysis.contentGaps.slice(0, 5).forEach((g: any, i: number) => {
      const y = 1.1 + i * 1.2
      s.addText(`・${g.title}`, { x: 0.6, y, w: 11, h: 0.5, fontSize: 16, bold: true, color: '7C5CFF' })
      s.addText(g.suggestion, { x: 0.8, y: y + 0.5, w: 11, h: 0.6, fontSize: 12, color: '1E2240' })
    })
  }

  // ペルソナ
  if (a.personas?.length) {
    const s = pres.addSlide()
    s.addText('ペルソナ 3案', { x: 0.5, y: 0.3, w: 12, h: 0.7, fontSize: 24, bold: true, color: '0B0E24' })
    a.personas.slice(0, 3).forEach((p: any, i: number) => {
      const x = 0.5 + i * 4.3
      s.addShape(pres.ShapeType.roundRect, {
        x,
        y: 1.1,
        w: 4,
        h: 5.5,
        fill: { color: 'FBFBFE' },
        line: { color: 'E6E8F0', width: 1 },
        rectRadius: 0.2,
      })
      if (p.portraitUrl?.startsWith('data:')) {
        try {
          s.addImage({ data: p.portraitUrl, x: x + 0.3, y: 1.3, w: 3.4, h: 2.5 })
        } catch {
          /* skip */
        }
      }
      s.addText(`${p.name} / ${p.age}歳`, {
        x: x + 0.3,
        y: 3.9,
        w: 3.4,
        h: 0.4,
        fontSize: 16,
        bold: true,
      })
      s.addText(p.occupation || '', { x: x + 0.3, y: 4.3, w: 3.4, h: 0.4, fontSize: 12, color: '6B7280' })
      s.addText(`動機: ${p.motivation || ''}`, { x: x + 0.3, y: 4.8, w: 3.4, h: 0.8, fontSize: 10 })
      s.addText(`痛み: ${p.painPoint || ''}`, { x: x + 0.3, y: 5.7, w: 3.4, h: 0.7, fontSize: 10 })
    })
  }

  // アクション
  if (a.actionPlan?.length) {
    const s = pres.addSlide()
    s.addText('アクションプラン', { x: 0.5, y: 0.3, w: 12, h: 0.7, fontSize: 24, bold: true, color: '0B0E24' })
    const rows = [
      [
        { text: '#', options: { bold: true, fill: { color: '0B0E24' }, color: 'FFFFFF' } },
        { text: '優先度', options: { bold: true, fill: { color: '0B0E24' }, color: 'FFFFFF' } },
        { text: 'タイトル', options: { bold: true, fill: { color: '0B0E24' }, color: 'FFFFFF' } },
        { text: '期待効果', options: { bold: true, fill: { color: '0B0E24' }, color: 'FFFFFF' } },
        { text: '日数', options: { bold: true, fill: { color: '0B0E24' }, color: 'FFFFFF' } },
      ],
      ...a.actionPlan.slice(0, 10).map((act: any, i: number) => [
        String(i + 1),
        `P${act.priority}`,
        act.title,
        act.expectedImpact,
        `${act.durationDays}日`,
      ]),
    ]
    s.addTable(rows, { x: 0.5, y: 1.1, w: 12, fontSize: 11, colW: [0.6, 1, 4, 5.5, 0.9] })
  }

  const out = await pres.write({ outputType: 'nodebuffer' })
  // pptxgenjs の write 型は union 返りのため、Uint8Array にキャスト
  if (out instanceof Uint8Array) return out
  if (typeof ArrayBuffer !== 'undefined' && out instanceof ArrayBuffer) {
    return new Uint8Array(out)
  }
  // nodebuffer 指定時は常に Buffer（= Uint8Array 派生）なので到達しないが念のため
  return new Uint8Array(Buffer.from(String(out)))
}
