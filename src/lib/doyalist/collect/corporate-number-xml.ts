import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { EntityDecoder } from '@nodable/entities'

export interface CorporateNumberResult {
  corporateNumber: string
  name: string
  address: string
  prefectureName: string
  cityName: string
  postCode: string
  kind: string
  updateDate: string
}

const MAX_RESPONSE_BYTES = 4 * 1024 * 1024
const invalidResponse = () => new Error('Corporate number API returned an invalid XML response')

/** NTA Web-API v4 type=12 is XML, with corporations/corporation and camelCase fields. */
export function parseCorporateNumberXml(xml: string): CorporateNumberResult[] {
  if (Buffer.byteLength(xml, 'utf8') > MAX_RESPONSE_BYTES) throw invalidResponse()
  xml = xml.replace(/^\uFEFF/, '')
  const entityInput = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>/g, '')
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(entityInput)) throw invalidResponse()
  if (XMLValidator.validate(xml) !== true) throw invalidResponse()
  if (/&(?!(?:amp|lt|gt|apos|quot|#\d+|#x[\da-fA-F]+);)/.test(entityInput)) throw invalidResponse()
  const parsed = new XMLParser({
    ignoreDeclaration: true,
    parseTagValue: false,
    trimValues: false,
    processEntities: { enabled: true, maxTotalExpansions: 100_000, maxExpandedLength: MAX_RESPONSE_BYTES },
    entityDecoder: new EntityDecoder({
      numericAllowed: true,
      limit: { maxTotalExpansions: 100_000, maxExpandedLength: MAX_RESPONSE_BYTES, applyLimitsTo: 'all' },
      ncr: { xmlVersion: 1.0, nullNCR: 'throw' },
      onExternalEntity: () => 'throw',
      onInputEntity: () => 'throw',
    }),
    isArray: name => name === 'corporation',
  }).parse(xml)
  const roots = Object.keys(parsed).filter(name => !name.startsWith('?'))
  if (roots.length !== 1 || roots[0] !== 'corporations') throw invalidResponse()
  const root = parsed?.corporations
  if (!root || typeof root !== 'object' || Array.isArray(root)) throw invalidResponse()
  if (typeof root.count !== 'string' || !/^\d+$/.test(root.count.trim())) throw invalidResponse()
  const total = Number(root.count.trim())
  if (!Number.isSafeInteger(total)) throw invalidResponse()
  const rows = root.corporation ?? []
  if (!Array.isArray(rows) || rows.length > total || (total > 0 && rows.length === 0)) throw invalidResponse()
  const text = (row: Record<string, unknown>, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(row, key)) return ''
    const value = row[key]
    if (value === undefined) return ''
    if (typeof value !== 'string') throw invalidResponse()
    return value
  }
  return rows.map((row: unknown) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw invalidResponse()
    const record = row as Record<string, unknown>
    const corporateNumber = text(record, 'corporateNumber')
    const name = text(record, 'name')
    if (!/^\d{13}$/.test(corporateNumber) || !name.trim()) throw invalidResponse()
    const prefectureName = text(record, 'prefectureName')
    const cityName = text(record, 'cityName')
    return {
      corporateNumber, name, prefectureName, cityName,
      address: [prefectureName, cityName, text(record, 'streetNumber')].filter(Boolean).join(''),
      postCode: text(record, 'postCode'), kind: text(record, 'kind'), updateDate: text(record, 'updateDate'),
    }
  })
}
