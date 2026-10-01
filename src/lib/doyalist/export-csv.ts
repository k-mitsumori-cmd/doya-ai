function csvEscape(value: any): string {
  if (value === null || value === undefined) return ''
  let s = String(value)
  // CSV式インジェクション対策: =/+/-/@/タブ/改行で始まる値の先頭にシングルクォート付与
  // Excel/LibreOffice等が数式として実行するのを防ぐ
  if (/^[\s\u0000-\u001f\uFEFF]*[=+\-@]/.test(s)) {
    s = "'" + s
  }
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export const DOYALIST_COMPANY_HEADERS = [
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

export const DOYALIST_APPROACH_HEADERS = [
  'アプローチID', '企業ID', 'タイプ', '件名', '本文', 'ステータス', '作成日',
]

export function doyalistCsvHeader(labels: string[]): string {
  return labels.map(csvEscape).join(',')
}

export function doyalistCompanyCsvRow(c: any): string {
  const ed = (c.enrichedData as any) || {}
  return [
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
  ].map(csvEscape).join(',')
}

export function doyalistApproachCsvRow(a: any): string {
  return [
        a.id,
        a.companyId || '',
        a.type,
        a.subject || '',
        a.body || '',
        a.status,
        a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt,
  ].map(csvEscape).join(',')
}

export function buildDoyalistCsv(companies: any[], approaches: any[]): string {
  const lines = [
    '# 企業一覧',
    doyalistCsvHeader(DOYALIST_COMPANY_HEADERS),
    ...companies.map(doyalistCompanyCsvRow),
    '',
    '# アプローチ一覧',
    doyalistCsvHeader(DOYALIST_APPROACH_HEADERS),
    ...approaches.map(doyalistApproachCsvRow),
  ]
  return '\uFEFF' + lines.join('\r\n')
}
