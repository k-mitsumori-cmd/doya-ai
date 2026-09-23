function csvEscape(value: any): string {
  if (value === null || value === undefined) return ''
  let s = String(value)
  // CSV式インジェクション対策: =/+/-/@/タブ/改行で始まる値の先頭にシングルクォート付与
  // Excel/LibreOffice等が数式として実行するのを防ぐ
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s
  }
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function buildDoyalistCsv(companies: any[], approaches: any[]): string {
  const BOM = '﻿'
  const lines: string[] = []

  // 企業セクション
  lines.push('# 企業一覧')
  const companyHeaders = [
    '法人番号',
    '企業名',
    '業種',
    '所在地',
    '都道府県',
    '代表者',
    '従業員数',
    '資本金',
    '設立年',
    'ウェブサイト',
    '事業概要',
    '取得元',
    '作成日',
  ]
  lines.push(companyHeaders.map(csvEscape).join(','))
  for (const c of companies) {
    const ed = (c.enrichedData as any) || {}
    lines.push(
      [
        ed.corporateNumber || '',
        c.name,
        c.industry || ed.industry || '',
        ed.address || c.region || '',
        ed.prefecture || '',
        ed.representative || c.contactPerson || '',
        ed.employeeCount || c.size || '',
        ed.capital || '',
        ed.foundedYear || '',
        c.website || '',
        ed.businessSummary || c.description || '',
        c.source || '',
        c.createdAt instanceof Date ? c.createdAt.toISOString().slice(0, 10) : String(c.createdAt).slice(0, 10),
      ]
        .map(csvEscape)
        .join(',')
    )
  }

  // アプローチセクション
  lines.push('')
  lines.push('# アプローチ一覧')
  const approachHeaders = [
    'アプローチID',
    '企業ID',
    'タイプ',
    '件名',
    '本文',
    'ステータス',
    '作成日',
  ]
  lines.push(approachHeaders.map(csvEscape).join(','))
  for (const a of approaches) {
    lines.push(
      [
        a.id,
        a.companyId || '',
        a.type,
        a.subject || '',
        a.body || '',
        a.status,
        a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt,
      ]
        .map(csvEscape)
        .join(',')
    )
  }

  return BOM + lines.join('\r\n')
}
