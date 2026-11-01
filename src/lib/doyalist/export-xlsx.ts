import archiver from 'archiver'
import { PassThrough, Readable } from 'node:stream'
import {
  type DoyalistExportFirstPage,
  iterateDoyalistApproaches,
  iterateDoyalistCompanies,
} from './export-stream'

const sheetNamespace = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const relationshipNamespace = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const companyHeaders = ['法人番号', '企業名', '業種', '所在地', '都道府県', '代表者', '従業員数', '資本金', '設立年', 'ウェブサイト', '事業概要', '取得元', '作成日']
const approachHeaders = ['アプローチID', '企業ID', 'タイプ', '件名', '本文', 'ステータス', '作成日']

function cleanText(value: unknown): string {
  return String(value ?? '').replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '')
}

/** Escape Xstring once, before XML, so literal _xHHHH_, CR and DEL survive Excel. */
function text(value: unknown): string {
  return cleanText(value)
    .replace(/_(?=x[0-9A-Fa-f]{4}_)/g, '_x005F_')
    .replace(/\r/g, '_x000D_').replace(/\u007F/g, '_x007F_')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function worksheetName(name: string): string {
  const cleaned = cleanText(name || '').replace(/[\/\\?*:\[\]\u0000-\u001F]/g, '_')
    .trim().replace(/^'+|'+$/g, '').trim() || 'プロジェクト'
  let prefix = ''
  for (const character of cleaned) {
    if (prefix.length + character.length > 28) break
    prefix += character
  }
  return `${prefix}_企業`
}

function row(values: unknown[], number: number): string {
  return `<row r="${number}">${values.map((value, column) =>
    `<c r="${String.fromCharCode(65 + column)}${number}" t="inlineStr"><is><t xml:space="preserve">${text(value)}</t></is></c>`).join('')}</row>`
}

async function* worksheet(headers: string[], values: AsyncIterable<unknown[]>, widths: number[]): AsyncGenerator<Buffer> {
  yield Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${sheetNamespace}"><cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${row(headers, 1)}`)
  let number = 1
  for await (const value of values) yield Buffer.from(row(value, ++number))
  yield Buffer.from('</sheetData></worksheet>')
}

async function* companyValues(projectId: string, firstPage: DoyalistExportFirstPage): AsyncGenerator<unknown[]> {
  for await (const company of iterateDoyalistCompanies(projectId, firstPage.companies)) {
    const data = (company.enrichedData as Record<string, unknown>) || {}
    yield [data.corporateNumber || '', company.name, company.industry || data.industry || '',
      data.address || company.region || '', data.prefecture || '', data.representative || company.contactPerson || '',
      data.employeeCount || company.size || '', data.capital || '', data.foundedYear || '', company.website || '',
      data.businessSummary || company.description || '', company.source || '',
      company.createdAt instanceof Date ? company.createdAt.toISOString().slice(0, 10) : String(company.createdAt).slice(0, 10)]
  }
}

async function* approachValues(projectId: string, firstPage: DoyalistExportFirstPage): AsyncGenerator<unknown[]> {
  for await (const approach of iterateDoyalistApproaches(projectId, firstPage.approaches)) {
    yield [approach.id, approach.companyId || '', approach.type, approach.subject || '', approach.body || '',
      approach.status, approach.createdAt instanceof Date ? approach.createdAt.toISOString() : approach.createdAt]
  }
}

/** Lazy ZIP inputs let downstream backpressure reach the bounded database iterators. */
export function createDoyalistXlsxStream(projectName: string, projectId: string, firstPage: DoyalistExportFirstPage, signal?: AbortSignal): PassThrough {
  const archive = archiver('zip', { zlib: { level: 6 } })
  const output = new PassThrough()
  const inputs = [
    Readable.from(worksheet(companyHeaders, companyValues(projectId, firstPage), [18, 30, 22, 40, 14, 20, 16, 18, 14, 36, 50, 20, 16]), { objectMode: false, highWaterMark: 16384 }),
    Readable.from(worksheet(approachHeaders, approachValues(projectId, firstPage), [30, 30, 16, 40, 60, 18, 28]), { objectMode: false, highWaterMark: 16384 }),
  ]
  const stopInputs = () => { archive.abort(); for (const input of inputs) input.destroy() }
  const fail = () => { stopInputs(); output.destroy(new Error('Doyalist export failed')) }
  const cancel = () => { stopInputs(); output.destroy(new Error('Export cancelled')) }
  archive.on('error', fail)
  for (const input of inputs) input.on('error', fail)
  output.once('close', () => { signal?.removeEventListener('abort', cancel); stopInputs() })
  archive.pipe(output)
  const add = (name: string, value: string) => archive.append(value, { name })
  add('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`)
  add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${relationshipNamespace}/officeDocument" Target="xl/workbook.xml"/></Relationships>`)
  add('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${sheetNamespace}" xmlns:r="${relationshipNamespace}"><sheets><sheet name="${text(worksheetName(projectName))}" sheetId="1" r:id="rId1"/><sheet name="アプローチ" sheetId="2" r:id="rId2"/></sheets></workbook>`)
  add('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${relationshipNamespace}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${relationshipNamespace}/worksheet" Target="worksheets/sheet2.xml"/></Relationships>`)
  inputs.forEach((input, index) => archive.append(input, { name: `xl/worksheets/sheet${index + 1}.xml` }))
  void archive.finalize().catch(fail)
  signal?.addEventListener('abort', cancel, { once: true })
  if (signal?.aborted) cancel()
  return output
}
