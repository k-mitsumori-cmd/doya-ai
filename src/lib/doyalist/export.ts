interface ExportCompany {
  companyName: string
  corporateNumber?: string | null
  industry?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  matchScore?: number | null
  contactStatus: string
  notes?: string | null
}

export function generateCSV(companies: ExportCompany[]): string {
  const headers = ['企業名', '法人番号', '業種', '住所', '電話番号', 'メール', 'Webサイト', 'マッチ度', 'ステータス', 'メモ']

  const rows = companies.map((c) => [
    escapeCsvField(c.companyName),
    escapeCsvField(c.corporateNumber || ''),
    escapeCsvField(c.industry || ''),
    escapeCsvField(c.address || ''),
    escapeCsvField(c.phone || ''),
    escapeCsvField(c.email || ''),
    escapeCsvField(c.website || ''),
    c.matchScore != null ? String(c.matchScore) : '',
    escapeCsvField(c.contactStatus),
    escapeCsvField(c.notes || ''),
  ])

  const bom = '﻿'
  return bom + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}

function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`
  }
  return field
}
