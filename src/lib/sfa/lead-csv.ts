const NAME_HEADERS = new Set(['name', 'companyName', '会社名', '企業名'])
const MAX_ROWS = 500

// RFC 4180 に沿って、引用符内の改行・カンマ・二重引用符を保持する。
export function parseLeadCsv(input: string): Record<string, string>[] {
  const text = input.replace(/^\uFEFF/, '')
  const records: string[][] = []
  let record: string[] = []
  let field = ''
  let inQuotes = false
  let closedQuote = false

  const finishRecord = () => {
    record.push(field.trim())
    if (record.some((value) => value !== '')) records.push(record)
    record = []
    field = ''
    closedQuote = false
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (char === '"') { inQuotes = false; closedQuote = true }
      else field += char
      continue
    }
    if (char === '"') {
      if (field !== '' || closedQuote) throw new Error('CSVの引用符の位置が正しくありません')
      inQuotes = true
    } else if (char === ',') {
      record.push(field.trim())
      field = ''
      closedQuote = false
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[i + 1] === '\n') i++
      finishRecord()
    } else if (closedQuote) {
      if (char !== ' ' && char !== '\t') throw new Error('CSVの引用符の後に余分な文字があります')
    } else {
      field += char
    }
  }
  if (inQuotes) throw new Error('CSVの引用符が閉じられていません')
  if (record.length > 0 || field !== '' || closedQuote) finishRecord()

  if (records.length < 2) throw new Error('ヘッダ行と1件以上のデータを入力してください')
  const headers = records[0]
  if (headers.some((header) => !header) || new Set(headers).size !== headers.length) {
    throw new Error('CSVの列名が空、または重複しています')
  }
  if (!headers.some((header) => NAME_HEADERS.has(header))) {
    throw new Error('企業名の列（name、companyName、会社名、企業名）が必要です')
  }
  if (records.length - 1 > MAX_ROWS) throw new Error(`一度に取り込めるのは${MAX_ROWS}件までです`)

  return records.slice(1).map((cells, index) => {
    if (cells.length !== headers.length) {
      throw new Error(`データ${index + 1}件目の列数がヘッダと一致しません`)
    }
    const row: Record<string, string> = Object.create(null)
    headers.forEach((header, column) => { row[header] = cells[column] })
    return row
  })
}
