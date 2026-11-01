import { fetchCollectionText } from './provider-json'
import { parseCorporateNumberXml, type CorporateNumberResult } from './corporate-number-xml'
import { resolvePrefectureCodes } from './prefecture-codes'

const API_BASE = 'https://api.houjin-bangou.nta.go.jp/4'

interface SearchParams {
  keyword?: string
  prefecture?: string
  divide?: number
  count?: number
  timeoutMs?: number
}

export async function searchCorporateNumber(params: SearchParams): Promise<CorporateNumberResult[]> {
  const apiKey = process.env.CORPORATE_NUMBER_API_KEY
  if (!apiKey) {
    throw new Error('CORPORATE_NUMBER_API_KEY が設定されていません')
  }

  if (typeof params.keyword !== 'string' || !params.keyword.trim()) throw new Error('法人名を指定してください')
  const count = params.count ?? 50
  if (!Number.isInteger(count) || count < 1 || count > 50) throw new Error('取得件数を確認してください')
  if (params.divide !== undefined && (!Number.isInteger(params.divide) || params.divide < 1 || params.divide > 99999)) {
    throw new Error('分割番号を確認してください')
  }
  const timeout = params.timeoutMs ?? 12_000
  if (!Number.isFinite(timeout) || timeout < 0) throw new Error('取得時間を確認してください')

  const url = new URL(`${API_BASE}/name`)
  url.searchParams.set('id', apiKey)
  url.searchParams.set('type', '12') // XML / Unicode, per NTA's v4 specification.
  url.searchParams.set('change', '0')
  url.searchParams.set('name', params.keyword.trim())
  if (params.prefecture && params.prefecture !== '全国') {
    const codes = params.prefecture === '99' ? ['99'] : resolvePrefectureCodes(params.prefecture)
    if (codes.length !== 1) throw new Error('都道府県を1つ指定してください')
    url.searchParams.set('address', codes[0])
  }
  if (params.divide !== undefined) url.searchParams.set('divide', String(params.divide))

  const response = await fetchCollectionText(url.toString(), {}, {
    timeoutMs: Math.ceil(Math.min(12_000, Math.max(1, timeout))),
    maxBytes: 4 * 1024 * 1024,
  })
  if (!response.ok) {
    throw new Error(`Corporate number API error: ${response.status}`)
  }

  // NTA does not accept a result-count query parameter; bound the returned page locally.
  return parseCorporateNumberXml(response.text).slice(0, count)
}
